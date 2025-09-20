import { AnalyzedParagraph, PageDimension } from './types';
import { DEFAULT_PAGE_DIMENSIONS } from './constants';

/**
 * Generates a more unique ID than Date.now()
 * @param prefix - A prefix for the ID (e.g., 'merged')
 * @returns A unique string ID.
 */
export const generateUniqueId = (prefix: string): string => {
  return `${prefix}-${Math.random().toString(36).substring(2, 9)}`;
};

/**
 * Extracts page dimensions from the raw data if available, otherwise generates defaults.
 * This handles the edge case where the backend payload might not include page dimensions.
 * @param rawData - The raw parsed JSON object, which might contain a `pageDimensions` key.
 * @param paragraphs - The array of analyzed paragraphs to determine the number of pages.
 * @returns An array of PageDimension objects.
 */
export const extractOrGeneratePageDimensions = (rawData: any, paragraphs: AnalyzedParagraph[]): PageDimension[] => {
  if (rawData && Array.isArray(rawData.pageDimensions) && rawData.pageDimensions.length > 0) {
    return rawData.pageDimensions;
  }
  
  // If not found, generate defaults based on the pages present in the paragraph data.
  const pageNumbers = new Set<number>();
  paragraphs.forEach(p => {
    if (p.pageNumber) {
      pageNumbers.add(p.pageNumber);
    }
  });

  if (pageNumbers.size === 0) {
    return [];
  }

  const maxPage = Math.max(...Array.from(pageNumbers));
  const dimensions: PageDimension[] = [];
  for (let i = 1; i <= maxPage; i++) {
    dimensions.push({
      pageNumber: i,
      width: DEFAULT_PAGE_DIMENSIONS.width,
      height: DEFAULT_PAGE_DIMENSIONS.height,
    });
  }
  return dimensions;
};


/**
 * Normalizes the paragraph data to ensure it forms a valid tree structure with a single root.
 * - Creates a synthetic root node if one doesn't exist.
 * - Re-parents any orphaned nodes to the root.
 * - Recalculates the `level` of each node based on its depth in the tree.
 * @param paragraphs - The raw array of AnalyzedParagraphs.
 * @returns A cleaned and structured array of AnalyzedParagraphs.
 */
export const normalizeParagraphs = (paragraphs: AnalyzedParagraph[]): AnalyzedParagraph[] => {
  if (!paragraphs || paragraphs.length === 0) {
    return [];
  }

  const paragraphsById = new Map<string, AnalyzedParagraph>(paragraphs.map(p => [p.id, p]));
  let rootNode = paragraphs.find(p => !p.parentId || !paragraphsById.has(p.parentId));

  // If no root node is found, create a synthetic one.
  if (!rootNode) {
    rootNode = {
      id: 'synthetic-root',
      parentId: null,
      content: 'DOCUMENT',
      role: 'documentRoot',
      level: 0,
      boundingBox: null,
      pageNumber: null
    };
    paragraphsById.set(rootNode.id, rootNode);
  } else {
    // Ensure the found root node has a null parentId
    rootNode = { ...rootNode, parentId: null };
    paragraphsById.set(rootNode.id, rootNode);
  }

  const normalized: AnalyzedParagraph[] = [];
  const visited = new Set<string>();

  // Use a map to store children for efficient traversal
  const childrenMap = new Map<string, string[]>();
  paragraphs.forEach(p => {
    const parentId = p.parentId && paragraphsById.has(p.parentId) ? p.parentId : rootNode!.id;
    if (p.id !== rootNode!.id) { // A node cannot be its own child
        if (!childrenMap.has(parentId)) {
            childrenMap.set(parentId, []);
        }
        childrenMap.get(parentId)!.push(p.id);
    }
  });

  // Depth-first traversal to set levels correctly
  const traverse = (nodeId: string, level: number) => {
    if (visited.has(nodeId)) {
      return;
    }
    visited.add(nodeId);

    const node = paragraphsById.get(nodeId);
    if (node) {
      normalized.push({ ...node, level, parentId: node.id === rootNode!.id ? null : node.parentId });
      const children = childrenMap.get(nodeId) || [];
      for (const childId of children) {
        // Update the child's parent to ensure correctness
        const childNode = paragraphsById.get(childId)!;
        childNode.parentId = nodeId;
        traverse(childId, level + 1);
      }
    }
  };

  traverse(rootNode.id, 0);

  // Add any remaining unvisited nodes (cycles or disconnected components) as children of the root
  for (const para of paragraphs) {
    if (!visited.has(para.id)) {
       const fixedPara = { ...para, parentId: rootNode.id, level: 1 };
       paragraphsById.set(para.id, fixedPara);
       normalized.push(fixedPara);
       visited.add(para.id);
    }
  }
  
  // Return a sorted list based on the original order for stability, except for the root.
  const originalOrderMap = new Map(paragraphs.map((p, i) => [p.id, i]));
  return normalized.sort((a, b) => {
    if (a.id === rootNode?.id) return -1;
    if (b.id === rootNode?.id) return 1;
    return (originalOrderMap.get(a.id) ?? Infinity) - (originalOrderMap.get(b.id) ?? Infinity);
  });
};