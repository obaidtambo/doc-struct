
export interface BoundingBox {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface AnalyzedParagraph {
  id: string;
  parentId: string | null;
  content: string;
  role: string | null;
  level: number;
  enrichment?: Record<string, string>;
  boundingBox: BoundingBox | null;
  pageNumber: number | null;
}

export enum ViewType {
  TABLE = 'TABLE',
  GRAPH = 'GRAPH',
}

export interface OcrBlock {
  text: string;
  boundingBox: BoundingBox;
  pageNumber: number;
  role?: string;
}

export interface PageDimension {
  pageNumber: number;
  width: number;
  height: number;
  unit: string;
}

export interface OcrExtractionResult {
    blocks: OcrBlock[];
    pageDimensions: PageDimension[];
}
