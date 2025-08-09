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
//      that matches the `responseSchema`.
//
// 2. Create a mock `OcrBlock[]` array to represent the data coming
//    from the OCR service.
//
// 3. Call `analyzeParagraphHierarchy` with the mock data.
//
// 4. Assert that the function returns the expected `AnalyzedParagraph[]`
//    array, correctly parsed from your mock Gemini response.
//
// 5. Test edge cases, such as an empty or malformed JSON response
//    from the mocked Gemini service, to ensure your error handling
//    is robust.
// =================================================================


import { AnalyzedParagraph, OcrBlock } from '../types';
import { GoogleGenAI, Type } from '@google/genai';

const model = "gemini-2.5-flash";

/**
 * Creates the prompt for the Gemini agent to analyze OCR paragraph data.
 * @param ocrData The structured data from the OCR service.
 * @returns A string containing the full prompt.
 */
function createAnalysisPrompt(ocrData: OcrBlock[]): string {
  return `
      You are an expert Document Structuring Agent inside a secure sandbox.
      Your input is a JSON array of raw text blocks from an OCR service. Each block has 'text', 'role', 'boundingBox', and 'pageNumber'.
      Your mission is to intelligently clean, merge, and structure these blocks into a coherent document hierarchy.

      **Your Analysis Workflow:**

      1.  **Coalesce & Clean:**
          *   Examine adjacent text blocks. If they clearly form a single logical sentence or entity, you **MUST** merge their 'content' into a single paragraph.
          *   You **MUST IGNORE** and completely discard any paragraphs with roles like 'pageHeader', 'pageFooter', or 'pageNumber'.

      2.  **Establish Hierarchy:**
          *   After cleaning and merging, analyze the resulting blocks to understand the document's structure.
          *   Identify the main 'title', 'sectionHeading' elements, and standard 'paragraph' blocks.
          *   Infer the hierarchical level for each block.

      3.  **Generate Final Output:**
          *   Your output **MUST** be a valid JSON array.
          *   Each object in the array represents a final, coherent paragraph or heading and must have the following attributes:
              *   'id': A unique, sequential identifier (e.g., 'para-1', 'para-2').
              *   'parentId': The 'id' of the parent heading. For top-level elements, this must be an empty string ''.
              *   'content': The full, cleaned, and merged text content.
              *   'role': The inferred semantic role (e.g., 'title', 'sectionHeading', 'paragraph').
              *   'level': An integer for hierarchy depth. Main 'title' is level 1. Content 'paragraph' should have a level of 0.
              *   'boundingBox': The bounding box from the **primary** source block used to create this entry. You MUST pass this through. If merging, use the bounding box of the first block in the merge sequence.
              *   'pageNumber': The page number from the source block. You MUST pass this through. If merging, use the page number of the first block.

      **Strict Rules:**
      - Your entire output MUST be a valid JSON array conforming to the schema. Do not include any other text, explanations, or markdown.
      - Be aggressive in merging fragmented text. For example, ['Obaid Taher Tamboli', 'has successfully completed'] should be merged.
      - Ensure parentId-child relationships are logical. A paragraph's parent should be the most recent preceding heading.

      **OCR Payload to Analyze:**
      ${JSON.stringify(ocrData, null, 2)}
    `;
}

/**
 * Calls the Gemini API to analyze the structured OCR data and determine paragraph hierarchy.
 * @param ocrData The structured JSON payload from the OCR service.
 * @returns A promise that resolves to an array of AnalyzedParagraph.
 */
export const analyzeParagraphHierarchy = async (ocrData: OcrBlock[]): Promise<AnalyzedParagraph[]> => {
    const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
    
    const responseSchema = {
        type: Type.ARRAY,
        items: {
            type: Type.OBJECT,
            properties: {
                id: { type: Type.STRING, description: "A unique, sequential identifier (e.g., 'para-1')." },
                parentId: { type: Type.STRING, description: "The 'id' of the parent heading. Empty string '' for top-level." },
                content: { type: Type.STRING, description: "The full text content of the paragraph." },
                role: { type: Type.STRING, description: "The inferred semantic role (e.g., 'title', 'sectionHeading')." },
                level: { type: Type.INTEGER, description: "Hierarchy level. Headings >= 1, content paragraphs are 0." },
                boundingBox: { 
                    type: Type.OBJECT,
                    properties: {
                        x: { type: Type.NUMBER },
                        y: { type: Type.NUMBER },
                        width: { type: Type.NUMBER },
                        height: { type: Type.NUMBER },
                    },
                    required: ["x", "y", "width", "height"],
                    description: "The original bounding box of the primary source block."
                },
                pageNumber: { type: Type.INTEGER, description: "The original page number of the source block." },
            },
            required: ["id", "parentId", "content", "role", "level", "boundingBox", "pageNumber"],
        },
    };

    const prompt = createAnalysisPrompt(ocrData);

    try {
        const response = await ai.models.generateContent({
            model: model,
            contents: prompt,
            config: {
                responseMimeType: "application/json",
                responseSchema: responseSchema,
                temperature: 0.1,
            }
        });

        const jsonString = response.text;
        if (!jsonString) {
            console.error("Gemini API returned an empty response text.");
            throw new Error("AI analysis returned an empty response. The document might be empty or unsupported.");
        }

        const parsedJson = JSON.parse(jsonString);

        if (!Array.isArray(parsedJson)) {
            throw new Error("AI response was not in the expected JSON array format.");
        }
        
        // Ensure enrichment property exists to match the type, even if empty
        return (parsedJson as AnalyzedParagraph[]).map(p => ({ ...p, enrichment: {} }));

    } catch (error) {
        console.error("Error calling Gemini API or parsing response:", error);
        throw new Error("Failed to process document with AI. The model may have returned an invalid structure or the request failed.");
    }
};