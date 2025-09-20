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
    """
    def __init__(self, section_id: str, section_obj: DocumentSection):
        self.section_id = section_id
        # Convert SDK Span objects to dicts for JSON serialization
        self.spans = [span.as_dict() if hasattr(span, 'as_dict') else span for span in section_obj.spans]
        self.element_refs = section_obj.elements or []
        self.content_elements = []  # To hold full paragraph/table dictionary objects
        self.children = []          # To hold child ContentNode objects

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
        Builds a hierarchical tree from Azure Document Intelligence's output,
        prioritizing explicit 'element_ref' links and falling back to order/heuristics
        if explicit linking is insufficient.
        """
        all_paragraphs = azure_result.paragraphs if hasattr(azure_result, 'paragraphs') else []
        all_sections = azure_result.sections if hasattr(azure_result, 'sections') else []
        all_tables = azure_result.tables if hasattr(azure_result, 'tables') else []

        # --- Data Preparation ---
        # Map all content elements (paragraphs, tables) to their explicit IDs provided by Azure.
        # Azure element IDs are typically like "/paragraphs/0", "/tables/1", "/sections/2"
        id_to_content_map = {}
        
        for para in all_paragraphs:
            element_id = para.id if hasattr(para, 'id') else None
            if element_id: # Only process if Azure provided an explicit ID for the element
                content_dict = para.as_dict() if hasattr(para, 'as_dict') else para
                # Enrich with pageNumber and boundingBox for ContentNode usage
                if para.bounding_regions and para.bounding_regions[0]:
                    content_dict['pageNumber'] = para.bounding_regions[0].page_number
                    # Calculate bounding box if polygon exists
                    polygon = para.bounding_regions[0].polygon
                    if polygon and len(polygon) >= 8: # Expecting [x1, y1, x2, y2, x3, y3, x4, y4]
                        content_dict['boundingBox'] = {
                            'x': min(polygon[0::2]),
                            'y': min(polygon[1::2]),
                            'width': max(polygon[0::2]) - min(polygon[0::2]),
                            'height': max(polygon[1::2]) - min(polygon[1::2])
                        }
                id_to_content_map[element_id] = content_dict

        for table in all_tables:
            element_id = table.id if hasattr(table, 'id') else None
            if element_id:
                content_dict = table.as_dict() if hasattr(table, 'as_dict') else table
                # Add pageNumber and boundingBox for tables if available
                if table.bounding_regions and table.bounding_regions[0]:
                    polygon = table.bounding_regions[0].polygon
                    if polygon and len(polygon) >= 8:
                        content_dict['pageNumber'] = table.bounding_regions[0].page_number
                        content_dict['boundingBox'] = {
                            'x': min(polygon[0::2]),
                            'y': min(polygon[1::2]),
                            'width': max(polygon[0::2]) - min(polygon[0::2]),
                            'height': max(polygon[1::2]) - min(polygon[1::2])
                        }
                id_to_content_map[element_id] = content_dict

        # --- Tree Construction Logic ---
        # Create ContentNode objects for all sections, keyed by their Azure ID.
        # We'll populate their content and children by iterating through their element_refs.
        section_nodes_by_id = {}
        for sec in all_sections:
            sec_id = sec.id if hasattr(sec, 'id') else None
            if sec_id: # Only process sections with valid IDs
                section_nodes_by_id[sec_id] = ContentNode(section_id=sec_id, section_obj=sec)

        # Track which section IDs have been explicitly assigned as children to ensure
        # only true root sections (those not referenced by others) become top-level in our output.
        explicitly_child_section_ids = set()

        # Iterate through each section node to build its content and child relationships
        for section_id, node in section_nodes_by_id.items():
            for element_ref in node.element_refs:
                if element_ref.startswith("/sections/"):
                    # This is a reference to a child section
                    child_section_id = element_ref # Azure IDs are typically like "/sections/0"
                    if child_section_id in section_nodes_by_id:
                        node.children.append(section_nodes_by_id[child_section_id])
                        explicitly_child_section_ids.add(child_section_id) # Mark this child as assigned
                elif element_ref.startswith("/paragraphs/") or element_ref.startswith("/tables/"):
                    # This is a reference to content within this section
                    if element_ref in id_to_content_map:
                        node.content_elements.append(id_to_content_map[element_ref])
                else:
                    # Log or handle other element types if necessary
                    pass
        
        # --- Identify Top-Level Sections (Roots of the Hierarchy) ---
        # Top-level sections are those that are not explicitly listed as children by any other section.
        root_sections_list = []
        for sec_id, node in section_nodes_by_id.items():
            if sec_id not in explicitly_child_section_ids:
                root_sections_list.append(node)

        # --- Create the final document structure ---
        # We need a "Document Root" element as per the output format.
        # The identified top-level sections will be its children.
        document_root_node = ContentNode(
            section_id="para-root", # Standard ID for the document root
            section_obj={},          # Dummy object as it's not from Azure directly
            content_elements=[]      # Document root itself usually doesn't have direct content like paragraphs
        )
        document_root_node.children = root_sections_list # Assign the top-level sections as children

        # Convert the tree rooted at document_root_node to the final dictionary structure
        final_tree_dict = {
            "document_id": doc_id,
            # The structure should be a list containing the document root
            "document_structure": [document_root_node.to_dict()] 
        }
        
        # Optional: Debug print of the generated tree
        # print(json.dumps(final_tree_dict, indent=2))

        return final_tree_dict


    # def _build_document_tree_from_azure_result(
    #     self,
    #     azure_result: Any, # This will be the DocumentAnalysisResult object
    #     doc_id: str
    # ) -> Dict[str, Any]:
    #     """
    #     Builds a hierarchical tree from the flat lists of sections and paragraphs
    #     provided by the Azure Document Intelligence SDK.
    #     """
    #     paragraphs = azure_result.paragraphs if hasattr(azure_result, 'paragraphs') else []
    #     sections = azure_result.sections if hasattr(azure_result, 'sections') else []
    #     tables = azure_result.tables if hasattr(azure_result, 'tables') else []

    #     # 1. Create a lookup map for all content elements
    #     content_map = {}
    #     for i, para in enumerate(paragraphs):
    #         # Convert SDK paragraph object to a dict for consistency
    #         content_map[f"/paragraphs/{i}"] = para.as_dict() if hasattr(para, 'as_dict') else para

    #     for i, table in enumerate(tables):
    #         content_map[f"/tables/{i}"] = table.as_dict() if hasattr(table, 'as_dict') else table

    #     # 2. Initialize all sections as ContentNode objects
    #     all_nodes = {f"section-{i}": ContentNode(f"section-{i}", sec) for i, sec in enumerate(sections)}
        
    #     child_node_ids = set()

    #     # 3. Build the tree structure and populate content
    #     for section_id, node in all_nodes.items():
    #         for element_ref in node.element_refs:
    #             # Check if the element is a child section
    #             if element_ref.startswith("/sections/"):
    #                 child_index = int(element_ref.split('/')[-1])
    #                 child_id = f"section-{child_index}"
    #                 if child_id in all_nodes:
    #                     child_node_ids.add(child_id)
    #                     all_nodes[section_id].children.append(all_nodes[child_id]) # Add to parent's children
                
    #             # Check if the element is a content item (paragraph, table, etc.)
    #             elif element_ref in content_map:
    #                 all_nodes[section_id].content_elements.append(content_map[element_ref])

    #     # 4. Identify root nodes (those that are never children)
    #     root_nodes = [node for section_id, node in all_nodes.items() if section_id not in child_node_ids]

    #     # 5. Convert the tree of objects to a list of dictionaries
    #     tree_as_dict = [root.to_dict() for root in root_nodes]

    #     print(tree_as_dict)
    #     return {
    #         "document_id": doc_id,
    #         "document_structure": tree_as_dict
    #     }

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