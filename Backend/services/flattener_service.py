# # services/flattener_service.py
# import json
# import ast # Used for safely evaluating string representations of dicts/lists
# from typing import List, Dict, Any, Optional
# from pydantic import ValidationError

# from schemas.document import (
#     DocumentState, AnalyzedParagraph, BoundingBox, PageDimensions,
#     ParagraphEnrichment, HistoryEntry, UIState, HistoryActionPayload,
#     AIActionPayload, EditActionPayload, SplitActionPayload, DeleteActionPayload
# )
# from utils.file_manager import FileManager

# class TreeFlattener:
#     """
#     Transforms a nested document tree into a flat list of objects that perfectly
#     matches the specified front-end schema (DocumentState), including bounding box conversion.
#     It also initializes the history and UI state.
#     """

#     def __init__(self, file_manager: FileManager):
#         self.file_manager = file_manager
#         self.flat_list: List[AnalyzedParagraph] = []
#         self.id_counter = 1 # Counter for generating new unique IDs

#     def _sanitize_content_item(self, item: Any) -> Optional[Dict[str, Any]]:
#         """
#         Safely converts stringified dictionaries or lists found in Azure's output
#         (or anywhere else) back into actual dictionary objects.
#         """
#         if isinstance(item, dict):
#             return item
#         if isinstance(item, str):
#             try:
#                 # Use ast.literal_eval for safe evaluation of Python literals
#                 evaluated = ast.literal_eval(item)
#                 if isinstance(evaluated, (dict, list)):
#                     return evaluated
#             except (ValueError, SyntaxError, TypeError):
#                 pass # Ignore if it's not a valid literal string
#         # If it's not a dict, list, or a string that evaluates to one, return None.
#         return None

#     def _convert_polygon_to_xywh(self, polygon: Optional[List[float]]) -> Optional[BoundingBox]:
#         """
#         Converts an Azure polygon list [x1, y1, x2, y2...] into a UI-friendly
#         {x, y, width, height} BoundingBox object.
#         Returns None if polygon data is insufficient or invalid.
#         """
#         if not polygon or len(polygon) < 2:
#             return None # Indicate no valid bounding box data

#         # Extract all x and y coordinates
#         x_coords = polygon[0::2]
#         y_coords = polygon[1::2]

#         # Ensure we have at least two points for width/height calculation
#         if not x_coords or not y_coords:
#             return None

#         # Calculate the four values
#         x = min(x_coords)
#         y = min(y_coords)
#         width = max(x_coords) - x
#         height = max(y_coords) - y

#         # Return as a BoundingBox Pydantic model
#         return BoundingBox(x=x, y=y, width=width, height=height)

#     def _flatten_recursive(
#         self,
#         nodes: List[Dict[str, Any]],
#         parent_id: Optional[str],
#         level: int,
#         current_paragraphs: List[AnalyzedParagraph]
#     ):
#         """
#         Recursively traverses the nested tree structure and populates the flat list.
#         """
#         for node in nodes:
#             section_heading_item_dict: Optional[Dict[str, Any]] = None
            
#             # Process content items within this node first
#             node_content_dicts = [
#                 self._sanitize_content_item(c) for c in node.get('content', [])
#             ]
#             # Filter out any items that couldn't be sanitized
#             node_content_dicts = [c for c in node_content_dicts if c is not None]

#             # Try to find a primary heading or title within the node's content
#             for item_dict in node_content_dicts:
#                 if item_dict.get('role') in ('sectionHeading', 'title'):
#                     section_heading_item_dict = item_dict
#                     break # Found the primary heading for this node

#             # --- Create Paragraph for the Section Heading itself ---
#             # This represents the 'section' itself as a paragraph in the flat list
#             # For the root document, this will be the 'Document Root' paragraph
#             current_node_flat_id = f"para-{self.id_counter}"
#             self.id_counter += 1
            
#             section_content = node.get('section_id', 'Unnamed Section') # Use section_id if no heading content
#             section_role = "documentRoot" if parent_id is None else "sectionHeading"
#             section_level = 0 if parent_id is None else level # DocumentRoot is level 0
            
#             # If we found a specific heading, use its content and metadata
#             if section_heading_item_dict:
#                 section_content = section_heading_item_dict.get('content', section_content)
#                 section_role = section_heading_item_dict.get('role', section_role)
#                 # Level might be adjusted based on heading role, but usually follows node level
                
#             first_region = None
#             if section_heading_item_dict and section_heading_item_dict.get('boundingRegions'):
#                 first_region = section_heading_item_dict['boundingRegions'][0]
#             elif node.get('metadata') and node['metadata'].get('spans') and node['metadata']['spans'][0].get('boundingRegions'): # Fallback if heading not parsed separately
#                 first_region = node['metadata']['spans'][0]['boundingRegions'][0]


#             flat_heading_paragraph = AnalyzedParagraph(
#                 id=current_node_flat_id,
#                 parentId=parent_id,
#                 content=section_content,
#                 role=section_role,
#                 level=section_level,
#                 boundingBox=self._convert_polygon_to_xywh(first_region.get('polygon')) if first_region else None,
#                 pageNumber=first_region.get('pageNumber') if first_region else None,
#                 enrichment=None # No enrichment for the structural node itself
#             )
#             current_paragraphs.append(flat_heading_paragraph)
            
#             # This section's ID will be the parent for its internal content items
#             current_section_parent_id = current_node_flat_id 

#             # --- Create Paragraphs for the actual content items within this node ---
#             content_items_processed = 0
#             for content_item_dict in node_content_dicts:
#                 # Skip the heading if it was already processed as the section itself
#                 if section_heading_item_dict and content_item_dict == section_heading_item_dict:
#                     continue
                
#                 content_item_id = f"para-{self.id_counter}"
#                 self.id_counter += 1

#                 item_role = content_item_dict.get('role', 'paragraph') # Default to paragraph
#                 item_content = content_item_dict.get('content', '')
#                 item_level = level + 1 # Content items are usually one level deeper than their structural node
                
#                 item_bounding_regions = content_item_dict.get('boundingRegions')
#                 item_bbox = None
#                 item_page_num = None
#                 if item_bounding_regions and isinstance(item_bounding_regions, list) and item_bounding_regions:
#                     # Take the first bounding region for the paragraph
#                     first_region_data = item_bounding_regions[0]
#                     item_bbox = self._convert_polygon_to_xywh(first_region_data.get('polygon'))
#                     item_page_num = first_region_data.get('pageNumber')

#                 flat_content_paragraph = AnalyzedParagraph(
#                     id=content_item_id,
#                     parentId=current_section_parent_id, # Parent is the section heading we just created
#                     content=item_content,
#                     role=item_role,
#                     level=item_level,
#                     boundingBox=item_bbox,
#                     pageNumber=item_page_num,
#                     enrichment=None # Enrichment is typically added later or not present initially
#                 )
#                 current_paragraphs.append(flat_content_paragraph)
#                 content_items_processed += 1

#             # --- Recursively process children ---
#             if node.get('children'):
#                 # The current node's ID becomes the parent ID for its children's top-level paragraphs
#                 self._flatten_recursive(node['children'], parent_id=current_node_flat_id, level=level + 1, current_paragraphs=current_paragraphs)


#     def flatten(
#         self,
#         document_id: str,
#         hierarchical_data: Dict[str, Any],
#         page_dimensions_list: List[PageDimensions]
#     ) -> DocumentState:
#         """
#         Starts the flattening process and assembles the final DocumentState object.
#         """
#         root_nodes = hierarchical_data.get('document_structure', [])
        
#         # Initialize the flat list with the document root paragraph
#         document_root_id = "para-root" # Standard ID for the root
#         document_root_object = AnalyzedParagraph(
#             id=document_root_id,
#             parentId=None,
#             content=hierarchical_data.get('document_id', document_id), # Use doc ID as content
#             role="documentRoot",
#             level=0,
#             boundingBox=None,
#             pageNumber=None,
#             enrichment=None
#         )
#         self.flat_list.append(document_root_object)

#         # Start recursive flattening from the root nodes
#         self._flatten_recursive(
#             nodes=root_nodes,
#             parent_id=document_root_id, # Root paragraph is parent for top-level sections
#             level=1, # Top-level sections are at level 1
#             current_paragraphs=self.flat_list
#         )
        
#         # Assemble the final DocumentState object
#         final_state = DocumentState(
#             documentId=document_id,
#             pageDimensions=page_dimensions_list, # Use the list of Pydantic models
#             paragraphs=self.flat_list,
#             history=[], # Initialize with empty history
#             uiState=UIState() # Initialize with empty UI state
#             # initialParagraphs and mergeSuggestions are typically not generated here
#             # but could be populated if needed for the first load from backend.
#         )
        
#         return final_state

# class FlattenerService:
#     def __init__(self, file_manager: FileManager):
#         self.file_manager = file_manager

#     async def flatten_tree(
#         self,
#         document_id: str,
#         corrected_tree_data: Dict[str, Any],
#         page_dimensions_list: List[PageDimensions] # Expecting a list of Pydantic models
#     ) -> DocumentState:
#         """
#         Flattens the corrected hierarchical tree into the UI-compliant DocumentState format.
#         """
#         if not corrected_tree_data or not corrected_tree_data.get('document_structure'):
#             print("No corrected tree data provided for flattening.")
#             return None

#         print(f"Starting flattening for document: {document_id}")
        
#         flattener = TreeFlattener(self.file_manager)
#         final_state = flattener.flatten(
#             document_id=document_id,
#             hierarchical_data=corrected_tree_data,
#             page_dimensions_list=page_dimensions_list
#         )
        
#         # Optionally, save the flattened JSON for debugging
#         output_json_path = self.file_manager.get_output_json_path(document_id, suffix="flattened_initial")
#         try:
#             with open(output_json_path, 'w', encoding='utf-8') as f:
#                 # Use Pydantic's model_dump to serialize correctly
#                 json.dump(final_state.model_dump(by_alias=True), f, indent=2)
#             print(f"Flattened DocumentState saved to: {output_json_path}")
#         except Exception as e:
#             print(f"Error saving flattened document state: {e}")

#         return final_state

# services/flattener_service.py (Revised to sort content_elements by offset)

import json
import ast
from typing import List, Dict, Any, Optional
from pydantic import ValidationError

from schemas.document import (
    DocumentState, AnalyzedParagraph, BoundingBox, PageDimensions,
    ParagraphEnrichment, HistoryEntry, UIState, HistoryActionPayload,
    AIActionPayload, EditActionPayload, SplitActionPayload, DeleteActionPayload
)
from utils.file_manager import FileManager

class TreeFlattener:
    """
    Transforms a nested document tree into a flat list of objects that perfectly
    matches the specified front-end schema (DocumentState), including bounding box conversion
    and preserving visual order of content within sections.
    """

    def __init__(self, file_manager: FileManager):
        self.file_manager = file_manager
        self.flat_list: List[AnalyzedParagraph] = []
        self.id_counter = 1 # Counter for generating new unique IDs

    def _sanitize_content_item(self, item: Any) -> Optional[Dict[str, Any]]:
        """Safely converts stringified dictionaries/lists."""
        if isinstance(item, dict):
            return item
        if isinstance(item, str):
            try:
                evaluated = ast.literal_eval(item)
                if isinstance(evaluated, (dict, list)):
                    return evaluated
            except (ValueError, SyntaxError, TypeError):
                pass
        return None

    def _convert_polygon_to_xywh(self, polygon: Optional[List[float]]) -> Optional[BoundingBox]:
        """Converts Azure polygon to UI-friendly {x, y, width, height}."""
        if not polygon or len(polygon) < 2:
            return None

        x_coords = polygon[0::2]
        y_coords = polygon[1::2]

        if not x_coords or not y_coords:
            return None

        x = min(x_coords)
        y = min(y_coords)
        width = max(x_coords) - x
        height = max(y_coords) - y

        return BoundingBox(x=x, y=y, width=width, height=height)

    def _flatten_recursive(
        self,
        nodes: List[Dict[str, Any]],
        parent_id: Optional[str],
        level: int,
        current_paragraphs: List[AnalyzedParagraph]
    ):
        """
        Recursively traverses the nested tree structure, processes content, and populates the flat list.
        Crucially, it sorts content items by visual offset before processing.
        """
        for node in nodes:
            section_heading_item_dict: Optional[Dict[str, Any]] = None
            
            # Process content items within this node first
            node_content_dicts_unsorted = [
                self._sanitize_content_item(c) for c in node.get('content', [])
            ]
            # Filter out any items that couldn't be sanitized
            node_content_dicts_unsorted = [c for c in node_content_dicts_unsorted if c is not None]

            # Try to find a primary heading or title within the node's content for the section node itself
            for item_dict in node_content_dicts_unsorted:
                if item_dict.get('role') in ('sectionHeading', 'title'):
                    section_heading_item_dict = item_dict
                    break 

            # --- Create Paragraph for the Section Heading ---
            # This represents the 'section' itself as a paragraph in the flat list.
            current_node_flat_id = f"para-{self.id_counter}"
            self.id_counter += 1
            
            section_content = node.get('section_id', 'Unnamed Section') # Use section_id if no heading content
            section_role = "documentRoot" if parent_id is None else "sectionHeading" # Determine role
            section_level = 0 if parent_id is None else level # DocumentRoot is level 0
            
            if section_heading_item_dict:
                section_content = section_heading_item_dict.get('content', section_content)
                section_role = section_heading_item_dict.get('role', section_role)
                
            first_region = None # To capture bounding box/page for the section heading
            if section_heading_item_dict and section_heading_item_dict.get('boundingRegions'):
                first_region = section_heading_item_dict['boundingRegions'][0]
            elif node.get('metadata') and node['metadata'].get('spans') and node['metadata']['spans'][0].get('boundingRegions'):
                first_region = node['metadata']['spans'][0]['boundingRegions'][0]

            flat_heading_paragraph = AnalyzedParagraph(
                id=current_node_flat_id,
                parentId=parent_id,
                content=section_content,
                role=section_role,
                level=section_level,
                boundingBox=self._convert_polygon_to_xywh(first_region.get('polygon')) if first_region else None,
                pageNumber=first_region.get('pageNumber') if first_region else None,
                enrichment=None # No enrichment for the structural node itself
            )
            current_paragraphs.append(flat_heading_paragraph)
            
            # This section's ID becomes the parent for its internal content items
            current_section_parent_id = current_node_flat_id 

            # --- Create Paragraphs for the actual content items within this node ---
            # --- SORTING CONTENT ITEMS BY OFFSET ---
            # We sort the content items for THIS node based on pageNumber and vertical offset (y).
            # This ensures that when we flatten, the content within a section is in reading order.
            sorted_content_items_for_node = sorted(
                node_content_dicts_unsorted, # Use the cleaned, unsorted list
                key=lambda item: (
                    item.get('pageNumber', 1), # Primary sort by page
                    item.get('boundingBox', {}).get('y', float('inf')) if item.get('boundingBox') else float('inf') # Secondary sort by vertical offset
                )
            )
            
            for content_item_dict in sorted_content_items_for_node:
                # Skip the heading item if it was already used for the flat_heading_paragraph
                if section_heading_item_dict and content_item_dict == section_heading_item_dict:
                    continue
                
                content_item_id = f"para-{self.id_counter}"
                self.id_counter += 1

                item_role = content_item_dict.get('role', 'paragraph') # Default role
                item_content = content_item_dict.get('content', '')
                item_level = level + 1 # Content items are generally one level deeper than their structural node
                
                item_bbox = None
                item_page_num = None
                # Extract bounding box and page number from the content item itself
                if content_item_dict.get('boundingRegions') and isinstance(content_item_dict['boundingRegions'], list) and content_item_dict['boundingRegions']:
                    first_region_data = content_item_dict['boundingRegions'][0]
                    item_bbox = self._convert_polygon_to_xywh(first_region_data.get('polygon'))
                    item_page_num = first_region_data.get('pageNumber')

                flat_content_paragraph = AnalyzedParagraph(
                    id=content_item_id,
                    parentId=current_section_parent_id, # Parent is the section heading node we created
                    content=item_content,
                    role=item_role,
                    level=item_level,
                    boundingBox=item_bbox,
                    pageNumber=item_page_num,
                    enrichment=None # No enrichment generated at this stage
                )
                current_paragraphs.append(flat_content_paragraph)

            # --- Recursively process children ---
            if node.get('children'):
                # The current node's ID becomes the parent ID for its children's top-level paragraphs
                self._flatten_recursive(node['children'], parent_id=current_node_flat_id, level=level + 1, current_paragraphs=current_paragraphs)


    def flatten(
        self,
        document_id: str,
        hierarchical_data: Dict[str, Any],
        page_dimensions_list: List[PageDimensions]
    ) -> DocumentState:
        """
        Starts the flattening process and assembles the final DocumentState object.
        """
        root_nodes = hierarchical_data.get('document_structure', [])
        
        # Initialize the flat list with the document root paragraph
        document_root_id = "para-root" # Standard ID for the root
        document_root_object = AnalyzedParagraph(
            id=document_root_id,
            parentId=None,
            content=hierarchical_data.get('document_id', document_id), # Use doc ID as content for root
            role="documentRoot",
            level=0,
            boundingBox=None,
            pageNumber=None,
            enrichment=None
        )
        self.flat_list.append(document_root_object)

        # Start recursive flattening from the root nodes (which are the children of the document root)
        self._flatten_recursive(
            nodes=root_nodes,
            parent_id=document_root_id, # The 'para-root' is the parent for the top-level sections
            level=1, # Top-level sections start at level 1
            current_paragraphs=self.flat_list
        )
        
        # Assemble the final DocumentState object
        final_state = DocumentState(
            documentId=document_id,
            pageDimensions=page_dimensions_list, # Use the list of Pydantic models
            paragraphs=self.flat_list,           # The flattened list of AnalyzedParagraphs
            history=[],                          # Initialize with empty history
            uiState=UIState()                    # Initialize with empty UI state
        )
        
        return final_state

class FlattenerService:
    def __init__(self, file_manager: FileManager):
        self.file_manager = file_manager

    async def flatten_tree(
        self,
        document_id: str,
        corrected_tree_data: Dict[str, Any],
        page_dimensions_list: List[PageDimensions] # Expecting a list of Pydantic models
    ) -> DocumentState:
        """
        Flattens the corrected hierarchical tree into the UI-compliant DocumentState format.
        """
        if not corrected_tree_data or not corrected_tree_data.get('document_structure'):
            print("No corrected tree data provided for flattening.")
            return None

        print(f"Starting flattening for document: {document_id}")
        
        flattener = TreeFlattener(self.file_manager)
        final_state = flattener.flatten(
            document_id=document_id,
            hierarchical_data=corrected_tree_data,
            page_dimensions_list=page_dimensions_list
        )
        
        # Optionally, save the flattened JSON for debugging
        output_json_path = self.file_manager.get_output_json_path(document_id, suffix="flattened_initial")
        try:
            with open(output_json_path, 'w', encoding='utf-8') as f:
                # Use Pydantic's model_dump to serialize correctly
                json.dump(final_state.model_dump(by_alias=True), f, indent=2)
            print(f"Flattened DocumentState saved to: {output_json_path}")
        except Exception as e:
            print(f"Error saving flattened document state: {e}")

        return final_state