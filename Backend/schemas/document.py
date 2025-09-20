# # schemas/document.py
# from typing import List, Optional, Dict, Any, Union, Literal
# from pydantic import BaseModel, Field, conlist
# import datetime

# # --- Bounding Box & Page Dimensions ---
# class BoundingBox(BaseModel):
#     x: float
#     y: float
#     width: float
#     height: float

# class PageDimensions(BaseModel):
#     pageNumber: int = Field(..., alias="page_number")
#     width: float
#     height: float

# # --- Paragraph Enrichment (AI-generated info) ---
# class ParagraphEnrichment(BaseModel):
#     summary: Optional[str] = None
#     keywords: Optional[List[str]] = None
#     # Add other AI-generated enrichments here as needed

# # --- Core Paragraph Structure (Frontend/Backend Universal) ---
# class AnalyzedParagraph(BaseModel):
#     id: str
#     parentId: Optional[str] = None
#     content: str
#     role: str # e.g., "title", "sectionHeading", "paragraph", "table"
#     level: int # Hierarchical level (0 for documentRoot, 1 for title, etc.)
#     boundingBox: Optional[BoundingBox] = None
#     pageNumber: Optional[int] = Field(None, alias="page_number")
#     enrichment: Optional[ParagraphEnrichment] = None
    
#     # Fields specific to user modifications (e.g., merge)
#     isMerged: Optional[bool] = False
#     sourceIds: Optional[List[str]] = None # Original IDs that were merged into this

#     class Config:
#         populate_by_name = True # Allow setting fields by alias as well as actual name
#         json_schema_extra = {
#             "example": {
#                 "id": "para-1",
#                 "parentId": "para-root",
#                 "content": "The Future of Renewable Energy",
#                 "role": "title",
#                 "level": 1,
#                 "boundingBox": {"x": 1.5, "y": 1.0, "width": 5.5, "height": 0.5},
#                 "pageNumber": 1
#             }
#         }

# # --- History Actions ---

# class AIActionPayload(BaseModel):
#     ids: conlist(str, min_length=1) # List of paragraph IDs involved
#     newParagraph: AnalyzedParagraph # The resulting new paragraph
#     prompt: Optional[str] = None
#     customInstructions: Optional[str] = None

# class EditActionPayload(BaseModel):
#     id: str # ID of the paragraph edited
#     oldContent: str
#     newContent: str

# class SplitActionPayload(BaseModel):
#     id: str # ID of the paragraph that was split
#     newParagraphs: conlist(AnalyzedParagraph, min_length=2) # The resulting new paragraphs

# class DeleteActionPayload(BaseModel):
#     id: str # ID of the paragraph deleted

# # Generic History Action Payload (using Union for different types)
# class HistoryActionPayload(BaseModel):
#     type: Literal["AI_MERGE", "EDIT_CONTENT", "SPLIT_PARAGRAPH", "DELETE_PARAGRAPH", "CUSTOM_ACTION"]
#     # We use a Union to allow Pydantic to automatically cast to the correct sub-model
#     payload: Union[AIActionPayload, EditActionPayload, SplitActionPayload, DeleteActionPayload, Dict[str, Any]]

# class HistoryEntry(BaseModel):
#     type: str # Redundant with HistoryActionPayload.type, but useful for frontend
#     timestamp: datetime.datetime = Field(default_factory=datetime.datetime.now)
#     payload: HistoryActionPayload

# # --- UI State ---
# class UIState(BaseModel):
#     currentView: Optional[str] = None # e.g., "TABLE", "GRAPH", "TEXT"
#     selectedIds: Optional[List[str]] = None # Currently selected paragraph IDs
#     # Add other UI-specific state variables as needed

# # --- Frontend Document State (Combined Input/Output Model) ---
# class DocumentState(BaseModel):
#     documentId: str
#     pageDimensions: List[PageDimensions]
#     paragraphs: List[AnalyzedParagraph]
#     history: Optional[List[HistoryEntry]] = Field(default_factory=list)
#     uiState: Optional[UIState] = None

#     # These fields are often sent by the frontend but might not be
#     # critical for the backend to persist, or are derived.
#     # We include them to match the expected input payload, but treat as optional.
#     initialParagraphs: Optional[List[AnalyzedParagraph]] = Field(default_factory=list)
#     mergeSuggestions: Optional[List[conlist(str, min_length=2)]] = Field(default_factory=list)

#     class Config:
#         populate_by_name = True # Allow setting fields by alias
#         json_schema_extra = {
#             "example": {
#                 "documentId": "DPECL1600123AE79B7B546C94715AA8468B0811096F5",
#                 "pageDimensions": [
#                     {"pageNumber": 1, "width": 8.5, "height": 11.0}
#                 ],
#                 "paragraphs": [
#                     {
#                         "id": "para-root",
#                         "parentId": None,
#                         "content": "Document Root",
#                         "role": "documentRoot",
#                         "level": 0,
#                         "boundingBox": None,
#                         "pageNumber": None
#                     },
#                     {
#                         "id": "para-1",
#                         "parentId": "para-root",
#                         "content": "The Future of Renewable Energy",
#                         "role": "title",
#                         "level": 1,
#                         "boundingBox": {"x": 1.5, "y": 1.0, "width": 5.5, "height": 0.5},
#                         "pageNumber": 1
#                     }
#                 ],
#                 "history": [],
#                 "uiState": {"currentView": "TABLE"},
#                 "initialParagraphs": [],
#                 "mergeSuggestions": []
#             }
#         }


# # --- API Specific Responses ---

# class DocumentUploadResponse(BaseModel):
#     documentId: str
#     message: str

# class DocumentStatusResponse(BaseModel):
#     documentId: str
#     filename: str
#     status: str
#     progress: str # Can be more granular than status
#     finalData: Optional[DocumentState] = None # Now holds the full DocumentState
#     errorMessage: Optional[str] = None

# schemas/document.py
from typing import List, Optional, Dict, Any, Union, Literal
from pydantic import BaseModel, Field, conlist
import datetime

# --- Bounding Box & Page Dimensions ---
class BoundingBox(BaseModel):
    x: float
    y: float
    width: float
    height: float

    class Config:
        populate_by_name = True

class PageDimensions(BaseModel):
    pageNumber: int = Field(..., alias="page_number")
    width: float
    height: float

    class Config:
        populate_by_name = True

# --- Paragraph Enrichment (AI-generated info) ---
class ParagraphEnrichment(BaseModel):
    summary: Optional[str] = None
    keywords: Optional[List[str]] = None
    role: Optional[str] = None

# --- Core Paragraph Structure (Frontend/Backend Universal) ---
class AnalyzedParagraph(BaseModel):
    id: str
    parentId: Optional[str] = Field(None, alias="parent_id")
    content: str
    role: str
    level: int
    boundingBox: Optional[Union[BoundingBox, Dict[str, Any]]] = Field(None, alias="bounding_box")
    pageNumber: Optional[int] = Field(None, alias="page_number")
    enrichment: Optional[ParagraphEnrichment] = None
    
    # Handle both snake_case and camelCase versions
    isMerged: Optional[bool] = Field(False, alias="is_merged")
    sourceIds: Optional[List[str]] = Field(None, alias="source_ids")

    class Config:
        populate_by_name = True

# --- History Actions ---
class AIActionPayload(BaseModel):
    ids: conlist(str, min_length=1)
    # Handle both naming conventions
    newParagraph: Union[AnalyzedParagraph, Dict[str, Any]] = Field(..., alias="new_paragraph")
    prompt: Optional[str] = None
    customInstructions: Optional[str] = Field(None, alias="custom_instructions")

    class Config:
        populate_by_name = True

# Add Simple Merge Payload class that your JSON uses
class SimpleMergeActionPayload(BaseModel):
    ids: conlist(str, min_length=1)
    newParagraph: Union[AnalyzedParagraph, Dict[str, Any]] = Field(..., alias="new_paragraph")

    class Config:
        populate_by_name = True

class EditActionPayload(BaseModel):
    id: str
    oldContent: str = Field(..., alias="old_content")
    newContent: str = Field(..., alias="new_content")

    class Config:
        populate_by_name = True

class SplitActionPayload(BaseModel):
    id: str
    newParagraphs: Union[conlist(AnalyzedParagraph, min_length=2), List[Dict[str, Any]]] = Field(..., alias="new_paragraphs")

    class Config:
        populate_by_name = True

class DeleteActionPayload(BaseModel):
    id: str

# --- Flexible payload handling ---
class HistoryActionPayload(BaseModel):
    type: Literal["AI_MERGE", "EDIT_CONTENT", "SPLIT_PARAGRAPH", "DELETE_PARAGRAPH", "CUSTOM_ACTION", "SIMPLE_MERGE"]
    payload: Union[AIActionPayload, EditActionPayload, SplitActionPayload, DeleteActionPayload, SimpleMergeActionPayload, Dict[str, Any]]

class HistoryEntry(BaseModel):
    type: str
    timestamp: Optional[Union[datetime.datetime, str]] = Field(default_factory=lambda: datetime.datetime.now().isoformat())
    # Make payload more flexible to handle your JSON structure
    payload: Union[HistoryActionPayload, Dict[str, Any]]
    
    class Config:
        populate_by_name = True
        json_encoders = {
            datetime.datetime: lambda v: v.isoformat()
        }

# --- UI State ---
class UIState(BaseModel):
    currentView: Optional[str] = Field(None, alias="current_view")
    selectedIds: Optional[List[str]] = Field(None, alias="selected_ids")

    class Config:
        populate_by_name = True

# --- Frontend Document State (Combined Input/Output Model) ---
class DocumentState(BaseModel):
    documentId: str = Field(..., alias="document_id")
    pageDimensions: List[PageDimensions] = Field(..., alias="page_dimensions")
    paragraphs: List[AnalyzedParagraph]
    
    # More flexible history handling - your JSON has raw dict structure
    history: Optional[List[Union[HistoryEntry, Dict[str, Any]]]] = Field(default_factory=list)
    uiState: Optional[Union[UIState, Dict[str, Any]]] = Field(None, alias="ui_state")

    # Optional fields that might be missing
    initialParagraphs: Optional[List[Union[AnalyzedParagraph, Dict[str, Any]]]] = Field(default_factory=list, alias="initial_paragraphs")
    mergeSuggestions: Optional[List[Union[List[str], conlist(str, min_length=2), Any]]] = Field(default_factory=list, alias="merge_suggestions")

    class Config:
        populate_by_name = True
        extra = "ignore"  # Ignore extra fields not defined in model
        json_encoders = {
            datetime.datetime: lambda v: v.isoformat()
        }

# --- API Specific Responses ---
class DocumentUploadResponse(BaseModel):
    documentId: str
    message: str

class DocumentStatusResponse(BaseModel):
    documentId: str
    filename: str
    status: str
    progress: str
    finalData: Optional[DocumentState] = None
    errorMessage: Optional[str] = None