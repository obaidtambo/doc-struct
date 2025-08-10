// =================================================================
// TESTING INSTRUCTIONS FOR THIS MODULE
// =================================================================
// To test this service in isolation, you can use a testing framework
// like Jest or Vitest and mock the global `fetch` function.
//
// 1. **Set Mock Environment Variables**: Before running tests, set mock values for
//    `process.env.VITE_AZURE_DOCUMENT_INTELLIGENCE_ENDPOINT` and
//    `process.env.VITE_AZURE_DOCUMENT_INTELLIGENCE_KEY`.
//
// 2. **Initial Request Mock**:
//    - Mock `fetch` to handle the initial POST request.
//    - It should return a `Response` with status `202` and an
//      `Operation-Location` header pointing to a mock polling URL.
//
// 3. **Polling Request Mocks**:
//    - Mock `fetch` to handle GET requests to the mock polling URL.
//    - First call: Return a `Response` with a JSON body `{ "status": "running" }`.
//    - Second call: Return a `Response` with a JSON body containing `{ "status": "succeeded", "analyzeResult": { ...mockResult } }`.
//
// 4. Create a mock `File` object and call `extractTextWithLayout`.
//
// 5. Assert that the function returns the expected data and that it throws
//    an error if the environment variables are not set.
// =================================================================



// =================================================================
//
//   ██████╗  █████╗ ██╗ ██████╗    ██╗  ██╗███████╗██╗   ██╗
//  ██╔═══██╗██╔══██╗██║██╔════╝    ██║ ██╔╝██╔════╝╚██╗ ██╔╝
//  ██║   ██║███████║██║██║         █████╔╝ █████╗   ╚████╔╝
//  ██║   ██║██╔══██║██║██║         ██╔═██╗ ██╔══╝    ╚██╔╝
//  ╚██████╔╝██║  ██║██║╚██████╗    ██║  ██╗███████╗   ██║
//   ╚═════╝ ╚═╝  ╚═╝╚═╝ ╚═════╝    ╚═╝  ╚═╝╚══════╝   ╚═╝
//
//  IMPORTANT: AZURE CREDENTIALS CONFIGURATION
//  This application is configured to use environment variables for API keys.
//  For deployment, set the following variables in your cloud provider's settings:
//  - VITE_AZURE_DOCUMENT_INTELLIGENCE_ENDPOINT
//  - VITE_AZURE_DOCUMENT_INTELLIGENCE_KEY
// =================================================================
const VITE_AZURE_DOCUMENT_INTELLIGENCE_ENDPOINT = process.env.VITE_AZURE_DOCUMENT_INTELLIGENCE_ENDPOINT;
const VITE_AZURE_DOCUMENT_INTELLIGENCE_KEY = process.env.VITE_AZURE_DOCUMENT_INTELLIGENCE_KEY;
// =================================================================



import { OcrBlock, BoundingBox, PageDimension, OcrExtractionResult } from '../types';

/**
 * Converts a polygon (array of x,y coordinates) to a bounding box object.
 * @param polygon - Array of numbers representing points [x1, y1, x2, y2, ...].
 * @returns An object with x, y, width, and height.
 */
function polygonToBoundingBox(polygon: number[]): BoundingBox {
    if (!polygon || polygon.length === 0) {
        return { x: 0, y: 0, width: 0, height: 0 };
    }
    const xCoords = polygon.filter((_, i) => i % 2 === 0);
    const yCoords = polygon.filter((_, i) => i % 2 !== 0);
    const minX = Math.min(...xCoords);
    const maxX = Math.max(...xCoords);
    const minY = Math.min(...yCoords);
    const maxY = Math.max(...yCoords);

    return {
        x: minX,
        y: minY,
        width: maxX - minX,
        height: maxY - minY,
    };
}

const delay = (ms: number) => new Promise(res => setTimeout(res, ms));

async function pollForResult(operationUrl: string): Promise<any> {
    let result: any;
    let status = 'notStarted';

    const POLLING_TIMEOUT = 60000; // 60 seconds
    const startTime = Date.now();

    while (status === 'notStarted' || status === 'running') {
        if (Date.now() - startTime > POLLING_TIMEOUT) {
            throw new Error('Azure analysis polling timed out after 60 seconds.');
        }

        const response = await fetch(operationUrl, {
            headers: {
                'Ocp-Apim-Subscription-Key': VITE_AZURE_DOCUMENT_INTELLIGENCE_KEY!,
            },
        });

        if (!response.ok) {
            const errorText = await response.text();
            throw new Error(`Azure polling failed with status ${response.status}: ${errorText}`);
        }

        result = await response.json();
        status = result.status;
        
        if (status === 'succeeded') {
            return result.analyzeResult;
        }

        if (status === 'failed') {
            const errorMessage = result.error?.message || 'Azure analysis failed without a specific error message.';
            throw new Error(`Azure document analysis failed: ${errorMessage}`);
        }
        
        await delay(1000); 
    }

    return null;
}

/**
 * Calls the Azure Document Intelligence API to perform layout analysis (OCR).
 *
 * @param file The PDF file to be processed.
 * @returns A promise that resolves to an object containing OcrBlocks and page dimensions.
 */
export const extractTextWithLayout = async (file: File): Promise<OcrExtractionResult> => {
    if (!VITE_AZURE_DOCUMENT_INTELLIGENCE_ENDPOINT || !VITE_AZURE_DOCUMENT_INTELLIGENCE_KEY) {
        throw new Error("Azure Document Intelligence credentials are not configured. Please set the VITE_AZURE_DOCUMENT_INTELLIGENCE_ENDPOINT and VITE_AZURE_DOCUMENT_INTELLIGENCE_KEY environment variables in your deployment settings.");
    }
    
    console.log(`Starting Azure Document Intelligence analysis for file: ${file.name}`);
    
    const analyzeUrl = `${VITE_AZURE_DOCUMENT_INTELLIGENCE_ENDPOINT.replace(/\/$/, '')}/documentintelligence/documentModels/prebuilt-layout:analyze?api-version=2024-02-29-preview`;
    
    const fileBuffer = await file.arrayBuffer();

    const initialResponse = await fetch(analyzeUrl, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/pdf',
            'Ocp-Apim-Subscription-Key': VITE_AZURE_DOCUMENT_INTELLIGENCE_KEY,
        },
        body: fileBuffer,
    });

    if (initialResponse.status !== 202) {
        let errorBody;
        try {
            errorBody = await initialResponse.json();
        } catch {
            errorBody = await initialResponse.text();
        }
        const errorDetails = errorBody?.error?.message || JSON.stringify(errorBody) || "Unknown error";
        console.error("Azure initial request failed:", errorBody);
        throw new Error(`Azure Document Intelligence API error: ${errorDetails}`);
    }

    try {
        const operationLocation = initialResponse.headers.get('Operation-Location');
        if (!operationLocation) {
            throw new Error('Operation-Location header not found in Azure response.');
        }

        const result = await pollForResult(operationLocation);
        
        if (!result) {
            throw new Error("Azure analysis result is empty.");
        }

        const paragraphs = result.paragraphs || [];
        if (paragraphs.length === 0) {
             throw new Error("Azure analysis could not find any text content (paragraphs) in the document.");
        }

        console.log(`Azure analysis successful. Extracted ${paragraphs.length} paragraphs.`);

        const ocrBlocks: OcrBlock[] = paragraphs.map((paragraph: any) => {
            const boundingRegion = paragraph.boundingRegions?.[0];
            const polygon = boundingRegion?.polygon ?? [];
            
            return {
                text: paragraph.content,
                boundingBox: polygonToBoundingBox(polygon),
                pageNumber: boundingRegion?.pageNumber ?? 0,
                role: paragraph.role,
            };
        });

        const pageDimensions: PageDimension[] = (result.pages || []).map((page: any) => ({
            pageNumber: page.pageNumber,
            width: page.width,
            height: page.height,
            unit: page.unit
        }));

        return { blocks: ocrBlocks, pageDimensions };

    } catch (err: any) {
        console.error("Error during Azure polling or processing:", err);
        throw new Error("Failed to get analysis result from Azure. " + err.message);
    }
};