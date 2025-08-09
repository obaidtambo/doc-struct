
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
//      that represents the new, merged paragraph structure.
//
// 2. Create an input mock `AnalyzedParagraph[]` array. This array
//    should contain paragraphs that are candidates for merging
//    (e.g., fragmented sentences across multiple nodes).
//
// 3. Call `refineAndMergeNodes` with the mock data.
//
// 4. Assert that the returned array matches the expected refined
//    structure from your mock Gemini response. For example, assert
//    that two input nodes have become one output node.
//
// 5. Test the case where no merges are needed. The mock Gemini
//    response should be identical to the input array. Assert that
//    the function returns the original data structure.
//
// 6. Test error paths, such as Gemini returning malformed JSON, and
//    assert that the function gracefully returns the original,
//    unmodified paragraph array.
// =================================================================

import { AnalyzedParagraph } from '../types';
import { GoogleGenAI, Type } from '@google/genai';

const model = "gemini-2.5-flash";

function createCoherencePrompt(paragraphs: AnalyzedParagraph[]): string {
  return `
    You are an AI Document Refinement Specialist. Your input is a JSON array representing a pre-structured document. Each node has location data ('boundingBox', 'pageNumber').
    Your mission is to enhance readability and coherence by identifying and merging nodes (paragraphs) that are fragmented or semantically belong together.

    **Core Principles:**
    1.  **Readability is Paramount:** The final structure should be easy to read. Each row should represent a meaningful, complete thought or heading.
    2.  **Merge Strategically:**
        *   If a node contains an incomplete sentence that is clearly continued in the next sibling node, they MUST be merged.
        *   If multiple consecutive sibling nodes discuss the exact same micro-topic, merge them.
        *   **Preserve Headings:** NEVER merge a heading ('title', 'sectionHeading') with its content. Only merge sibling nodes (nodes with the same parentId).

    **Your Task:**
    - Analyze the provided JSON array of document nodes.
    - Produce a NEW JSON array that contains the refined, merged structure.
    - For merged nodes:
        - Combine their 'content' into a single, fluent string.
        - Use the 'id', 'parentId', 'role', 'level', 'boundingBox', and 'pageNumber' from the **FIRST** node in the group that was merged.
    - Nodes that do not need merging should be passed through to the output array unchanged, preserving all original fields.

    **Strict Output Format:**
    - Your output MUST be a valid JSON array of objects, conforming to the exact same schema as the input.
    - Do not add explanations or any text outside of the JSON array.
    - If no merges are needed, return the original array.

    **Structured Document to Refine:**
    ${JSON.stringify(paragraphs, null, 2)}
  `;
}

/**
 * An AI agent that refines a document structure by merging incomplete or related paragraphs.
 * @param paragraphs The initial array of analyzed paragraphs.
 * @returns A promise that resolves to a new, more coherent array of AnalyzedParagraph.
 */
export const refineAndMergeNodes = async (paragraphs: AnalyzedParagraph[]): Promise<AnalyzedParagraph[]> => {
    const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
    
    const responseSchema = {
        type: Type.ARRAY,
        items: {
            type: Type.OBJECT,
            properties: {
                id: { type: Type.STRING },
                parentId: { type: Type.STRING },
                content: { type: Type.STRING },
                role: { type: Type.STRING },
                level: { type: Type.INTEGER },
                boundingBox: { 
                    type: Type.OBJECT,
                    properties: {
                        x: { type: Type.NUMBER },
                        y: { type: Type.NUMBER },
                        width: { type: Type.NUMBER },
                        height: { type: Type.NUMBER },
                    },
                    required: ["x", "y", "width", "height"],
                },
                pageNumber: { type: Type.INTEGER },
            },
            required: ["id", "parentId", "content", "role", "level", "boundingBox", "pageNumber"],
        },
    };

    const prompt = createCoherencePrompt(paragraphs);

    try {
        const response = await ai.models.generateContent({
            model: model,
            contents: prompt,
            config: {
                responseMimeType: "application/json",
                responseSchema: responseSchema,
                temperature: 0.1, // Low temperature for deterministic structural changes
            }
        });

        const jsonString = response.text;
        if (!jsonString) {
            console.warn("Coherence agent returned an empty response. Returning original structure.");
            return paragraphs;
        }

        const parsedJson = JSON.parse(jsonString);

        if (!Array.isArray(parsedJson)) {
            console.error("Coherence agent response was not in the expected JSON array format. Returning original structure.");
            return paragraphs;
        }
        
        if (parsedJson.length > 0 && typeof parsedJson[0].id === 'undefined') {
             console.error("Parsed JSON from coherence agent is missing required fields. Returning original structure.");
            return paragraphs;
        }

        // Add back the enrichment data which was not part of the coherence check
        const originalEnrichment = new Map(paragraphs.map(p => [p.id, p.enrichment]));
        return (parsedJson as AnalyzedParagraph[]).map(p => ({
            ...p,
            enrichment: originalEnrichment.get(p.id) || {}
        }));

    } catch (error) {
        console.error("Error calling coherence agent or parsing response. Returning original structure.", error);
        // Fail gracefully by returning the original data
        return paragraphs;
    }
};
