
// =================================================================
// TESTING INSTRUCTIONS FOR THIS MODULE
// =================================================================
// To test this service in isolation, you can use a testing framework
// like Jest or Vitest.
//
// 1. Mock the '@google/genai' module.
//    - Your mock should simulate the `GoogleGenAI` class and its
//      `models.generateContent` method.
//    - The `generateContent` mock should return a resolved promise
//      with a `text` property containing a stringified JSON array
//      that matches the `responseSchema`. The 'enrichment' field
//      in the mock response must be a JSON string.
//
// 2. Create a mock `AnalyzedParagraph[]` array to pass to the function.
//
// 3. Call `enrichContent` with the mock data.
//
// 4. Assert that the function correctly parses both the outer JSON
//    array and the inner 'enrichment' JSON string for each item.
//
// 5. Test error paths:
//    - Mock Gemini to return malformed JSON.
//    - Mock Gemini to return an 'enrichment' string that is not valid JSON.
//    - Assert that the function handles these errors gracefully and
//      returns a default structure (e.g., empty enrichment object).
// =================================================================


import { AnalyzedParagraph } from '../types';
import { GoogleGenAI, Type } from '@google/genai';

const model = "gemini-2.5-flash";

function createEnrichmentPrompt(paragraphs: AnalyzedParagraph[]): string {
  return `
    You are an AI-powered Document Enrichment Specialist.
    Your input is a JSON array representing a pre-structured document. Each object is a paragraph or a heading with existing location data ('id', 'boundingBox', 'pageNumber').
    Your task is to analyze each node (paragraph object) within the context of the entire document and extract meaningful, structured metadata.

    **Analysis Instructions:**
    1.  **Context is Key:** Do not analyze nodes in isolation. Understand the document's overall type (e.g., certificate, report, invoice) to guide your extraction.
    2.  **Extract Specific Entities:** For each node, identify and extract key information.
        *   For a **certificate**: Look for 'Recipient Name', 'Course Title', 'Issuing Authority', 'Completion Date'.
        *   For a **report**: Summarize headings, identify 'Key Terms' in paragraphs.
        *   For an **invoice**: Look for 'Invoice Number', 'Due Date', 'Total Amount'.
    3.  **Be Concise:** The extracted values should be short and to the point.
    4.  **Maintain Structure:** Your output MUST be a JSON array. It must contain one object for every object in the input array, in the same order.

    **Output Schema:**
    - Your entire output must be a valid JSON array. Each object in the array represents one of the input nodes.
    - Each object in the output array MUST have two keys:
      1. 'id': The original 'id' of the node from the input. You MUST pass this through unchanged.
      2. 'enrichment': This MUST be a **JSON string** representing a map of the extracted key-value pairs. If you find no specific data to extract for a node, provide a string for an empty JSON object: '{}'.
    
    **Example Input Node:**
    { "id": "para-3", "content": "This certificate is awarded to Jane Doe on May 6, 2025.", "role": "paragraph", "boundingBox": { ... }, "pageNumber": 1, ... }

    **Correct Example Output Object for that Node:**
    { "id": "para-3", "enrichment": "{\\"Recipient Name\\": \\"Jane Doe\\", \\"Completion Date\\": \\"May 6, 2025\\"}" }

    **Document Content to Analyze:**
    ${JSON.stringify(paragraphs, null, 2)}
  `;
}

// Defining a type for the expected enrichment response from Gemini
type EnrichmentResponseItem = {
    id: string;
    enrichment: Record<string, string>;
};

export const enrichContent = async (paragraphs: AnalyzedParagraph[]): Promise<EnrichmentResponseItem[]> => {
    const ai = new GoogleGenAI({ apiKey: process.env.VITE_API_KEY });

    const responseSchema = {
        type: Type.ARRAY,
        items: {
            type: Type.OBJECT,
            properties: {
                id: { type: Type.STRING, description: "The original ID of the paragraph." },
                enrichment: {
                    type: Type.STRING,
                    description: "A JSON string representing a map of extracted key-value pairs. Example: '{\"key1\": \"value1\"}'. For no data, this MUST be an empty JSON object string: '{}'."
                }
            },
            required: ["id", "enrichment"]
        }
    };

    const prompt = createEnrichmentPrompt(paragraphs);

    try {
        const response = await ai.models.generateContent({
            model: model,
            contents: prompt,
            config: {
                responseMimeType: "application/json",
                responseSchema: responseSchema,
                temperature: 0.2,
            }
        });

        const jsonString = response.text;
        if (!jsonString) {
            console.warn("Enrichment agent returned empty response.");
            return paragraphs.map(p => ({ id: p.id, enrichment: {} }));
        }

        const parsedJson = JSON.parse(jsonString);

        if (!Array.isArray(parsedJson)) {
            throw new Error("Enrichment agent response was not in the expected JSON array format.");
        }
        
        // Transform the response to parse the inner JSON string from the 'enrichment' field
        return parsedJson.map((item: { id: string; enrichment: string }) => {
            try {
                // The model should return a string. We parse it into an object.
                const enrichmentData = typeof item.enrichment === 'string' && item.enrichment.trim() !== '' ? JSON.parse(item.enrichment) : {};
                return {
                    id: item.id,
                    enrichment: enrichmentData
                };
            } catch (e) {
                console.error(`Failed to parse enrichment JSON for ID ${item.id}:`, item.enrichment, e);
                // Return a default structure on parsing failure for this item
                return {
                    id: item.id,
                    enrichment: {}
                };
            }
        });

    } catch (error) {
        console.error("Error calling enrichment agent or parsing response:", error);
        // Return a default structure to avoid crashing the pipeline
        return paragraphs.map(p => ({ id: p.id, enrichment: {} }));
    }
};
