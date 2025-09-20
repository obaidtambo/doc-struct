# database/models.py
from sqlalchemy import Column, String, JSON, DateTime, Boolean
from sqlalchemy.sql import func
from .database import Base

class Document(Base):
    __tablename__ = "documents"

    id = Column(String, primary_key=True, index=True) # Unique document ID
    filename = Column(String, index=True)
    file_path = Column(String) # Path to the original PDF on the server
    status = Column(String, default="UPLOADED") # UPLOADED, OCR_IN_PROGRESS, ..., FAILED, COMPLETED, EDITED

    created_at = Column(DateTime, default=func.now())
    updated_at = Column(DateTime, default=func.now(), onupdate=func.now())

    # --- Data storage for pipeline stages and final state ---
    # Store the full raw result from Azure Document Intelligence (for debugging/reprocessing)
    raw_ocr_result = Column(JSON, nullable=True)

    # The initial hierarchical tree structure after OCR, before LLM correction
    initial_tree_data = Column(JSON, nullable=True)

    # The corrected hierarchical tree structure after LLM correction
    corrected_tree_data = Column(JSON, nullable=True)

    # The FINAL comprehensive document state. This directly corresponds to the
    # DocumentState Pydantic model, including frontend modifications, history, etc.
    final_document_state = Column(JSON, nullable=True)

    # Optional: Store page dimensions separately for quick access without parsing full state
    page_dimensions_data = Column(JSON, nullable=True) # List of PageDimensions dictionaries

    # Error message if the processing failed at any stage
    error_message = Column(String, nullable=True)
    
    # Flag to indicate if the document has been modified by user interaction in the UI
    is_edited = Column(Boolean, default=False)