
// =================================================================
// TESTING INSTRUCTIONS FOR THIS MODULE
// =================================================================
// To test this service in isolation, you can use a testing framework
// like Jest or Vitest.
//
// 1. Mock the '@google/genai' module.
//    - Your mock should simulate the `GoogleGenAI` class and its
//      `models.generateContent` method.
//
// 2. To test `getMergeSuggestions`:
//    - Call it with a mock `AnalyzedParagraph[]`.
//    - The `generateContent` mock should return a resolved promise with
//      a `text` property containing a stringified JSON array of string
//      arrays, e.g., `[["para-1", "para-2"]]`.
//    - Assert the function returns the correctly parsed array.
//
// 3. To test `generateMergeResult`:
//    - Call it with mock `AnalyzedParagraph[]` and an optional instruction string.
//    - The `generateContent` mock should return a resolved promise with
//      a `text` property containing a stringified JSON object like
//      `{"content": "...", "enrichment": "{\\"key\\":\\"value\\"}"}`.
//    - Assert the function returns the correctly parsed object, including
//      the parsed inner `enrichment` JSON.
//
// 4. Test error paths for both functions by mocking a failed promise
//    or malformed JSON response from `generateContent`. Assert that the
//    functions throw the expected errors.
// =================================================================


import { AnalyzedParagraph } from '../types';
import { GoogleGenAI, Type } from '@google/genai';

const model = "gemini-2.5-flash";

/**
 * Creates the prompt for the Gemini agent to suggest paragraph merges.
 */
function createSuggestionPrompt(paragraphs: AnalyzedParagraph[]): string {
  return `
    You are an expert Document Editor AI. Your input is a JSON array of paragraphs from a structured document.
    Your task is to identify groups of sibling paragraphs (those with the same 'parentId') that are fragmented and should be merged into a single, coherent paragraph.

    **Analysis Workflow:**
    1.  **Examine Siblings:** Look for consecutive paragraphs that have the same 'parentId'.
    2.  **Identify Fragmentation:** Determine if these sibling paragraphs are parts of a single idea, sentence, or list item that was incorrectly split. For example, a job title and the company name in separate blocks.
    3.  **Form Groups:** Group the 'id's of the paragraphs that should be merged.

    **Strict Rules:**
    - Only suggest merging paragraphs that are siblings (same 'parentId').
    - Do NOT suggest merging a heading with a content paragraph.
    - Do NOT suggest merging paragraphs that are already complete and logically separate.
    - Your output **MUST** be a valid JSON array of arrays. Each inner array contains the string 'id's of paragraphs to merge.
    - Example Output: [["para-5", "para-6"], ["para-10", "para-11", "para-12"]]
    - If no merges are needed, return an empty array: [].
    - Do not include explanations or any text outside the JSON array.

    **Document Paragraphs to Analyze:**
    ${JSON.stringify(paragraphs.map(({ id, parentId, content }) => ({ id, parentId, content })), null, 2)}
  `;
}

/**
 * Creates the prompt for the Gemini agent to perform a merge.
 */
function createMergePrompt(paragraphsToMerge: AnalyzedParagraph[], userInstruction?: string): string {
  return `
    You are an AI Document Refinement Specialist. Your input is a JSON array of document paragraphs that the user wants to merge.
    Your task is to combine them into a single, new paragraph object, generating new 'content' and 'enrichment' data.

    **Your Workflow:**
    1.  **Analyze Content:** Read all the 'content' from the input paragraphs.
    2.  **Synthesize New Content:** Create a new, single 'content' string that logically combines the original texts. It should be fluent, grammatically correct, and make sense as one paragraph.
    3.  **Analyze Enrichment:** Examine all the 'enrichment' objects from the input paragraphs.
    4.  **Synthesize New Enrichment:** Create a single, new JSON object for the 'enrichment' field. This new object should be a superset of all the meaningful data from the original enrichments. Combine related fields where it makes sense.
    5.  **Follow User Instructions:** If a user instruction is provided, it is the highest priority. You MUST follow it to guide the merge process for both content and enrichment.

    **User Instruction (if provided):**
    ${userInstruction || 'No specific instructions provided. Perform a logical default merge.'}

    **Strict Output Format:**
    - Your output MUST be a single, valid JSON object.
    - The JSON object must have two keys:
      1. 'content': The newly generated string of text.
      2. 'enrichment': A JSON string representing the new map of key-value pairs.

    **Paragraphs to Merge:**
    ${JSON.stringify(paragraphsToMerge, null, 2)}
  `;
}

/**
 * An AI agent that suggests groups of paragraphs to merge.
 * @param paragraphs The current array of analyzed paragraphs.
 * @returns A promise that resolves to an array of ID groups to suggest for merging.
 */
export const getMergeSuggestions = async (paragraphs: AnalyzedParagraph[]): Promise<string[][]> => {
    const ai = new GoogleGenAI({ apiKey: process.env.VITE_API_KEY });

    const responseSchema = {
        type: Type.ARRAY,
        items: {
            type: Type.ARRAY,
            items: { type: Type.STRING }
        }
    };

    const prompt = createSuggestionPrompt(paragraphs);

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
            console.warn("Merge suggestion agent returned empty response.");
            return [];
        }

        const parsedJson = JSON.parse(jsonString);
        return Array.isArray(parsedJson) ? parsedJson : [];

    } catch (error) {
        console.error("Error calling merge suggestion agent:", error);
        throw new Error("Failed to get merge suggestions from AI.");
    }
};

/**
 * An AI agent that merges selected paragraphs into a new one.
 * @param paragraphsToMerge The paragraphs selected by the user for merging.
 * @param userInstruction Optional instructions from the user.
 * @returns A promise resolving to the new content and enrichment object.
 */
export const generateMergeResult = async (
    paragraphsToMerge: AnalyzedParagraph[],
    userInstruction?: string
): Promise<{ content: string; enrichment: Record<string, string> }> => {
    const ai = new GoogleGenAI({ apiKey: process.env.VITE_API_KEY });

    const responseSchema = {
        type: Type.OBJECT,
        properties: {
            content: { type: Type.STRING, description: "The new, merged content string." },
            enrichment: {
                type: Type.STRING,
                description: "A JSON string representing the new, merged enrichment data map. e.g., '{\"key\": \"value\"}'"
            }
        },
        required: ["content", "enrichment"]
    };

    const prompt = createMergePrompt(paragraphsToMerge, userInstruction);

    try {
        const response = await ai.models.generateContent({
            model: model,
            contents: prompt,
            config: {
                responseMimeType: "application/json",
                responseSchema: responseSchema,
                temperature: 0.3,
            }
        });

        const jsonString = response.text;
        if (!jsonString) {
            throw new Error("Merge generation agent returned empty response.");
        }
        
        const parsedResponse = JSON.parse(jsonString) as { content: string; enrichment: string };

        const enrichmentObject = JSON.parse(parsedResponse.enrichment);

        return {
            content: parsedResponse.content,
            enrichment: enrichmentObject,
        };

    } catch (error) {
        console.error("Error calling merge generation agent:", error);
        throw new Error("Failed to generate merge result with AI.");
    }
};
