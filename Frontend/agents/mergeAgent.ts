// import { AnalyzedParagraph } from "../types";
// import Logger from '../services/logger';

// // Store module and client instance to avoid re-importing/re-initializing.
// let genAIModule: any = null;
// let ai: any = null; 

// /**
//  * Lazily imports and initializes the GoogleGenAI client.
//  * This function is async and must be awaited.
//  * @returns The initialized GoogleGenAI client instance.
//  */
// const getAiClient = async () => {
//   if (!ai) {
//     // Dynamically import the module only when needed for the first time.
//     if (!genAIModule) {
//       genAIModule = await import('@google/genai');
//     }
//     const { GoogleGenAI } = genAIModule;
//     // Reads the API key from the window object, which is populated by .env.js
//     const apiKey = (window as any)?.process?.env?.API_KEY;
//     if (!apiKey || apiKey === 'YOUR_GEMINI_API_KEY_HERE') {
//       throw new Error("Gemini API key is not configured. Please create a .env.js file with your key.");
//     }
//     ai = new GoogleGenAI({ apiKey });
//   }
//   return ai;
// };

// export const getAiMergeSuggestion = async (
//   paragraphs: AnalyzedParagraph[],
//   customInstructions?: string,
// ): Promise<{ content: string; enrichment: Record<string, any> }> => {

//   const contentToMerge = paragraphs.map((p, index) => `Paragraph ${index + 1}:\n${p.content}`).join('\n\n');

//   const instructionPrompt = customInstructions
//     ? `Apply the following user-provided instructions to the merge: "${customInstructions}"`
//     : 'Merge the following paragraphs into a single, coherent, and well-formatted text.';

//   const prompt = `
//     You are an expert document editor. Your task is to process and merge a set of paragraphs.
//     ${instructionPrompt}
//     The original role of the first paragraph was "${paragraphs[0].role || 'paragraph'}". Determine the most appropriate new role for the merged content.
//     Also, extract key information from the merged text into a structured enrichment object.

//     MERGE THE FOLLOWING CONTENT:
//     ---
//     ${contentToMerge}
//     ---

//     Respond ONLY with a JSON object in the following format. Do not include any other text or markdown formatting.
//   `;

//   // Ensure the module is loaded to access the `Type` enum.
//   if (!genAIModule) {
//     genAIModule = await import('@google/genai');
//   }
//   const { Type } = genAIModule;

//   const responseSchema = {
//     type: Type.OBJECT,
//     properties: {
//       mergedContent: {
//         type: Type.STRING,
//         description: "The newly merged, coherent paragraph.",
//       },
//       newRole: {
//         type: Type.STRING,
//         description: "The suggested new role for the merged content (e.g., 'paragraph', 'sectionHeading').",
//       },
//       enrichment: {
//         type: Type.OBJECT,
//         description: "A key-value object of extracted entities or a summary.",
//         properties: {
//             summary: { type: Type.STRING, description: "A brief summary of the merged content." },
//             keywords: { type: Type.ARRAY, items: { type: Type.STRING }, description: "A list of important keywords." }
//         }
//       },
//     },
//   };
  
//   try {
//     const aiClient = await getAiClient();
//     Logger.info('Sending prompt to Gemini API for merge suggestion...', { prompt, customInstructions });

//     const response = await aiClient.models.generateContent({
//         model: 'gemini-2.5-flash',
//         contents: prompt,
//         config: {
//             responseMimeType: 'application/json',
//             responseSchema: responseSchema,
//         },
//     });

//     const jsonText = response.text.trim();
//     const result = JSON.parse(jsonText);
//     Logger.info('Received and parsed merge suggestion from Gemini API', result);
    
//     return {
//         content: result.mergedContent,
//         enrichment: {
//             ...result.enrichment,
//             role: result.newRole, // Add the role to the enrichment object
//         },
//     };
//   } catch(e) {
//       Logger.error("Gemini API call failed", e);
//       throw new Error("Failed to get merge suggestion from AI. Check if your API key is configured correctly in .env.js.");
//   }
// };


import { AnalyzedParagraph } from "../types";
import Logger from '../services/logger';

// Store module and client instance to avoid re-importing/re-initializing.
let genAIModule: any = null;
let ai: any = null; 

/**
 * Lazily imports and initializes the GoogleGenAI client.
 * This function is async and must be awaited.
 * @returns The initialized GoogleGenAI client instance.
 */
const getAiClient = async () => {
  if (!ai) {
    // Dynamically import the module only when needed for the first time.
    if (!genAIModule) {
      genAIModule = await import('@google/genai');
    }
    const { GoogleGenAI } = genAIModule;
    // Reads the API key from process.env, which is replaced by Vite during the build.
    const apiKey = process.env.API_KEY;
    if (!apiKey || apiKey === 'YOUR_GEMINI_API_KEY_HERE') {
      throw new Error("Gemini API key is not configured. Please create a .env file with your key.");
    }
    ai = new GoogleGenAI({ apiKey });
  }
  return ai;
};

export const getAiMergeSuggestion = async (
  paragraphs: AnalyzedParagraph[],
  customInstructions?: string,
): Promise<{ content: string; enrichment: Record<string, any> }> => {

  const contentToMerge = paragraphs.map((p, index) => `Paragraph ${index + 1}:\n${p.content}`).join('\n\n');

  const instructionPrompt = customInstructions
    ? `Apply the following user-provided instructions to the merge: "${customInstructions}"`
    : 'Merge the following paragraphs into a single, coherent, and well-formatted text.';

  const prompt = `
    You are an expert document editor. Your task is to process and merge a set of paragraphs.
    ${instructionPrompt}
    The original role of the first paragraph was "${paragraphs[0].role || 'paragraph'}". Determine the most appropriate new role for the merged content.
    Also, extract key information from the merged text into a structured enrichment object.

    MERGE THE FOLLOWING CONTENT:
    ---
    ${contentToMerge}
    ---

    Respond ONLY with a JSON object in the following format. Do not include any other text or markdown formatting.
  `;

  // Ensure the module is loaded to access the `Type` enum.
  if (!genAIModule) {
    genAIModule = await import('@google/genai');
  }
  const { Type } = genAIModule;

  const responseSchema = {
    type: Type.OBJECT,
    properties: {
      mergedContent: {
        type: Type.STRING,
        description: "The newly merged, coherent paragraph.",
      },
      newRole: {
        type: Type.STRING,
        description: "The suggested new role for the merged content (e.g., 'paragraph', 'sectionHeading').",
      },
      enrichment: {
        type: Type.OBJECT,
        description: "A key-value object of extracted entities or a summary.",
        properties: {
            summary: { type: Type.STRING, description: "A brief summary of the merged content." },
            keywords: { type: Type.ARRAY, items: { type: Type.STRING }, description: "A list of important keywords." }
        }
      },
    },
  };
  
  try {
    const aiClient = await getAiClient();
    Logger.info('Sending prompt to Gemini API for merge suggestion...', { prompt, customInstructions });

    const response = await aiClient.models.generateContent({
        model: 'gemini-2.5-flash',
        contents: prompt,
        config: {
            responseMimeType: 'application/json',
            responseSchema: responseSchema,
        },
    });

    const jsonText = response.text.trim();
    const result = JSON.parse(jsonText);
    Logger.info('Received and parsed merge suggestion from Gemini API', result);
    
    return {
        content: result.mergedContent,
        enrichment: {
            ...result.enrichment,
            role: result.newRole, // Add the role to the enrichment object
        },
    };
  } catch(e) {
      Logger.error("Gemini API call failed", e);
      throw new Error("Failed to get merge suggestion from AI. Check if your API key is configured correctly in .env.");
  }
};
