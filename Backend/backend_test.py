# test_upload.py
import requests
import time
import json
import os

# --- Configuration ---
UPLOAD_URL = "http://127.0.0.1:8000/upload-pdf/"
STATUS_URL_TEMPLATE = "http://127.0.0.1:8000/document-status/{document_id}"
SAVE_STATE_URL = "http://127.0.0.1:8000/save-document-state/"

PDF_FILE_PATH = "Obaid_Tamboli_CV.pdf" # Make sure this PDF exists in the same directory
POLL_INTERVAL_SECONDS = 90
MAX_POLL_ATTEMPTS = 12 # Poll for up to 1 minute (12 * 5 seconds)

# --- Helper Functions ---

def upload_pdf(file_path: str) -> str | None:
    """Uploads a PDF and returns the document ID if successful."""
    if not os.path.exists(file_path):
        print(f"Error: PDF file not found at '{file_path}'")
        return None

    print(f"Uploading PDF: {file_path}...")
    try:
        with open(file_path, 'rb') as f:
            files = {'file': (os.path.basename(file_path), f, 'application/pdf')}
            response = requests.post(UPLOAD_URL, files=files)
        
        response.raise_for_status() # Raise an exception for bad status codes (4xx or 5xx)
        
        data = response.json()
        document_id = data.get("documentId")
        if document_id:
            print(f"PDF uploaded successfully. Document ID: {document_id}")
            return document_id
        else:
            print(f"Upload response missing documentId. Response: {data}")
            return None
            
    except requests.exceptions.RequestException as e:
        print(f"Error during PDF upload: {e}")
        return None
    except json.JSONDecodeError:
        print(f"Error decoding JSON response from upload. Response text: {response.text}")
        return None

def check_document_status(document_id: str) -> dict | None:
    """Checks the status of a document processing job."""
    if not document_id:
        return None
        
    url = STATUS_URL_TEMPLATE.format(document_id=document_id)
    print(f"Checking status for Document ID: {document_id} at {url}...")
    try:
        response = requests.get(url)
        response.raise_for_status()
        return response.json()
    except requests.exceptions.RequestException as e:
        print(f"Error checking status for {document_id}: {e}")
        return None
    except json.JSONDecodeError:
        print(f"Error decoding JSON response from status check. Response text: {response.text}")
        return None

def poll_for_completion(document_id: str) -> dict | None:
    """Polls the status endpoint until the document is completed or failed."""
    if not document_id:
        return None
        
    attempts = 0
    while attempts < MAX_POLL_ATTEMPTS:
        status_data = check_document_status(document_id)
        
        if not status_data:
            print(f"Failed to get status for {document_id}. Aborting poll.")
            return None

        status = status_data.get("status")
        print(f"Status for {document_id}: {status} (Attempt {attempts + 1}/{MAX_POLL_ATTEMPTS})")

        if status in ["COMPLETED", "EDITED", "FAILED"]:
            print(f"Processing finished for {document_id} with status: {status}")
            return status_data
        
        attempts += 1
        time.sleep(POLL_INTERVAL_SECONDS)
    
    print(f"Polling timed out after {MAX_POLL_ATTEMPTS} attempts for {document_id}.")
    return check_document_status(document_id) # Return the last known status


def save_modified_state(document_id: str, document_state: dict) -> dict | None:
    """Sends the modified document state back to the backend."""
    if not document_id or not document_state:
        print("Invalid document_id or document_state for saving.")
        return None

    print(f"Saving modified state for Document ID: {document_id}...")
    try:
        response = requests.post(SAVE_STATE_URL, json=document_state)
        response.raise_for_status()
        data = response.json()
        print(f"State saved successfully. Response: {data}")
        return data
    except requests.exceptions.RequestException as e:
        print(f"Error saving state for {document_id}: {e}")
        return None
    except json.JSONDecodeError:
        print(f"Error decoding JSON response from save state. Response text: {response.text}")
        return None

# --- Main Test Logic ---

def main():
    # --- Step 1: Upload the PDF ---
    doc_id = upload_pdf(PDF_FILE_PATH)
    
    if not doc_id:
        print("Test failed: PDF upload did not return a document ID.")
        return

    # --- Step 2: Poll for processing completion ---
    final_status_data = poll_for_completion(doc_id)

    if not final_status_data:
        print("Test failed: Could not determine final processing status.")
        return

    # --- Step 3: Verify final status and data ---
    status = final_status_data.get("status")
    final_data = final_status_data.get("finalData")

    if status == "COMPLETED":
        print("\n--- Processing SUCCEEDED ---")
        print(f"Document ID: {doc_id}")
        print(f"Filename: {final_status_data.get('filename')}")
        
        if final_data:
            print("\n--- Final Document State Received ---")
            # Print key details from the final data
            print(f"Document ID in state: {final_data.get('documentId')}")
            print(f"Number of paragraphs: {len(final_data.get('paragraphs', []))}")
            print(f"Number of page dimensions: {len(final_data.get('pageDimensions', []))}")
            
            # Optional: Print first few paragraphs and page dimensions
            print("\nFirst 3 paragraphs:")
            for i, para in enumerate(final_data.get('paragraphs', [])[:3]):
                print(f"  - [{para.get('id')}] Role: {para.get('role')}, Level: {para.get('level')}, Content: \"{para.get('content')[:50]}...\"")
            
            print("\nPage Dimensions:")
            for page_dim in final_data.get('pageDimensions', []):
                print(f"  - Page {page_dim.get('pageNumber')}: Width={page_dim.get('width')}, Height={page_dim.get('height')}")
            
            # --- Step 4 (Optional): Simulate User Edit and Save ---
            # Find the first actual paragraph (not the root) to modify
            paragraphs = final_data.get('paragraphs', [])
            # Find first paragraph that is not document root and has content
            target_paragraph_index = -1
            for i, p in enumerate(paragraphs):
                if p.get('id') != 'para-root' and p.get('content') and p.get('role') != 'documentRoot':
                    target_paragraph_index = i
                    break

            if target_paragraph_index != -1:
                print("\n--- Simulating User Edit and Save ---")
                original_paragraph = paragraphs[target_paragraph_index]
                
                # Create a copy to modify
                modified_paragraph_data = original_paragraph.copy()
                modified_paragraph_data['content'] = f"[EDITED BY TEST] {modified_paragraph_data['content']}"
                modified_paragraph_data['role'] = 'paragraph' # Ensure role consistency if modified
                modified_paragraph_data['isMerged'] = False # Reset merge flag for a simple edit
                modified_paragraph_data['sourceIds'] = None
                
                # Simulate an edit history entry
                edit_history_entry = {
                    "type": "EDIT_CONTENT",
                    "payload": {
                        "id": modified_paragraph_data['id'],
                        "oldContent": original_paragraph.get('content'),
                        "newContent": modified_paragraph_data['content']
                    }
                }
                
                # Construct the new DocumentState to send back
                new_document_state = DocumentState(**final_data) # Convert dict to Pydantic model
                new_document_state.paragraphs[target_paragraph_index] = AnalyzedParagraph(**modified_paragraph_data) # Update the paragraph
                new_document_state.history.append(HistoryEntry(type="EDIT_CONTENT", payload=HistoryActionPayload(type="EDIT_CONTENT", payload=EditActionPayload(**edit_history_entry['payload']))))
                new_document_state.uiState.selectedIds = [modified_paragraph_data['id']] # Select the modified paragraph
                
                # Add some mock page dimensions and initial paragraphs if they were missing in the state
                if not new_document_state.pageDimensions:
                    new_document_state.pageDimensions = [PageDimensions(pageNumber=1, width=8.5, height=11.0)]
                if not new_document_state.initialParagraphs:
                    new_document_state.initialParagraphs = [AnalyzedParagraph(**p) for p in final_data.get('paragraphs', []) if p.get('id') != 'para-root'] # Mock initial paragraphs

                save_response = save_modified_state(doc_id, new_document_state.model_dump(by_alias=True))
                if save_response:
                    print("--- User Edit and Save Test SUCCESSFUL ---")
                    # You could optionally re-fetch status to see "EDITED" status
                    # final_status_after_save = check_document_status(doc_id)
                    # print(f"Status after save: {final_status_after_save.get('status')}")
                else:
                    print("--- User Edit and Save Test FAILED ---")

            else:
                print("\nCould not find a suitable paragraph to simulate editing.")
                print("--- Processing SUCCEEDED, but edit test skipped ---")

        else:
            print("Processing COMPLETED, but no 'finalData' received.")
            print("--- Test Partially SUCCEEDED ---")

    elif status == "EDITED": # This means it was edited and saved correctly
        print("\n--- Document state was successfully SAVED (EDITED) ---")
        print(f"Document ID: {doc_id}")
        # You could print details about the edited state here if needed

    elif status == "FAILED":
        print("\n--- Processing FAILED ---")
        print(f"Document ID: {doc_id}")
        print(f"Error Message: {final_status_data.get('errorMessage')}")
        print("--- Test FAILED ---")

    else:
        print(f"\n--- Unexpected final status: {status} ---")
        print("--- Test FAILED ---")


if __name__ == "__main__":
    main()

# ---

# **How to Use:**

# 1.  **Save:** Save the code above as `test_upload.py` in the root of your `document-pipeline-backend` directory (or anywhere you have access to `requests` and your running `uvicorn` server).
# 2.  **Create Test PDF:** Make sure you have a file named `test_document.pdf` in the same directory as `test_upload.py`.
# 3.  **Start Backend:** Ensure your FastAPI application is running:
#     ```bash
#     uvicorn main:app --reload
#     ```
# 4.  **Run Test Script:** Open a *new* terminal window (or deactivate your current venv and re-activate it if you don't want the `uvicorn` process running there), navigate to the directory where you saved `test_upload.py`, and run:
#     ```bash
#     python test_upload.py
#     ```

# **What the Script Does:**

# *   **Configuration:** Sets up URLs, file path, and polling intervals.
# *   **`upload_pdf()`:**
#     *   Opens the `test_document.pdf` in binary read mode.
#     *   Creates a `files` dictionary suitable for `requests`' `multipart/form-data` upload.
#     *   Sends a `POST` request to `/upload-pdf/`.
#     *   Checks for HTTP errors and JSON decoding errors.
#     *   Returns the `documentId` from the successful upload response.
# *   **`check_document_status()`:**
#     *   Takes a `document_id` and sends a `GET` request to the `/document-status/{document_id}` endpoint.
#     *   Returns the JSON status data.
# *   **`poll_for_completion()`:**
#     *   Repeatedly calls `check_document_status()` at intervals.
#     *   Stops when the status is "COMPLETED", "EDITED", or "FAILED", or if a timeout occurs.
# *   **`save_modified_state()`:**
#     *   Takes a `document_id` and a full `document_state` dictionary.
#     *   Sends a `POST` request to `/save-document-state/` with the state as JSON.
# *   **`main()` Function:**
#     *   **Upload:** Calls `upload_pdf()` to start the process.
#     *   **Poll:** Calls `poll_for_completion()` to wait for the result.
#     *   **Verify:** Checks the final status.
#         *   If "COMPLETED", it prints details about the received `finalData` (paragraphs, page dimensions).
#         *   It then includes an **optional section** to simulate a user edit:
#             *   It finds the first valid paragraph.
#             *   It modifies its content and creates a mock `history` entry.
#             *   It constructs a new `DocumentState` object with the modification.
#             *   It calls `save_modified_state()` to send this edited state back to the server.
#         *   If "FAILED", it prints the error message.
#         *   If "EDITED", it indicates that the save operation was successful.

# This test script provides a good end-to-end validation for your document upload and processing flow, including the new state-saving mechanism.