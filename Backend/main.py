# main.py
from fastapi import FastAPI, UploadFile, File, HTTPException, BackgroundTasks, Depends
from fastapi.responses import JSONResponse
from sqlalchemy.orm import Session
import os
import shutil
from typing import Dict, Any, List

from config import Config
# Ensure SessionLocal is imported here
from database.database import get_db, create_db_tables, SessionLocal 
from database.crud import (
    create_document_record, update_document_status, get_document_record, save_frontend_state
)
from services.ocr_service import OCRService
from services.hierarchy_correction_service import HierarchyCorrectionService
from services.flattener_service import FlattenerService
from utils.file_manager import FileManager
from schemas.document import (
    DocumentUploadResponse, DocumentStatusResponse, DocumentState, PageDimensions
)

# --- Application Setup ---
app = FastAPI(title="Document Processing Pipeline")

# Initialize Configuration
config = Config()

# Initialize File Manager
file_manager = FileManager(
    input_dir=config.INPUT_DIR, 
    cache_dir=config.CACHE_DIR, 
    output_dir=config.OUTPUT_DIR
)

# Initialize Services
ocr_service = OCRService(config.AZURE_ENDPOINT, config.AZURE_KEY, file_manager)
hierarchy_correction_service = HierarchyCorrectionService(file_manager)
flattener_service = FlattenerService(file_manager)

# Create database tables on startup if they don't exist
@app.on_event("startup")
async def startup_event():
    print("Creating database tables...")
    create_db_tables()
    print("Database tables created.")

# --- Background Task Handler for Full Pipeline ---
async def process_document_pipeline(document_id: str, local_pdf_path: str, db: Session):
    """
    Executes the full document processing pipeline: OCR -> Correction -> Flattening.
    Updates document status and stores results in the database using the provided 'db' session.
    """
    try:
        # --- Step 1: OCR and Initial Tree Generation ---
        print(f"Starting OCR for document: {document_id}")
        update_document_status(document_id, "OCR_IN_PROGRESS", db=db)
        
        initial_tree_data, page_dims_pydantic = await ocr_service.run_ocr_and_build_tree(local_pdf_path, document_id)
        
        if not initial_tree_data or not page_dims_pydantic:
            raise Exception("OCR and initial tree/page dimensions generation failed.")
        
        update_document_status(
            document_id, 
            "OCR_COMPLETED", 
            db=db,
            raw_ocr_result=ocr_service.raw_azure_result,
            initial_tree_data=initial_tree_data,
            page_dimensions_data=page_dims_pydantic
        )
        print(f"OCR completed for document: {document_id}")

        # --- Step 2: Hierarchy Correction ---
        print(f"Starting hierarchy correction for document: {document_id}")
        update_document_status(document_id, "CORRECTION_IN_PROGRESS", db=db)
        
        # Fetch data needed for correction from DB
        doc_record = get_document_record(document_id, db=db)
        if not doc_record: raise Exception("Document record lost before correction.")

        # --- IMPORTANT: Await the correct_hierarchy call here ---
        corrected_tree_data = await hierarchy_correction_service.correct_hierarchy(
            document_id, 
            doc_record.initial_tree_data # Use data from DB
        )
        if not corrected_tree_data:
            raise Exception("Hierarchy correction failed.")
        
        update_document_status(document_id, "CORRECTION_COMPLETED", db=db, corrected_tree_data=corrected_tree_data)
        print(f"Hierarchy correction completed for document: {document_id}")

        # --- Step 3: Flattening for UI ---
        print(f"Starting flattening for document: {document_id}")
        update_document_status(document_id, "FLATTENING_IN_PROGRESS", db=db)
        
        # Fetch data needed for flattening from DB
        # doc_record is already fetched above, reuse it
        page_dims_from_db = doc_record.page_dimensions_data 
        
        final_doc_state = await flattener_service.flatten_tree(
            document_id, 
            doc_record.corrected_tree_data, # Use corrected tree data from DB
            page_dimensions_list=page_dims_from_db
        )
        if not final_doc_state:
            raise Exception("Flattening failed.")
        
        update_document_status(document_id, "COMPLETED", db=db, final_document_state=final_doc_state)
        print(f"Document processing completed successfully for: {document_id}")

    except Exception as e:
        print(f"Error processing document {document_id}: {e}")
        update_document_status(document_id, "FAILED", db=db, error_message=str(e))
    finally:
        file_manager.cleanup_pdf(document_id)
        print(f"Cleanup finished for document: {document_id}")

# --- Helper function to close the DB session ---
def close_db_session(db: Session):
    """Utility function to close a SQLAlchemy session."""
    if db: # Ensure db is not None before closing
        db.close()
        print("Database session closed for background task.")

# --- API Endpoints ---

@app.post("/upload-pdf/", response_model=DocumentUploadResponse, status_code=202)
async def upload_pdf(
    file: UploadFile = File(...),
    background_tasks: BackgroundTasks = BackgroundTasks(),
    db: Session = Depends(get_db) # This db session is for the upload_pdf endpoint itself
):
    """
    Uploads a PDF document, saves it, and initiates the background processing pipeline.
    Returns the documentId immediately.
    """
    if not file.filename.lower().endswith(".pdf"):
        raise HTTPException(status_code=400, detail="Only PDF files are allowed.")

    # Generate a unique document ID
    doc_id = file_manager.generate_unique_doc_id(file.filename)
    local_pdf_path = file_manager.get_pdf_path(doc_id)

    # Save the uploaded PDF locally
    try:
        file_content = await file.read()
        file_manager.save_file(file_content, local_pdf_path)
        print(f"PDF saved to: {local_pdf_path} for doc_id: {doc_id}")
    except Exception as e:
        # If saving fails, raise HTTPException, no need to clean up as file wasn't saved
        raise HTTPException(status_code=500, detail=f"Could not save file: {e}")
    finally:
        # Ensure file handle is closed
        await file.close()

    # Create an initial record in the database *after* successfully saving the file.
    # This ensures the record is created only if the file is available.
    created_doc = create_document_record(doc_id, file.filename, local_pdf_path, db=db)
    if not created_doc:
        # If DB record creation fails, the file might still exist. Clean it up.
        file_manager.cleanup_pdf(doc_id)
        raise HTTPException(status_code=500, detail="Failed to create document record in database.")

    # Get a NEW database session for the background task.
    # SessionLocal is now correctly imported from database.database.
    db_session_for_task = SessionLocal() 
    
    try:
        # Start processing in the background, passing the NEW DB session, doc_id, and local_pdf_path.
        background_tasks.add_task(process_document_pipeline, doc_id, local_pdf_path, db_session_for_task)
        # Add a task to ensure the session is closed after the pipeline is done.
        # This task will execute when the background task finishes (or errors out).
        background_tasks.add_task(close_db_session, db_session_for_task) 
    except Exception as e:
        # If adding the task fails, ensure the session is closed.
        db_session_for_task.close() 
        # Also clean up the file since the background process couldn't be started.
        file_manager.cleanup_pdf(doc_id)
        raise HTTPException(status_code=500, detail=f"Failed to initiate background task: {e}")

    return DocumentUploadResponse(
        documentId=doc_id,
        message="PDF uploaded successfully. Processing started in the background."
    )

@app.get("/document-status/{document_id}", response_model=DocumentStatusResponse)
async def get_document_status(document_id: str, db: Session = Depends(get_db)):
    """
    Retrieves the current status and results (including final state if completed)
    of a document processing job.
    """
    document = get_document_record(document_id, db=db)
    if not document:
        raise HTTPException(status_code=404, detail="Document not found.")

    # Deserialize final_document_state from JSON (dict) to Pydantic model if it exists
    final_data_pydantic = None
    if document.final_document_state:
        try:
            # Ensure it's parsed correctly into the DocumentState model
            final_data_pydantic = DocumentState(**document.final_document_state)
        except Exception as e:
            print(f"Error parsing final_document_state for {document_id}: {e}")
            # Return status but indicate data parsing error if possible, or just return partial status
            return DocumentStatusResponse(
                documentId=document.id,
                filename=document.filename,
                status=document.status,
                progress=f"DATA_ERROR: {document.status}",
                finalData=None,
                errorMessage=f"Could not load final document state: {e}"
            )

    return DocumentStatusResponse(
        documentId=document.id,
        filename=document.filename,
        status=document.status,
        progress=document.status, # For MVP, status indicates progress
        finalData=final_data_pydantic, # This is now the full DocumentState Pydantic model
        errorMessage=document.error_message
    )

@app.post("/save-document-state/", status_code=200)
async def save_document_state(
    state: DocumentState, # Pydantic model automatically validates incoming JSON
    db: Session = Depends(get_db)
):
    """
    Receives the current document state from the frontend (including user edits,
    history, UI state) and persists it to the database.
    """
    doc_id = state.documentId
    existing_doc = get_document_record(doc_id, db=db)
    if not existing_doc:
        raise HTTPException(status_code=404, detail=f"Document with ID {doc_id} not found.")

    try:
        # The 'state' object is already a Pydantic model, ready to be saved
        saved_doc = save_frontend_state(doc_id, state, db=db)
        if not saved_doc:
             raise Exception("Failed to update document in database.")
        
        return {"message": f"Document state for {doc_id} saved successfully.", "documentId": doc_id}
    except Exception as e:
        print(f"Error saving document state for {doc_id}: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to save document state: {e}")