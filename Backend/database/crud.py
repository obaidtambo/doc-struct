# database/crud.py
from sqlalchemy.orm import Session
from .models import Document
from .database import SessionLocal # Import directly for internal use
from schemas.document import DocumentState, PageDimensions # Import our new schemas
from typing import List, Dict, Any, Optional

# Helper to get a DB session when not using FastAPI's dependency injection
def get_db_session():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()

def create_document_record(
    doc_id: str,
    filename: str,
    file_path: str,
    db: Session
) -> Document:
    db_document = Document(
        id=doc_id,
        filename=filename,
        file_path=file_path,
        status="UPLOADED"
    )
    db.add(db_document)
    db.commit()
    db.refresh(db_document)
    return db_document

def get_document_record(document_id: str, db: Session) -> Optional[Document]:
    return db.query(Document).filter(Document.id == document_id).first()

def update_document_status(
    document_id: str,
    status: str,
    db: Session,
    raw_ocr_result: Optional[Dict[str, Any]] = None,
    initial_tree_data: Optional[Dict[str, Any]] = None,
    corrected_tree_data: Optional[Dict[str, Any]] = None,
    page_dimensions_data: Optional[List[PageDimensions]] = None, # List of Pydantic objects
    final_document_state: Optional[DocumentState] = None, # Pydantic DocumentState object
    error_message: Optional[str] = None,
    is_edited: Optional[bool] = None
) -> Optional[Document]:
    db_document = db.query(Document).filter(Document.id == document_id).first()
    if db_document:
        db_document.status = status
        
        if raw_ocr_result is not None:
            db_document.raw_ocr_result = raw_ocr_result
        if initial_tree_data is not None:
            db_document.initial_tree_data = initial_tree_data
        if corrected_tree_data is not None:
            db_document.corrected_tree_data = corrected_tree_data
        
        if page_dimensions_data is not None:
            # Convert list of Pydantic models to list of dicts for JSON storage
            db_document.page_dimensions_data = [pd.model_dump(by_alias=True) for pd in page_dimensions_data]
        
        if final_document_state is not None:
            # Convert Pydantic DocumentState model to dict for JSON storage
            db_document.final_document_state = final_document_state.model_dump(by_alias=True)
        
        if error_message is not None:
            db_document.error_message = error_message
        
        if is_edited is not None:
            db_document.is_edited = is_edited

        db.add(db_document)
        db.commit()
        db.refresh(db_document)
    return db_document

def save_frontend_state(document_id: str, state: DocumentState, db: Session) -> Optional[Document]:
    db_document = db.query(Document).filter(Document.id == document_id).first()
    if db_document:
        # Store the entire DocumentState Pydantic model as a dictionary
        db_document.final_document_state = state.model_dump(by_alias=True)
        db_document.status = "EDITED" # Mark the document as edited by the user
        db_document.is_edited = True
        db.add(db_document)
        db.commit()
        db.refresh(db_document)
    return db_document

# Call this once at application startup to create tables
def create_db_tables():
    from .database import engine, Base
    Base.metadata.create_all(bind=engine)