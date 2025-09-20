# services/ocr_service.py
import os
import joblib
from azure.core.credentials import AzureKeyCredential
from azure.ai.documentintelligence import DocumentIntelligenceClient
from azure.ai.documentintelligence.models import DocumentSpan, BoundingRegion, DocumentParagraph, DocumentSection # Use actual SDK models
import json
from typing import Dict, Any, List, Tuple

from utils.file_manager import FileManager
from schemas.document import PageDimensions # Import our Pydantic model

class AzureObjectEncoder(json.JSONEncoder):
    """
    A robust JSON encoder that correctly serializes specific objects from the
    Azure Document Intelligence SDK into dictionaries. This is used for storing
    raw_ocr_result in the DB, not for the final DocumentState.
    """
    def default(self, o):
        # Handle SDK models directly if they have a .as_dict() or similar
        if hasattr(o, 'as_dict'):
            return o.as_dict()
        if hasattr(o, '__dict__'): # Fallback for other objects
            return {k: v for k, v in o.__dict__.items() if not k.startswith('_')}
        try:
            return super().default(o)
        except TypeError:
            return str(o)

class ContentNode:
    """
    Represents a node in the document hierarchy.
    Initialized with an Azure SDK DocumentSection object and a generated unique ID.
    NOTE: __init__ signature is kept as requested, without content_elements parameter.
    """
    def __init__(self, section_id: str, section_obj: Any): # section_obj can be Azure Section or a dummy {}
        self.section_id = section_id
        # Convert SDK Span objects to dicts for JSON serialization if they exist
        self.spans = [span.as_dict() if hasattr(span, 'as_dict') else span 
                      for span in getattr(section_obj, 'spans', [])]
        self.element_refs = getattr(section_obj, 'elements', []) or []
        
        # Initialize content_elements here, it will be populated later
        self.content_elements: List[Dict[str, Any]] = []  
        
        self.children: List['ContentNode'] = []

    def to_dict(self) -> Dict[str, Any]:
        """
        Recursively converts the node and its children to a dictionary,
        making it ready for JSON serialization.
        """
        return {
            "section_id": self.section_id,
            "metadata": {
                "spans": self.spans,
                "element_refs": self.element_refs
            },
            "content": self.content_elements, 
            "children": [child.to_dict() for child in self.children]
        }


class OCRService:
    def __init__(self, azure_endpoint: str, azure_key: str, file_manager: FileManager):
        self.azure_endpoint = azure_endpoint
        self.azure_key = azure_key
        self.file_manager = file_manager
        self.client = DocumentIntelligenceClient(
            endpoint=self.azure_endpoint, credential=AzureKeyCredential(self.azure_key)
        )
        self.raw_azure_result: Optional[Dict[str, Any]] = None # To store the raw result as dict

    async def _run_azure_ocr(self, pdf_path: str, cache_file_path: str) -> Any:
        # Load from cache if available
        cached_result = self.file_manager.load_cache(cache_file_path)
        if cached_result:
            print(f"Cache found ✅ Loading: {cache_file_path}")
            return cached_result
        else:
            print("No cache found ❌ Running Azure Document Intelligence OCR...")
            with open(pdf_path, "rb") as f:
                poller = self.client.begin_analyze_document(
                    "prebuilt-layout", f, content_type="application/pdf"
                )
                result = poller.result()
            
            self.file_manager.save_cache(result, cache_file_path)
            print(f"OCR done ✅ and cached at: {cache_file_path}")
            return result

    def _build_document_tree_from_azure_result(
        self,
        azure_result: Any, # This will be the DocumentAnalysisResult object
        doc_id: str
    ) -> Dict[str, Any]:
        """
        Builds a hierarchical tree following the snippet logic exactly.
        Uses indexed-based IDs instead of Azure SDK IDs.
        """
        all_paragraphs = azure_result.paragraphs if hasattr(azure_result, 'paragraphs') else []
        all_sections = azure_result.sections if hasattr(azure_result, 'sections') else []
        all_tables = azure_result.tables if hasattr(azure_result, 'tables') else []

        # 1. Create a lookup map for all content elements (paragraphs, tables, etc.)
        # Following snippet logic - use index-based keys
        content_map = {f"/paragraphs/{i}": para for i, para in enumerate(all_paragraphs)}
        if all_tables:
            content_map.update({f"/tables/{i}": table for i, table in enumerate(all_tables)})

        # Process content to add bounding box info (keep this logic as requested)
        processed_content_map = {}
        for key, content in content_map.items():
            if key.startswith("/paragraphs/"):
                content_dict = content.as_dict() if hasattr(content, 'as_dict') else content
                if content.bounding_regions and content.bounding_regions[0]:
                    content_dict['pageNumber'] = content.bounding_regions[0].page_number
                    polygon = content.bounding_regions[0].polygon
                    if polygon and len(polygon) >= 8:
                        x_coords = polygon[0::2]
                        y_coords = content.bounding_regions[0].polygon[1::2]
                        content_dict['boundingBox'] = {
                            'x': min(x_coords),
                            'y': min(y_coords),
                            'width': max(x_coords) - min(x_coords),
                            'height': max(y_coords) - min(y_coords)
                        }
                processed_content_map[key] = content_dict
            elif key.startswith("/tables/"):
                content_dict = content.as_dict() if hasattr(content, 'as_dict') else content
                if content.bounding_regions and content.bounding_regions[0]:
                    polygon = content.bounding_regions[0].polygon
                    if polygon and len(polygon) >= 8:
                        x_coords = polygon[0::2]
                        y_coords = content.bounding_regions[0].polygon[1::2]
                        content_dict['pageNumber'] = content.bounding_regions[0].page_number
                        content_dict['boundingBox'] = {
                            'x': min(x_coords),
                            'y': min(y_coords),
                            'width': max(x_coords) - min(x_coords),
                            'height': max(y_coords) - min(y_coords)
                        }
                processed_content_map[key] = content_dict

        # 2. Initialize all sections as ContentNode objects
        # Following snippet logic - use section-{i} format
        all_nodes = {f"section-{i}": ContentNode(f"section-{i}", sec) for i, sec in enumerate(all_sections)}
        
        child_node_ids = set()

        # 3. Build the tree structure and populate content
        # Following snippet logic exactly
        for section_id, node in all_nodes.items():
            for element_ref in node.element_refs:
                # Check if the element is a child section
                if element_ref.startswith("/sections/"):
                    child_index = int(element_ref.split('/')[-1])
                    child_id = f"section-{child_index}"
                    if child_id in all_nodes:
                        child_node_ids.add(child_id)
                        node.children.append(all_nodes[child_id])
                        
                # Check if the element is a content item (paragraph, table, etc.)
                elif element_ref in processed_content_map:
                    # Append the processed content (with bounding boxes as requested)
                    node.content_elements.append(processed_content_map[element_ref])

        # 4. Identify root nodes (those that are never children)
        # Following snippet logic - simple approach, no robust verification
        root_nodes = [node for section_id, node in all_nodes.items() if section_id not in child_node_ids]

        # 5. Convert the tree of objects to a list of dictionaries
        # Following snippet logic exactly
        tree_as_dict = [root.to_dict() for root in root_nodes]

        return {
            "document_id": doc_id,
            "document_structure": tree_as_dict
        }

    def _extract_page_dimensions(self, azure_result: Any) -> List[PageDimensions]:
        """
        Extracts page dimensions from the Azure Document Intelligence result
        and returns them as a list of Pydantic PageDimensions models.
        """
        page_dimensions_list = []
        if hasattr(azure_result, "pages") and azure_result.pages:
            for page in azure_result.pages:
                if hasattr(page, "page_number") and hasattr(page, "width") and hasattr(page, "height"):
                    page_dimensions_list.append(PageDimensions(
                        page_number=page.page_number,
                        width=page.width,
                        height=page.height
                    ))
        return page_dimensions_list

    async def run_ocr_and_build_tree(self, pdf_path: str, document_id: str) -> Tuple[Dict[str, Any], List[PageDimensions]]:
        """
        Runs OCR, extracts page dimensions, and builds the initial hierarchical tree.
        Returns the initial tree (as a dict) and the list of PageDimensions models.
        """
        cache_file = self.file_manager.get_cache_path(document_id)
        azure_result = await self._run_azure_ocr(pdf_path, cache_file)
        
        # Store the raw Azure result as a serializable dict for the database
        self.raw_azure_result = json.loads(json.dumps(azure_result, cls=AzureObjectEncoder))

        initial_tree_data = self._build_document_tree_from_azure_result(azure_result, document_id)
        page_dimensions = self._extract_page_dimensions(azure_result)

        return initial_tree_data, page_dimensions