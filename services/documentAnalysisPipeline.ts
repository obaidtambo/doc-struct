
// =================================================================
// TESTING INSTRUCTIONS FOR THIS MODULE
// =================================================================
// To test this service in isolation, you should mock its dependencies,
// `azureOcrService.ts` and `geminiAnalyzerService.ts`.
//
// 1. Mock the `extractTextWithLayout` function from `azureOcrService`.
//    - Make it return a resolved promise with a mock `{ blocks, pageDimensions }` object.
//
// 2. Mock the `analyzeParagraphHierarchy` function from `geminiAnalyzerService`.
//    - Make it return a resolved promise with a final, mock `AnalyzedParagraph[]` array.
//
// 3. Call `processDocument` with a mock `File` object and a mock
//    `onProgress` function (e.g., `jest.fn()`).
//
// 4. Assert that `onProgress` was called with the expected status messages.
//
// 5. Assert that `processDocument` returns the final `{ paragraphs, pageDimensions }` object.
//
// 6. Test error paths, such as when the OCR service returns an empty
//    array, to ensure the pipeline correctly throws an error.
// =================================================================

import { AnalyzedParagraph, PageDimension, OcrExtractionResult } from '../types';
import { extractTextWithLayout } from './azureOcrService';
import { analyzeParagraphHierarchy } from './geminiAnalyzerService';
import { refineAndMergeNodes } from './coherenceAgent';
import { enrichContent } from './enrichmentAgent';

const mergeEnrichmentData = (
    structured: AnalyzedParagraph[], 
    enrichments: { id: string; enrichment: Record<string, string> }[]
): AnalyzedParagraph[] => {
    const enrichmentMap = new Map(enrichments.map(item => [item.id, item.enrichment]));
    return structured.map(para => ({
        ...para,
        enrichment: enrichmentMap.get(para.id) || para.enrichment,
    }));
};

interface PipelineResult {
    paragraphs: AnalyzedParagraph[];
    pageDimensions: PageDimension[];
}

/**
 * Runs the AI-powered part of the analysis pipeline on pre-existing OCR data.
 *
 * @param ocrResult The result from the OCR extraction step.
 * @param onProgress A callback function to report progress updates.
 * @returns A promise that resolves to an object containing AnalyzedParagraphs and PageDimensions.
 */
export const runAiAnalysisOnOcr = async (
    ocrResult: OcrExtractionResult,
    onProgress: (message: string) => void
): Promise<PipelineResult> => {
    const { blocks: ocrData, pageDimensions } = ocrResult;

    if (ocrData.length === 0) {
        console.warn("Pipeline stopped: OCR data is empty.");
        throw new Error("The provided OCR data is empty or invalid.");
    }
    console.log(`AI analysis started with ${ocrData.length} text blocks.`);

    // AI Step 1: Pass the OCR payload to the Gemini agent for structuring and cleaning.
    console.log("Step 1 of AI analysis: Structuring and cleaning content...");
    onProgress("Step 1/3: Building document structure...");
    const structuredData = await analyzeParagraphHierarchy(ocrData);
    
    if (structuredData.length === 0) {
        console.warn("Pipeline stopped: AI analyzer returned no structured data.");
        throw new Error("The AI couldn't extract any structured data. The document might lack a clear hierarchy or be too complex.");
    }
    console.log(`Structuring successful, created ${structuredData.length} coherent paragraphs.`);

    // AI Step 2: Pass the structured data to the coherence agent for refinement.
    console.log("Step 2 of AI analysis: Refining and merging nodes for coherence...");
    onProgress("Step 2/3: Refining content coherence...");
    const refinedData = await refineAndMergeNodes(structuredData);
    console.log(`Coherence check complete. Final node count: ${refinedData.length}.`);

    // AI Step 3: Pass the refined data to the enrichment agent.
    console.log("Step 3 of AI analysis: Enriching content...");
    onProgress("Step 3/3: Extracting key details...");
    const enrichmentData = await enrichContent(refinedData);
    console.log("Enrichment successful.");
    
    // Finalizing: Merge the enrichment data back into the main structure.
    console.log("Merging results...");
    onProgress("Finalizing results...");
    const finalResult = mergeEnrichmentData(refinedData, enrichmentData);

    console.log("AI analysis part of the pipeline completed successfully.");
    return { paragraphs: finalResult, pageDimensions };
};

/**
 * Orchestrates the full document analysis pipeline from a PDF file.
 * It first calls the OCR service to get text blocks, then passes
 * that data to the AI analyzer to determine the hierarchy.
 *
 * @param file The PDF file to be processed.
 * @param onProgress A callback function to report progress updates.
 * @returns A promise that resolves to an object containing both the raw OCR result and the final analysis.
 */
export const processDocument = async (
    file: File,
    onProgress: (message: string) => void
): Promise<{ ocrResult: OcrExtractionResult; finalResult: PipelineResult }> => {
    console.log("Starting document analysis pipeline...");
    onProgress("Initializing pipeline...");

    // Step 1: Call the OCR service to extract paragraphs and their roles.
    console.log("Step 1: Extracting text with OCR...");
    onProgress("Step 1/4: Extracting text from document...");
    const ocrResult = await extractTextWithLayout(file);
    
    if (ocrResult.blocks.length === 0) {
        console.warn("Pipeline stopped: OCR service returned no data.");
        throw new Error("The OCR service could not extract any text from the document. It might be an image-only PDF or empty.");
    }
    console.log(`OCR successful, found ${ocrResult.blocks.length} text blocks.`);
    
    // Run the rest of the pipeline
    const finalResult = await runAiAnalysisOnOcr(ocrResult, (msg) => {
        const updatedMsg = msg.replace(/Step (\d+)\/3/, (_, stepNum) => `Step ${parseInt(stepNum, 10) + 1}/4`);
        onProgress(updatedMsg);
    });
    
    console.log("Document analysis pipeline completed successfully.");
    return { ocrResult, finalResult };
};
