Okay, let's document the structure and functions that are crucial for modifications, focusing on how they enable backend logic to interact with the document's state. This documentation will help you understand how to extend, modify, or debug the system.

in the Backend folder-
myenv (uvicorn main:app --reload)

Backend/
├── main.py
├── config.py
├── database/
│   ├── models.py
│   ├── crud.py
│   └── database.py
├── services/
│   ├── ocr_service.py
│   ├── hierarchy_correction_service.py
│   └── flattener_service.py
├── schemas/
│   └── document.py
├── utils/
│   └── file_manager.py
├── requirements.txt
└── .env

---

## Document Structure and Modification Functions Documentation

This document outlines the core data structures and functions that form the backbone of our document processing pipeline, focusing on their roles in representing, modifying, and persisting document states.

### 1. Core Data Structures

These structures define how document data is represented, both in transit (between frontend/backend) and at rest (in the database).

#### a) Pydantic Models (`schemas/document.py`)

These models provide data validation, serialization/deserialization, and type safety for all document-related data. They are the single source of truth for what the API expects and returns.

*   **`BoundingBox`**:
    *   **Purpose:** Represents the rectangular area of an element on a page.
    *   **Fields:** `x`, `y`, `width`, `height` (all floats).
    *   **Usage:** Used by `AnalyzedParagraph` to define the spatial location of content.

*   **`PageDimensions`**:
    *   **Purpose:** Stores the dimensions of a specific page in the document.
    *   **Fields:** `pageNumber` (int), `width` (float), `height` (float).
    *   **Usage:** Provided by OCR, essential for frontend rendering and understanding spatial context.

*   **`ParagraphEnrichment`**:
    *   **Purpose:** Holds AI-generated metadata for a paragraph.
    *   **Fields:** `summary` (str, optional), `keywords` (List[str], optional), etc.
    *   **Usage:** Stores results from LLM processing (like summaries generated during merges or edits).

*   **`AnalyzedParagraph`**:
    *   **Purpose:** The fundamental unit representing a piece of content (title, heading, paragraph, table, etc.) in a flattened, structured format. This is the core item modified by users.
    *   **Fields:**
        *   `id`: Unique identifier for this paragraph (e.g., "para-123").
        *   `parentId`: The `id` of the paragraph this one belongs to in the hierarchy (null for root elements).
        *   `content`: The actual text or representation of the content.
        *   `role`: Categorization (e.g., "title", "sectionHeading", "paragraph", "table").
        *   `level`: Hierarchical depth (0 for document root, 1 for main sections, etc.).
        *   `boundingBox`: `BoundingBox` object defining its location on the page.
        *   `pageNumber`: The page where this paragraph primarily resides.
        *   `enrichment`: `ParagraphEnrichment` object for AI-generated data.
        *   `isMerged`: Boolean flag indicating if this paragraph is a result of a merge operation.
        *   `sourceIds`: List of original `id`s that were merged into this one.
    *   **Usage:** This is the primary object in the `paragraphs` array of `DocumentState`. It directly reflects user modifications.

*   **`AIActionPayload` / `EditActionPayload` / `SplitActionPayload` / `DeleteActionPayload`**:
    *   **Purpose:** Define the structure of data associated with specific types of user or AI actions performed on paragraphs.
    *   **Usage:** These are embedded within `HistoryEntry`. They detail *what* changed, *which* paragraphs were affected, and *how*.

*   **`HistoryEntry`**:
    *   **Purpose:** Represents a single action taken by the user or the system (e.g., merging paragraphs, editing content, deleting a section).
    *   **Fields:** `type` (e.g., "AI\_MERGE", "EDIT\_CONTENT"), `timestamp`, `payload` (containing the specific action details).
    *   **Usage:** Forms the `history` array in `DocumentState`, enabling audit trails and state restoration.

*   **`UIState`**:
    *   **Purpose:** Stores front-end specific state that the backend can persist for user convenience.
    *   **Fields:** `currentView`, `selectedIds` (list of paragraph IDs), etc.
    *   **Usage:** Allows saving the user's exact view (e.g., which paragraphs are selected, what view mode they were in) so it can be restored later.

*   **`DocumentState`**:
    *   **Purpose:** The **master object** representing the entire state of a document, including its content, hierarchy, user modifications, history, and UI context. This is the primary object that is sent *to* and received *from* the frontend for saving.
    *   **Fields:**
        *   `documentId`: Unique identifier for the document.
        *   `pageDimensions`: List of `PageDimensions` for the document.
        *   `paragraphs`: List of `AnalyzedParagraph` objects in their flattened, potentially modified state.
        *   `history`: List of `HistoryEntry` objects detailing all changes.
        *   `uiState`: `UIState` object for front-end context.
        *   `initialParagraphs` (optional, frontend sent): Original paragraphs before edits.
        *   `mergeSuggestions` (optional, frontend sent): User-provided suggestions.
    *   **Usage:** The central piece of data for user sessions and persistence.

#### b) SQLAlchemy Models (`database/models.py`)

These define the schema for our database tables.

*   **`Document`**:
    *   **Purpose:** Represents a single document being processed and managed by the backend.
    *   **Fields:**
        *   `id` (PK): The unique `documentId` (string).
        *   `filename`: Original filename (string).
        *   `file_path`: Server path to the temporary PDF (string).
        *   `status`: Current state of processing (e.g., "UPLOADED", "COMPLETED", "FAILED", "EDITED") (string).
        *   `created_at`, `updated_at`: Timestamps.
        *   `raw_ocr_result` (JSON): The raw output from Azure Document Intelligence. Useful for debugging or reprocessing.
        *   `initial_tree_data` (JSON): The hierarchical tree generated *before* LLM correction.
        *   `corrected_tree_data` (JSON): The hierarchical tree *after* LLM correction.
        *   `final_document_state` (JSON): **Crucially, this stores the entire `DocumentState` object** (as a dictionary) as received from or last saved by the frontend. This is the source of truth for user modifications.
        *   `page_dimensions_data` (JSON): A list of page dimensions, stored separately for quicker access.
        *   `error_message` (string, optional): Details if processing failed.
        *   `is_edited` (Boolean): Flag indicating if the user has made changes to the `final_document_state`.
    *   **Usage:** All document-related data, including intermediate steps and the final user-editable state, are persisted here.

---

### 2. Core Functions for Modification and Data Handling

These functions orchestrate the process and manage the flow of data.

#### a) Services (`services/`)

These modules contain the core business logic for each stage of processing.

*   **`OCRService` (`services/ocr_service.py`)**:
    *   **`run_ocr_and_build_tree(pdf_path, document_id)` (async)**:
        *   Handles interaction with Azure Document Intelligence for OCR.
        *   Caches OCR results for performance.
        *   Extracts `raw_ocr_result` and `page_dimensions_data`.
        *   Builds an `initial_tree_data` structure from Azure's output.
        *   Returns the `initial_tree_data` and `page_dimensions_data`.
    *   **Modification Relevance:** This is the starting point. It provides the base data (`initial_tree_data`) that will be modified in subsequent steps.

*   **`HierarchyCorrectionService` (`services/hierarchy_correction_service.py`)**:
    *   **`correct_hierarchy(document_id, initial_tree_data)` (async)**:
        *   Uses the `AdvancedHierarchyValidator` to analyze and correct the document's hierarchical structure.
        *   **`AdvancedHierarchyValidator`**:
            *   Builds internal maps (`_node_map`, `_parent_map`, `_levels`) for efficient tree traversal.
            *   Formats prompts for LLM calls based on node relationships.
            *   Uses `_call_llm_with_retry` for robust LLM interactions (handles retries and validation).
            *   Performs bottom-up validation:
                *   **Promotion Check:** Determines if a child should become a sibling.
                *   **Demotion Check:** Determines if a sibling should become a child.
            *   Modifies the document tree structure *in place* (on a deep copy).
            *   Crucially, it performs these checks and structural modifications, resulting in a corrected `document_tree`.
        *   Returns the corrected hierarchical tree data.
    *   **Modification Relevance:** This service is key for *structural* modifications to the document's hierarchy, driven by AI analysis.

*   **`FlattenerService` (`services/flattener_service.py`)**:
    *   **`flatten_tree(document_id, corrected_tree_data, page_dimensions_list)` (async)**:
        *   Takes the corrected hierarchical tree and page dimensions.
        *   Recursively traverses the tree.
        *   Creates `AnalyzedParagraph` objects for each structural node (section heading) and each content item within.
        *   Populates `id`, `parentId`, `content`, `role`, `level`, `boundingBox`, and `pageNumber` for each `AnalyzedParagraph`.
        *   Assembles the final `DocumentState` object, including the `documentId`, `pageDimensions`, and the flattened `paragraphs` list. It initializes `history` and `uiState` as empty.
        *   Returns the complete `DocumentState` object.
    *   **Modification Relevance:** This function transforms the hierarchical, AI-corrected data into the flat list format expected by the frontend. While it doesn't directly perform user modifications, it sets up the initial structure into which user modifications will be applied.

#### b) Utility Functions (`utils/file_manager.py`)

*   **`FileManager`**:
    *   Provides methods for managing files (saving PDFs, caching OCR results, generating unique IDs, cleanup).
    *   **Modification Relevance:** Manages the lifecycle of the raw PDF file, which is an input to the modification pipeline.

#### c) Database CRUD Operations (`database/crud.py`)

These functions provide an interface for interacting with the `Document` table in the database.

*   **`create_document_record(...)`**: Creates a new entry for an uploaded document.
*   **`get_document_record(document_id, db)`**: Fetches a document record by its ID.
*   **`update_document_status(...)`**: Updates the `status` and stores intermediate results (`raw_ocr_result`, `initial_tree_data`, `corrected_tree_data`, `page_dimensions_data`).
*   **`save_frontend_state(document_id, state, db)`**: **This is the critical function for persisting user modifications.**
    *   It takes a `DocumentState` Pydantic model (containing potentially modified `paragraphs`, `history`, and `uiState`).
    *   It serializes the `DocumentState` into a dictionary and stores it in the `final_document_state` JSON column of the `Document` record.
    *   It updates the `status` to "EDITED" and sets the `is_edited` flag.
*   **Modification Relevance:** These are the interfaces for *saving* the results of processing stages and, most importantly, for *persisting* the `DocumentState` that includes all user-driven modifications.

---

### 3. Modification Flow and Key Functions

The process that allows for modifications typically flows from frontend to backend via the `POST /save-document-state/` endpoint.

#### a) Frontend Request to Backend

1.  **User Action:** The user performs an action in the UI (e.g., edits paragraph content, merges two paragraphs, deletes a section).
2.  **State Update:** The frontend updates its internal representation of the `DocumentState` accordingly. It also logs the action taken in the `history` array.
3.  **Backend Call:** The frontend sends the complete, modified `DocumentState` object (including the `documentId`) to the `POST /save-document-state/` endpoint.

#### b) Backend Handling (`main.py` - `save_document_state` endpoint)

1.  **Receive State:** FastAPI automatically validates the incoming JSON against the `DocumentState` Pydantic model using `state: DocumentState`.
2.  **Retrieve Existing Document:** It fetches the current `Document` record from the database using `get_document_record`.
3.  **Persist Changes:** It calls `save_frontend_state(doc_id, state, db)`.
    *   This function takes the validated `state` (which is a `DocumentState` Pydantic model).
    *   It converts the `DocumentState` model into a dictionary (`state.model_dump(by_alias=True)`).
    *   It saves this dictionary into the `final_document_state` JSON column of the `Document` table.
    *   It updates the document's `status` to "EDITED" and sets `is_edited` to `True`.
4.  **Respond:** A success message is returned to the frontend.

#### c) How Backend Reuses Modified Data

*   When the user later requests the document status (`GET /document-status/{document_id}`), the backend fetches the `Document` record.
*   It retrieves the `final_document_state` (which is a JSON dictionary from the DB).
*   It deserializes this JSON dictionary back into the `DocumentState` Pydantic model.
*   This fully reconstructed `DocumentState` (including all user edits, history, and UI state) is then returned to the frontend.

---

### Summary of Modification Pathways:

*   **Structural Modification (AI-driven):** Handled by `HierarchyCorrectionService` which outputs `corrected_tree_data`. This data is then flattened by `FlattenerService` into an initial `DocumentState` object, which is saved as `final_document_state`.
*   **Content/Structural Modification (User-driven):** Handled by the frontend, which generates a new `DocumentState`. This new state is then persisted by the backend via the `POST /save-document-state/` endpoint, specifically using the `save_frontend_state` CRUD function.

This layered approach ensures that data integrity is maintained, intermediate processing results are stored, and user modifications are reliably captured and restored.