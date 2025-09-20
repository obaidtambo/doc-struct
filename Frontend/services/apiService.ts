import { AppState } from '../state/reducer';
import { DocumentStatusResponse, DocumentState } from '../types';
import { keysToCamel, keysToSnake } from '../utils/caseConverter';
import Logger from './logger';

const API_BASE_URL = ''; // Assuming backend is served from the same origin

/**
 * A helper function to handle fetch requests and potential errors.
 * @param url The endpoint URL.
 * @param options The fetch options.
 * @returns The JSON response from the API.
 * @throws An error if the network response is not ok.
 */
const fetchApi = async (url: string, options: RequestInit = {}) => {
    Logger.api(`[API REQ] ${options.method || 'GET'} ${url}`, { options });
    try {
        const response = await fetch(url, options);

        if (!response.ok) {
            let errorMessage = `API Error: ${response.status} ${response.statusText}`;
            try {
                const errorBody = await response.json();
                errorMessage = errorBody.detail || errorMessage;
            } catch (e) {
                // Could not parse JSON body, stick with the status text.
            }
            throw new Error(errorMessage);
        }

        // Handle cases with no content in response
        const contentType = response.headers.get("content-type");
        if (contentType && contentType.indexOf("application/json") !== -1) {
            const jsonResponse = await response.json();
            Logger.api(`[API RES] Success for ${url}`, { response: jsonResponse });
            return jsonResponse;
        }
        Logger.api(`[API RES] Success for ${url} (No JSON content)`);
        return {};

    } catch (error) {
        Logger.error(`[API FAIL] Call to ${url} failed`, error);
        throw error; // Re-throw to be caught by the calling function
    }
};

/**
 * Uploads a PDF file to the backend to start the processing pipeline.
 * @param file The PDF file to upload.
 * @returns The documentId for the processing job.
 */
export const uploadPdf = async (file: File): Promise<{ documentId: string }> => {
    const formData = new FormData();
    formData.append('file', file);

    const response = await fetchApi(`${API_BASE_URL}/upload-pdf/`, {
        method: 'POST',
        body: formData,
    });
    
    // The backend sends camelCase `documentId` so no conversion needed here.
    return response;
};

/**
 * Fetches the current processing status of a document from the backend.
 * @param documentId The ID of the document to check.
 * @returns The current status, and the final data if processing is complete.
 */
export const getDocumentStatus = async (documentId: string): Promise<DocumentStatusResponse> => {
    const response = await fetchApi(`${API_BASE_URL}/document-status/${documentId}`);
    return keysToCamel(response) as DocumentStatusResponse;
};

/**
 * Saves the current state of the document analysis to the backend.
 * @param state The current application state.
 */
export const saveDocumentState = async (state: AppState): Promise<void> => {
    if (!state.document?.id) {
        throw new Error("Cannot save state without a document ID.");
    }
    
    const payload: DocumentState = {
        documentId: state.document.id,
        pageDimensions: state.pageDimensions,
        paragraphs: state.paragraphs,
        history: state.history,
    };
    
    const snakeCasePayload = keysToSnake(payload);
    
    await fetchApi(`${API_BASE_URL}/save-document-state/`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
        },
        body: JSON.stringify(snakeCasePayload),
    });
};
