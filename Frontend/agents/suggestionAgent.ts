import { AnalyzedParagraph } from "../types";

// A simple text similarity check (could be replaced with a more advanced one)
const areSimilar = (text1: string, text2: string): boolean => {
    // Heuristic 1: One paragraph ends without punctuation and the next starts with a lowercase letter.
    const lastChar1 = text1.trim().slice(-1);
    const firstChar2 = text2.trim().slice(0, 1);
    if (!'.?!'.includes(lastChar1) && firstChar2 === firstChar2.toLowerCase()) {
        return true;
    }
    
    // Heuristic 2: Both are short list-like items
    if (text1.length < 100 && text2.length < 100 && /^[-\u2022\u2023\u25E6\u2043\u2219*]/.test(text1.trim()) && /^[-\u2022\u2023\u25E6\u2043\u2219*]/.test(text2.trim())) {
        return true;
    }

    return false;
}

export const generateMergeSuggestions = (paragraphs: AnalyzedParagraph[]): string[][] => {
    const suggestions: string[][] = [];
    if (paragraphs.length < 2) {
        return suggestions;
    }

    for (let i = 0; i < paragraphs.length - 1; i++) {
        const currentPara = paragraphs[i];
        const nextPara = paragraphs[i+1];
        
        // Only suggest merging paragraphs at the same level with the same parent
        if (currentPara.level === nextPara.level && currentPara.parentId === nextPara.parentId) {
            if (areSimilar(currentPara.content, nextPara.content)) {
                // Check if this pair is already part of a suggestion group
                const existingGroup = suggestions.find(group => group.includes(currentPara.id));
                if (existingGroup) {
                    existingGroup.push(nextPara.id);
                } else {
                    suggestions.push([currentPara.id, nextPara.id]);
                }
            }
        }
    }
    return suggestions;
}
