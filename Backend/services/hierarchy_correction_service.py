# # services/hierarchy_correction_service.py
# import os
# import json
# import time
# import re
# import google.generativeai as genai
# from collections import defaultdict
# from typing import Dict, Any, List, Optional
# from utils.file_manager import FileManager
# from config import Config

# # Configure Gemini API
# genai.configure(api_key=Config.GEMINI_API_KEY)

# class AdvancedHierarchyValidator:
#     """
#     Validates and corrects document hierarchy using a true, level-by-level, bottom-up approach.
#     Performs both "promotion" (child to sibling) and "demotion" (sibling to child) checks.
#     """

#     def __init__(self, document_tree: Dict[str, Any]):
#         self.document_tree = document_tree
#         self._node_map: Dict[str, Dict[str, Any]] = {} # Maps node_id -> node object
#         self._parent_map: Dict[str, Optional[Dict[str, Any]]] = {} # Maps child_id -> parent node object
#         self._levels: defaultdict[int, List[str]] = defaultdict(list) # Maps depth -> list of node_ids
        
#         # Build all the necessary maps for efficient lookup
#         self._build_maps_and_levels(self.document_tree.get('document_structure', []), parent=None, depth=0)
        
#         self.llm_agent = genai.GenerativeModel(
#             model_name="gemini-1.5-pro-latest",
#             generation_config={"response_mime_type": "application/json"}
#         )

#     def _build_maps_and_levels(self, nodes: List[Dict[str, Any]], parent: Optional[Dict[str, Any]], depth: int):
#         """Recursively builds maps for lookups and groups nodes by depth."""
#         for node in nodes:
#             node_id = node['section_id']
#             self._node_map[node_id] = node
#             self._parent_map[node_id] = parent
#             self._levels[depth].append(node_id)
            
#             if node.get('children'):
#                 self._build_maps_and_levels(node['children'], parent=node, depth=depth + 1)

#     def _stringify_node_content(self, node: Optional[Dict[str, Any]], max_length: int = 200) -> str:
#         if not node: return "'[NONE]'"
#         # Prioritize finding a title/heading for a concise representation
#         for item in node.get('content', []):
#             if isinstance(item, dict) and item.get('role') in ('sectionHeading', 'title'):
#                 return f"'{item.get('content', '')}'"
#         # Fallback to first paragraph content
#         for item in node.get('content', []):
#             if isinstance(item, dict) and item.get('role') == 'paragraph':
#                 return f"'{item.get('content', '')[:max_length]}...'"
#         # If no content found, indicate that
#         return "'[No Title/Content Available]'"


#     def _format_promotion_prompt(self, parent_node: Dict[str, Any], child_node: Dict[str, Any]) -> str:
#         grandparent_node = self._parent_map.get(parent_node['section_id'])
#         prompt = f"""
#         You are a document structure analyst. Your task is to validate if a section is nested at the correct depth.

#         **Analysis Context:**
#         - Grandparent: {self._stringify_node_content(grandparent_node)}
#         - Parent Section: {parent_node['section_id']} ({self._stringify_node_content(parent_node)})
#         - Child Section (to validate): {child_node['section_id']} ({self._stringify_node_content(child_node)})

#         **Task:**
#         Is the "Child Section" a direct sub-topic of the "Parent Section"? Or is it a major, distinct topic that should be a sibling of the "Parent Section" under the "Grandparent"?
#         1. **BELONGS**: The child is correctly nested.
#         2. **PROMOTE**: The child should be moved up one level to become a sibling of its current parent.

#         **Response Format (JSON only):**
#         ```json
#         {{
#           "decision": "One of 'BELONGS' or 'PROMOTE'.",
#           "reasoning": "A brief explanation."
#         }}
#         ```
#         """
#         return prompt

#     def _format_demotion_prompt(self, current_node: Dict[str, Any], next_node: Dict[str, Any]) -> str:
#         parent_node = self._parent_map.get(current_node['section_id'])
#         prompt = f"""
#         You are a document structure analyst. Your task is to determine the relationship between two adjacent sections.

#         **Analysis Context:**
#         - Parent: {self._stringify_node_content(parent_node)}
#         - Section A (Current): {current_node['section_id']} ({self._stringify_node_content(current_node)})
#         - Section B (Next Sibling): {next_node['section_id']} ({self._stringify_node_content(next_node)})

#         **Task:**
#         Is "Section B" a new topic at the same level as "Section A", or is it a sub-topic that should be a child of "Section A"?
#         1. **SIBLING**: Section B is a correct sibling.
#         2. **CHILD**: Section B should be demoted to become a child of Section A.

#         **Response Format (JSON only):**
#         ```json
#         {{
#           "relationship": "One of 'SIBLING' or 'CHILD'.",
#           "reasoning": "A brief explanation."
#         }}
#         ```
#         """
#         return prompt

#     def _validate_and_parse_llm_json(self, raw_text: str, expected_key: str, valid_values: List[str]) -> Optional[Dict[str, Any]]:
#         """AGENT: Validates JSON output against a dynamic schema."""
#         # Use regex to find JSON block enclosed in ```json ... ```
#         match = re.search(r"```json\s*\n({.*?})\n\s*```", raw_text, re.DOTALL)
#         json_str = match.group(1) if match else raw_text # Use the block if found, otherwise the whole text
        
#         try:
#             parsed_json = json.loads(json_str)
#             if expected_key not in parsed_json or parsed_json[expected_key] not in valid_values:
#                 raise ValueError(f"Schema error: Key '{expected_key}' missing or has invalid value. Expected one of {valid_values}, got '{parsed_json.get(expected_key)}'. Parsed JSON: {parsed_json}")
#             return parsed_json
#         except (json.JSONDecodeError, ValueError) as e:
#             print(f"Validation Agent Error: {e}")
#             print(f"Raw LLM response that failed parsing: {raw_text}")
#             return None

#     async def _call_llm_with_retry(self, prompt: str, expected_key: str, valid_values: List[str], max_retries: int = 3, delay: int = 5) -> Optional[Dict[str, Any]]:
#         """AGENT: Calls the LLM with retry logic and validates its JSON output."""
#         for attempt in range(max_retries):
#             try:
#                 print(f"Calling LLM (Attempt {attempt + 1}/{max_retries})...")
#                 # Using generate_content_async for async compatibility
#                 response = await self.llm_agent.generate_content_async(prompt)
                
#                 # Ensure response text exists and is not empty
#                 if not response.text:
#                     raise ValueError("LLM returned empty response.")
                    
#                 validated_output = self._validate_and_parse_llm_json(response.text, expected_key, valid_values)
#                 if validated_output:
#                     return validated_output
                
#                 # If validation failed, raise an error to trigger retry
#                 raise ValueError("LLM output failed validation.")
                
#             except Exception as e:
#                 print(f"LLM call attempt failed: {e}")
#                 if attempt < max_retries - 1:
#                     print(f"Retrying in {delay} seconds...")
#                     time.sleep(delay)
#                 else:
#                     print("Max retries reached. Could not get a valid response.")
#                     return None
#         return None # Should not be reached if max_retries > 0

#     # --- Main Validation Logic ---

#     def run_validation(self) -> Dict[str, Any]:
#         """
#         Executes the true bottom-up, two-way validation and correction process.
#         Modifies the self.document_tree in place.
#         """
#         print("--- Starting Advanced Bottom-Up Hierarchy Validation ---")
#         if not self._levels: 
#             print("No hierarchy levels found, skipping validation.")
#             return self.document_tree
        
#         max_depth = max(self._levels.keys())
        
#         # Iterate from the deepest level up to the root level (depth 0)
#         for depth in range(max_depth, -1, -1):
#             print(f"\n--- Processing Level {depth} ---")
#             # Iterate over a copy of the list as corrections might change it (nodes get moved)
#             # Use the current node_ids at this depth from our map, as it might have changed
#             current_level_node_ids = list(self._levels[depth])
            
#             for node_id in current_level_node_ids:
#                 # Check if the node still exists at this level or was moved/deleted
#                 if node_id not in self._node_map or self._parent_map.get(node_id) not in (self._node_map.get(self._parent_map.get(node_id)) if self._parent_map.get(node_id) else None): # Re-check parent validity
#                     # If node_id was promoted, it would have a new parent and depth
#                     # If node_id was demoted (as a child), its parent's children list changed
#                     # If node_id was deleted, it won't be in _node_map
#                     continue 
                
#                 current_node = self._node_map[node_id]
#                 parent_node = self._parent_map.get(node_id)
                
#                 # --- 1. PROMOTION CHECK (Child -> Sibling) ---
#                 # This check only makes sense if the node has a parent (i.e., is not a root)
#                 if parent_node:
#                     print(f"Checking for PROMOTION: [Parent: {parent_node['section_id']}] -> [Child: {node_id}]")
#                     prompt = self._format_promotion_prompt(parent_node, current_node)
#                     llm_result = self.llm_agent.generate_content(prompt) # Sync call is fine here if not blocking main thread
                    
#                     # Use the async version if integrating with FastAPI's async context
#                     # llm_result = await self._call_llm_with_retry(prompt, "decision", ["BELONGS", "PROMOTE"])

#                     # For demonstration, let's use a synchronous call or mock it.
#                     # In a real async FastAPI app, use await self._call_llm_with_retry(...)
#                     # For now, let's simulate a sync call. The actual async implementation is in _call_llm_with_retry.
#                     # To make this work in async `process_document_pipeline`, we'd need to await _call_llm_with_retry here.
#                     # For simplicity of this standalone service class, we'll assume a sync call for now,
#                     # but this is a key point for production async behavior.
                    
#                     # TEMPORARY MOCK FOR DEMO: Assume sync call or that _call_llm_with_retry is awaited where used
#                     # Actual async call in FastAPI context:
#                     # llm_result = await self._call_llm_with_retry(prompt, "decision", ["BELONGS", "PROMOTE"])

#                     # SIMULATED RESULT FOR NOW:
#                     simulated_result_promote = {"decision": "BELONGS", "reasoning": "Simulated"} 
#                     llm_result = simulated_result_promote # REMOVE THIS LINE FOR ACTUAL LLM CALL
                    
#                     if llm_result and llm_result['decision'] == 'PROMOTE':
#                         print(f"CORRECTION (PROMOTE): Moving '{node_id}' to be a sibling of '{parent_node['section_id']}'")
                        
#                         # --- Perform the move ---
#                         # Remove from parent's children list
#                         parent_node['children'].remove(current_node)
                        
#                         grandparent_node = self._parent_map.get(parent_node['section_id'])
                        
#                         if grandparent_node:
#                             grandparent_children = grandparent_node['children']
#                             # Insert after the original parent for logical ordering
#                             try:
#                                 parent_index = grandparent_children.index(parent_node)
#                                 grandparent_children.insert(parent_index + 1, current_node)
#                             except ValueError: # Parent might have been moved already in this pass
#                                 grandparent_children.append(current_node) # Append as last resort
#                         else: # Promoting to root level (no grandparent)
#                             self.document_tree['document_structure'].append(current_node)
                        
#                         # Update maps and audit flags
#                         current_node['llm_corrected_promotion'] = True
#                         # Update parent map for the promoted node
#                         self._parent_map[node_id] = grandparent_node 
                        
#                         # IMPORTANT: Re-initialize maps and levels if major structural changes occur,
#                         # or carefully update them. For simplicity, we'll skip deep map updates here
#                         # and assume the subsequent passes handle it, or re-run validation if needed.
#                         # For now, just ensure the immediate parent relationship is correct.

#                         # Skip demotion check for this node as it has moved up
#                         continue 

#                 # --- 2. DEMOTION CHECK (Sibling -> Child) ---
#                 # This check only makes sense if the node has siblings at the same level
#                 parent_children = self.document_tree['document_structure'] if not parent_node else parent_node.get('children', [])
#                 try:
#                     # Find current node's index in its parent's children list
#                     current_index = parent_children.index(current_node)
                    
#                     # Check if there's a next sibling
#                     if current_index < len(parent_children) - 1:
#                         next_node = parent_children[current_index + 1]
#                         print(f"Checking for DEMOTION: [{node_id}] -> [Next Sibling: {next_node['section_id']}]")
#                         prompt = self._format_demotion_prompt(current_node, next_node)
                        
#                         # TEMPORARY MOCK FOR DEMO: Assume sync call or that _call_llm_with_retry is awaited where used
#                         # Actual async call in FastAPI context:
#                         # llm_result = await self._call_llm_with_retry(prompt, "relationship", ["SIBLING", "CHILD"])
                        
#                         # SIMULATED RESULT FOR NOW:
#                         simulated_result_demote = {"relationship": "SIBLING", "reasoning": "Simulated"}
#                         llm_result = simulated_result_demote # REMOVE THIS LINE FOR ACTUAL LLM CALL

#                         if llm_result and llm_result['relationship'] == 'CHILD':
#                             print(f"CORRECTION (DEMOTE): Moving '{next_node['section_id']}' to be a child of '{node_id}'")
                            
#                             # --- Perform the move ---
#                             # Remove next_node from parent's children list
#                             parent_children.remove(next_node)
                            
#                             # Add next_node as a child of current_node
#                             current_node.setdefault('children', []).append(next_node)

#                             # Update maps and audit flags
#                             next_node['llm_corrected_demotion'] = True
#                             # Update parent map for the demoted node
#                             self._parent_map[next_node['section_id']] = current_node
                            
#                 except ValueError:
#                     # This can happen if current_node was already moved in this iteration
#                     print(f"Node {node_id} not found in its parent's children list during demotion check. It might have been moved.")
#                     pass # Node might have been moved already, continue

#         print("\n--- Validation Complete ---")
#         # Note: The document_tree is modified in-place.
#         return self.document_tree

# class HierarchyCorrectionService:
#     def __init__(self, file_manager: FileManager):
#         self.file_manager = file_manager
#         # Note: LLM agent is initialized within the validator,
#         # so it's instantiated when needed.

#     async def correct_hierarchy(
#         self,
#         document_id: str,
#         initial_tree_data: Dict[str, Any]
#     ) -> Optional[Dict[str, Any]]:
#         """
#         Applies LLM-based hierarchy correction to the initial document tree.
#         Returns the corrected tree structure.
#         """
#         if not initial_tree_data or not initial_tree_data.get('document_structure'):
#             print("No initial tree data provided for correction.")
#             return None

#         print(f"Starting hierarchy correction for document: {document_id}")
        
#         # Instantiate the validator with the tree data
#         validator = AdvancedHierarchyValidator(initial_tree_data)
        
#         # Run the validation and correction process
#         # NOTE: In a real async application, _call_llm_with_retry needs to be awaited.
#         # For demonstration here, we'll assume sync calls for LLM for simplicity of the service class.
#         # The actual FastAPI integration in main.py *must* use await for LLM calls if they are async.
#         corrected_tree = validator.run_validation()
        
#         # Optionally, save the corrected tree to a cache file for debugging
#         cache_path = os.path.join(Config.OUTPUT_DIR, f"{document_id}_corrected_tree.json")
#         try:
#             with open(cache_path, 'w', encoding='utf-8') as f:
#                 json.dump(corrected_tree, f, indent=2)
#             print(f"Corrected tree saved to: {cache_path}")
#         except Exception as e:
#             print(f"Error saving corrected tree cache: {e}")

#         return corrected_tree# services/hierarchy_correction_service.py (UPDATED for ASYNC LLM calls)
# import os
# import json
# import time
# import re
# import google.generativeai as genai
# from collections import defaultdict
# from typing import Dict, Any, List, Optional, Union
# from pydantic import ValidationError
# import copy

# from utils.file_manager import FileManager
# from config import Config

# # Configure Gemini API
# if not Config.GEMINI_API_KEY:
#     raise EnvironmentError("GEMINI_API_KEY not configured. Please set it in your .env file.")
# genai.configure(api_key=Config.GEMINI_API_KEY)

# class AdvancedHierarchyValidator:
#     """
#     Validates and corrects document hierarchy using a true, level-by-level, bottom-up approach.
#     Performs both "promotion" (child to sibling) and "demotion" (sibling to child) checks.
#     """

#     def __init__(self, document_tree: Dict[str, Any]):
#         self.document_tree = copy.deepcopy(document_tree)
#         self._node_map: Dict[str, Dict[str, Any]] = {}
#         self._parent_map: Dict[str, Optional[str]] = {}
#         self._levels: defaultdict[int, List[str]] = defaultdict(list)
        
#         self._build_maps_and_levels(self.document_tree.get('document_structure', []), parent_id=None, depth=0)
        
#         try:
#             self.llm_agent = genai.GenerativeModel(
#                 model_name="gemini-1.5-pro-latest",
#                 generation_config={"response_mime_type": "application/json"}
#             )
#         except Exception as e:
#             print(f"Error initializing Gemini Model: {e}")
#             raise e

#     def _build_maps_and_levels(self, nodes: List[Dict[str, Any]], parent_id: Optional[str], depth: int):
#         for node in nodes:
#             node_id = node.get('section_id')
#             if not node_id: continue
#             self._node_map[node_id] = node
#             self._parent_map[node_id] = parent_id
#             self._levels[depth].append(node_id)
#             if node.get('children'):
#                 self._build_maps_and_levels(node['children'], parent_id=node_id, depth=depth + 1)

#     def _stringify_node_content(self, node_id: Optional[str], max_length: int = 200) -> str:
#         if not node_id or node_id not in self._node_map: return "'[Node ID Not Found]'"
#         node = self._node_map[node_id]
#         for item in node.get('content', []):
#             if isinstance(item, dict) and item.get('role') in ('sectionHeading', 'title'):
#                 return f"'{item.get('content', '')}'"
#         for item in node.get('content', []):
#             if isinstance(item, dict) and item.get('role') == 'paragraph':
#                 return f"'{item.get('content', '')[:max_length]}...'"
#         return "'[No Title/Content Available]'"

#     def _format_promotion_prompt(self, parent_id: str, child_id: str) -> str:
#         prompt = f"""
#         You are a document structure analyst. Your task is to validate if a section is nested at the correct depth.
#         **Analysis Context:**
#         - Grandparent: {self._stringify_node_content(self._parent_map.get(parent_id))}
#         - Parent Section: {parent_id} ({self._stringify_node_content(parent_id)})
#         - Child Section (to validate): {child_id} ({self._stringify_node_content(child_id)})
#         **Task:** Is the "Child Section" a direct sub-topic of the "Parent Section"? Or is it a major, distinct topic that should be a sibling of the "Parent Section" under the "Grandparent"?
#         1. **BELONGS**: The child is correctly nested.
#         2. **PROMOTE**: The child should be moved up one level to become a sibling of its current parent.
#         **Response Format (JSON only):**
#         ```json
#         {{
#           "decision": "One of 'BELONGS' or 'PROMOTE'.",
#           "reasoning": "A brief explanation."
#         }}
#         ```
#         """
#         return prompt

#     def _format_demotion_prompt(self, current_id: str, next_id: str) -> str:
#         parent_id = self._parent_map.get(current_id)
#         prompt = f"""
#         You are a document structure analyst. Your task is to determine the relationship between two adjacent sections.
#         **Analysis Context:**
#         - Parent: {self._stringify_node_content(parent_id)}
#         - Section A (Current): {current_id} ({self._stringify_node_content(current_id)})
#         - Section B (Next Sibling): {next_id} ({self._stringify_node_content(next_id)})
#         **Task:** Is "Section B" a new topic at the same level as "Section A", or is it a sub-topic that should be a child of "Section A"?
#         1. **SIBLING**: Section B is a correct sibling.
#         2. **CHILD**: Section B should be demoted to become a child of Section A.
#         **Response Format (JSON only):**
#         ```json
#         {{
#           "relationship": "One of 'SIBLING' or 'CHILD'.",
#           "reasoning": "A brief explanation."
#         }}
#         ```
#         """
#         return prompt

#     def _validate_and_parse_llm_json(self, raw_text: str, expected_key: str, valid_values: List[str]) -> Optional[Dict[str, Any]]:
#         """AGENT: Validates JSON output against a dynamic schema, extracting from markdown code blocks."""
#         match = re.search(r"```json\s*\n({.*?})\n\s*```", raw_text, re.DOTALL)
#         json_str = match.group(1) if match else raw_text
#         try:
#             parsed_json = json.loads(json_str)
#             if expected_key not in parsed_json or parsed_json[expected_key] not in valid_values:
#                 raise ValueError(f"Schema error: Key '{expected_key}' missing or has invalid value. Expected one of {valid_values}, got '{parsed_json.get(expected_key)}'. Parsed JSON: {parsed_json}")
#             return parsed_json
#         except (json.JSONDecodeError, ValueError) as e:
#             print(f"Validation Agent Error: {e}")
#             print(f"Raw LLM response that failed parsing: {raw_text}")
#             return None

#     async def _call_llm_with_retry(self, prompt: str, expected_key: str, valid_values: List[str], max_retries: int = 3, delay: int = 5) -> Optional[Dict[str, Any]]:
#         """AGENT: Calls the LLM with retry logic and validates its JSON output."""
#         if not prompt: return None

#         for attempt in range(max_retries):
#             try:
#                 print(f"Calling LLM (Attempt {attempt + 1}/{max_retries})...")
#                 response = await self.llm_agent.generate_content_async(prompt)
                
#                 if not response.text:
#                     raise ValueError("LLM returned empty response.")
                    
#                 validated_output = self._validate_and_parse_llm_json(response.text, expected_key, valid_values)
#                 if validated_output:
#                     return validated_output
                
#                 raise ValueError("LLM output failed validation.")
                
#             except Exception as e:
#                 print(f"LLM call attempt failed: {e}")
#                 if attempt < max_retries - 1:
#                     print(f"Retrying in {delay} seconds...")
#                     time.sleep(delay)
#                 else:
#                     print("Max retries reached. Could not get a valid response.")
#                     return None
#         return None

#     # --- Main Validation Logic ---

#     async def run_validation(self) -> Dict[str, Any]: # Made async
#         """
#         Executes the true bottom-up, two-way validation and correction process.
#         Modifies the self.document_tree in place.
#         """
#         print("--- Starting Advanced Bottom-Up Hierarchy Validation ---")
#         if not self._levels: 
#             print("No hierarchy levels found, skipping validation.")
#             return self.document_tree
        
#         max_depth = max(self._levels.keys()) if self._levels else -1
        
#         for depth in range(max_depth, -1, -1):
#             print(f"\n--- Processing Level {depth} ---")
#             current_level_node_ids = list(self._levels[depth])
            
#             for node_id in current_level_node_ids:
#                 current_node = self._node_map.get(node_id)
#                 parent_id = self._parent_map.get(node_id)
                
#                 if not current_node or (parent_id is not None and parent_id not in self._node_map):
#                     continue 
                
#                 # --- 1. PROMOTION CHECK ---
#                 if parent_id:
#                     print(f"Checking for PROMOTION: [Parent: {parent_id}] -> [Child: {node_id}]")
#                     prompt = self._format_promotion_prompt(parent_id, node_id)
                    
#                     # Await the LLM call here
#                     llm_result = await self._call_llm_with_retry(prompt, "decision", ["BELONGS", "PROMOTE"])
                    
#                     if llm_result and llm_result['decision'] == 'PROMOTE':
#                         print(f"CORRECTION (PROMOTE): Moving '{node_id}' to be a sibling of '{parent_id}'")
                        
#                         parent_node_struct = self._node_map.get(parent_id)
#                         if parent_node_struct:
#                             parent_node_struct['children'] = [c for c in parent_node_struct.get('children', []) if c.get('section_id') != node_id]
                        
#                         grandparent_id = self._parent_map.get(parent_id)
                        
#                         if grandparent_id and grandparent_id in self._node_map:
#                             grandparent_node_struct = self._node_map[grandparent_id]
#                             grandparent_children = grandparent_node_struct.setdefault('children', [])
#                             try:
#                                 parent_index = next(i for i, child in enumerate(grandparent_children) if child.get('section_id') == parent_id)
#                                 grandparent_children.insert(parent_index + 1, current_node)
#                             except StopIteration: 
#                                 grandparent_children.append(current_node)
#                         else: 
#                             self.document_tree.setdefault('document_structure', []).append(current_node)
                        
#                         current_node['llm_corrected_promotion'] = True 
#                         self._parent_map[node_id] = grandparent_id 
#                         continue 

#                 # --- 2. DEMOTION CHECK ---
#                 parent_children_list_ref = None 
#                 if parent_id and parent_id in self._node_map:
#                     parent_node_struct = self._node_map[parent_id]
#                     parent_children_list_ref = parent_node_struct.setdefault('children', [])
#                 else:
#                     parent_children_list_ref = self.document_tree.setdefault('document_structure', [])

#                 if parent_children_list_ref:
#                     try:
#                         current_index = next(i for i, child in enumerate(parent_children_list_ref) if child.get('section_id') == node_id)
                        
#                         if current_index < len(parent_children_list_ref) - 1:
#                             next_node = parent_children_list_ref[current_index + 1]
#                             next_node_id = next_node.get('section_id')
                            
#                             if next_node_id:
#                                 print(f"Checking for DEMOTION: [{node_id}] -> [Next Sibling: {next_node_id}]")
#                                 prompt = self._format_demotion_prompt(node_id, next_node_id)
                                
#                                 # Await the LLM call here
#                                 llm_result = await self._call_llm_with_retry(prompt, "relationship", ["SIBLING", "CHILD"])

#                                 if llm_result and llm_result['relationship'] == 'CHILD':
#                                     print(f"CORRECTION (DEMOTE): Moving '{next_node_id}' to be a child of '{node_id}'")
                                    
#                                     parent_children_list_ref.pop(current_index + 1)
#                                     current_node.setdefault('children', []).append(next_node)

#                                     next_node['llm_corrected_demotion'] = True 
#                                     self._parent_map[next_node_id] = node_id
                                    
#                     except StopIteration: 
#                         print(f"Node {node_id} not found in its parent's children list during demotion check.")
#                         pass 
#                     except ValueError: 
#                          print(f"Node {node_id} ID inconsistency during demotion check.")
#                          pass

#         print("\n--- Validation Complete ---")
#         return self.document_tree

# class HierarchyCorrectionService:
#     def __init__(self, file_manager: FileManager):
#         self.file_manager = file_manager

#     async def correct_hierarchy(
#         self,
#         document_id: str,
#         initial_tree_data: Dict[str, Any]
#     ) -> Optional[Dict[str, Any]]:
#         """
#         Applies LLM-based hierarchy correction to the initial document tree.
#         Returns the corrected tree structure.
#         """
#         if not initial_tree_data or not initial_tree_data.get('document_structure'):
#             print("No initial tree data provided for correction.")
#             return None

#         print(f"Starting hierarchy correction for document: {document_id}")
        
#         validator = AdvancedHierarchyValidator(initial_tree_data)
        
#         try:
#             # Ensure this call is awaited as run_validation is now async
#             corrected_tree = await validator.run_validation() 
#         except Exception as e:
#             print(f"Error during validation execution for {document_id}: {e}")
#             return None
        
#         cache_path = os.path.join(Config.OUTPUT_DIR, f"{document_id}_corrected_tree.json")
#         try:
#             with open(cache_path, 'w', encoding='utf-8') as f:
#                 json.dump(corrected_tree, f, indent=2)
#             print(f"Corrected tree saved to: {cache_path}")
#         except Exception as e:
#             print(f"Error saving corrected tree cache: {e}")

#         return corrected_tree

# services/hierarchy_correction_service.py
import os
import json
import time
import re
import google.generativeai as genai
from collections import defaultdict
from typing import Dict, Any, List, Optional, Union
from pydantic import ValidationError
import copy

from utils.file_manager import FileManager
from config import Config

# Configure Gemini API
if not Config.GEMINI_API_KEY:
    raise EnvironmentError("GEMINI_API_KEY not configured. Please set it in your .env file.")
genai.configure(api_key=Config.GEMINI_API_KEY)

# --- Agent Definitions ---

class BaseAgent:
    """Base class for LLM agents, providing common utilities."""
    def __init__(self, model_name="gemini-1.5-pro-latest"):
        try:
            self.llm_agent = genai.GenerativeModel(
                model_name=model_name,
                generation_config={"response_mime_type": "application/json"}
            )
        except Exception as e:
            print(f"Error initializing LLM Model '{model_name}': {e}")
            raise e

    def _stringify_node_content(self, node_id: Optional[str], max_length: int = 200) -> str:
        """Helper to get a string representation of a node's content for prompts."""
        if not node_id or node_id not in self._node_map:
            return "'[Node Not Found]'"
        node = self._node_map[node_id]
        
        # Prioritize title/heading content
        for item in node.get('content', []):
            if isinstance(item, dict) and item.get('role') in ('sectionHeading', 'title'):
                return f"'{item.get('content', '')}'"
        # Fallback to first paragraph content
        for item in node.get('content', []):
            if isinstance(item, dict) and item.get('role') == 'paragraph':
                return f"'{item.get('content', '')[:max_length]}...'"
        return "'[No Relevant Content Found]'"

    def _validate_and_parse_llm_json(self, raw_text: str, expected_key: str, valid_values: List[str]) -> Optional[Dict[str, Any]]:
        """AGENT UTILITY: Validates JSON output, extracts from markdown, and checks schema."""
        match = re.search(r"```json\s*\n({.*?})\n\s*```", raw_text, re.DOTALL)
        json_str = match.group(1) if match else raw_text
        
        try:
            parsed_json = json.loads(json_str)
            if expected_key not in parsed_json or parsed_json[expected_key] not in valid_values:
                raise ValueError(f"Schema error: Key '{expected_key}' missing or has invalid value. Expected one of {valid_values}, got '{parsed_json.get(expected_key)}'. Parsed JSON: {parsed_json}")
            return parsed_json
        except (json.JSONDecodeError, ValueError) as e:
            print(f"LLM JSON Validation Error: {e}")
            print(f"Raw LLM response: {raw_text}")
            return None

    async def call_llm_with_retry(self, prompt: str, expected_key: str, valid_values: List[str], max_retries: int = 3, delay: int = 5) -> Optional[Dict[str, Any]]:
        """AGENT CORE: Calls the LLM with retry logic and validates its JSON output."""
        if not prompt: return None

        for attempt in range(max_retries):
            try:
                print(f"Agent calling LLM (Attempt {attempt + 1}/{max_retries})...")
                response = await self.llm_agent.generate_content_async(prompt)
                
                if not response.text:
                    raise ValueError("LLM returned empty response.")
                    
                validated_output = self._validate_and_parse_llm_json(response.text, expected_key, valid_values)
                if validated_output:
                    return validated_output
                
                raise ValueError("LLM output failed validation.")
                
            except Exception as e:
                print(f"LLM call attempt failed: {e}")
                if attempt < max_retries - 1:
                    print(f"Retrying in {delay} seconds...")
                    time.sleep(delay)
                else:
                    print("Max retries reached. Could not get a valid response.")
                    return None
        return None

class HierarchyAnalystAgent(BaseAgent):
    """AGENT: Determines if a child section belongs to its parent or should be promoted."""
    
    def __init__(self, node_map: Dict[str, Dict[str, Any]], parent_map: Dict[str, Optional[str]]):
        super().__init__()
        self._node_map = node_map # Pass node map for content stringification
        self._parent_map = parent_map # Pass parent map for context
        
    def _format_prompt(self, parent_id: str, child_id: str) -> str:
        parent_node = self._node_map.get(parent_id)
        prompt = f"""
        You are a document structure analyst. Your task is to validate if a section is nested at the correct depth.
        **Analysis Context:**
        - Parent Section: {parent_id} ({self._stringify_node_content(parent_id)})
        - Child Section (to validate): {child_id} ({self._stringify_node_content(child_id)})
        **Task:** Is the "Child Section" a direct sub-topic of the "Parent Section"? Or is it a major, distinct topic that should be a sibling of the "Parent Section"?
        1. **BELONGS**: The child is correctly nested.
        2. **PROMOTE**: The child should be moved up one level to become a sibling of its current parent.
        **Response Format (JSON only):**
        ```json
        {{
          "decision": "One of 'BELONGS' or 'PROMOTE'.",
          "reasoning": "A brief explanation."
        }}
        ```
        """
        return prompt

    async def analyze_parent_child_relationship(self, parent_id: str, child_id: str) -> Optional[Dict[str, Any]]:
        """Analyzes if a child node belongs to its parent or should be promoted."""
        prompt = self._format_prompt(parent_id, child_id)
        return await self.call_llm_with_retry(prompt, "decision", ["BELONGS", "PROMOTE"])

class RelationshipAnalystAgent(BaseAgent):
    """AGENT: Determines the relationship between two adjacent sibling sections."""
    
    def __init__(self, node_map: Dict[str, Dict[str, Any]], parent_map: Dict[str, Optional[str]]):
        super().__init__()
        self._node_map = node_map
        self._parent_map = parent_map

    def _format_prompt(self, current_id: str, next_id: str) -> str:
        parent_id = self._parent_map.get(current_id)
        prompt = f"""
        You are a document structure analyst. Your task is to determine the relationship between two adjacent sections.
        **Analysis Context:**
        - Parent: {self._stringify_node_content(parent_id)}
        - Section A (Current): {current_id} ({self._stringify_node_content(current_id)})
        - Section B (Next Sibling): {next_id} ({self._stringify_node_content(next_id)})
        **Task:** Is "Section B" a new topic at the same level as "Section A", or is it a sub-topic that should be a child of "Section A"?
        1. **SIBLING**: Section B is a correct sibling.
        2. **CHILD**: Section B should be demoted to become a child of Section A.
        **Response Format (JSON only):**
        ```json
        {{
          "relationship": "One of 'SIBLING' or 'CHILD'.",
          "reasoning": "A brief explanation."
        }}
        """
        return prompt

    async def analyze_sibling_relationship(self, current_id: str, next_id: str) -> Optional[Dict[str, Any]]:
        """Analyzes if a next sibling should become a child or remain a sibling."""
        prompt = self._format_prompt(current_id, next_id)
        return await self.call_llm_with_retry(prompt, "relationship", ["SIBLING", "CHILD"])

# Note: Content Assessor Agent is not strictly required for THIS specific validation task
# but could be added if more context was needed for the other agents.

class AdvancedHierarchyValidator:
    """
    Validates and corrects document hierarchy using specialized LLM agents.
    Performs bottom-up checks for promotion and demotion.
    """

    def __init__(self, document_tree: Dict[str, Any]):
        import copy
        self.document_tree = copy.deepcopy(document_tree)
        
        self._node_map: Dict[str, Dict[str, Any]] = {} 
        self._parent_map: Dict[str, Optional[str]] = {} 
        self._levels: defaultdict[int, List[str]] = defaultdict(list)
        
        # Build maps (these are essential for LLM context stringification)
        self._build_maps_and_levels(self.document_tree.get('document_structure', []), parent_id=None, depth=0)
        
        # Initialize specialized agents
        self.hierarchy_analyst = HierarchyAnalystAgent(self._node_map, self._parent_map)
        self.relationship_analyst = RelationshipAnalystAgent(self._node_map, self._parent_map)

    def _build_maps_and_levels(self, nodes: List[Dict[str, Any]], parent_id: Optional[str], depth: int):
        """Recursively builds maps for lookups."""
        for node in nodes:
            node_id = node.get('section_id')
            if not node_id: continue # Skip nodes without ID
            self._node_map[node_id] = node
            self._parent_map[node_id] = parent_id
            self._levels[depth].append(node_id)
            if node.get('children'):
                self._build_maps_and_levels(node['children'], parent_id=node_id, depth=depth + 1)

    async def run_validation(self) -> Dict[str, Any]: # Made async
        """
        Executes the LLM-driven validation and correction process.
        Modifies the self.document_tree in place.
        """
        print("--- Starting Agent-Driven Hierarchy Validation ---")
        if not self._levels: 
            print("No hierarchy levels found, skipping validation.")
            return self.document_tree
        
        max_depth = max(self._levels.keys()) if self._levels else -1
        
        # Iterate from the deepest level up to the root level (depth 0)
        for depth in range(max_depth, -1, -1):
            print(f"\n--- Processing Level {depth} ---")
            current_level_node_ids = list(self._levels[depth])
            
            for node_id in current_level_node_ids:
                current_node = self._node_map.get(node_id)
                parent_id = self._parent_map.get(node_id)
                
                # Skip if node or its parent is no longer valid in maps
                if not current_node or (parent_id is not None and parent_id not in self._node_map):
                    continue 
                
                # --- 1. PROMOTION CHECK (using HierarchyAnalystAgent) ---
                if parent_id: # Only check promotion if the node has a parent
                    print(f"Hierarchy Analyst: Checking PROMOTION for Parent '{parent_id}' -> Child '{node_id}'")
                    llm_result = await self.hierarchy_analyst.analyze_parent_child_relationship(parent_id, node_id)
                    
                    if llm_result and llm_result['decision'] == 'PROMOTE':
                        print(f"AGENT CORRECTION (PROMOTE): Moving '{node_id}' to be sibling of '{parent_id}'")
                        
                        # --- Perform structural change: Move node up ---
                        parent_node_struct = self._node_map.get(parent_id)
                        if parent_node_struct:
                            parent_node_struct['children'] = [c for c in parent_node_struct.get('children', []) if c.get('section_id') != node_id]
                        
                        grandparent_id = self._parent_map.get(parent_id)
                        
                        if grandparent_id and grandparent_id in self._node_map:
                            grandparent_node_struct = self._node_map[grandparent_id]
                            grandparent_children = grandparent_node_struct.setdefault('children', [])
                            try:
                                parent_index = next(i for i, child in enumerate(grandparent_children) if child.get('section_id') == parent_id)
                                grandparent_children.insert(parent_index + 1, current_node)
                            except StopIteration: 
                                grandparent_children.append(current_node)
                        else: 
                            self.document_tree.setdefault('document_structure', []).append(current_node)
                        
                        current_node['llm_corrected_promotion'] = True 
                        self._parent_map[node_id] = grandparent_id 
                        continue # Skip demotion check for this node as it has moved

                # --- 2. DEMOTION CHECK (Sibling -> Child using RelationshipAnalystAgent) ---
                parent_children_list_ref = None 
                if parent_id and parent_id in self._node_map:
                    parent_node_struct = self._node_map[parent_id]
                    parent_children_list_ref = parent_node_struct.setdefault('children', [])
                else:
                    parent_children_list_ref = self.document_tree.setdefault('document_structure', [])

                if parent_children_list_ref:
                    try:
                        current_index = next(i for i, child in enumerate(parent_children_list_ref) if child.get('section_id') == node_id)
                        
                        if current_index < len(parent_children_list_ref) - 1:
                            next_node = parent_children_list_ref[current_index + 1]
                            next_node_id = next_node.get('section_id')
                            
                            if next_node_id:
                                print(f"Relationship Analyst: Checking DEMOTION for [{node_id}] -> [Next Sibling: {next_node_id}]")
                                llm_result = await self.relationship_analyst.analyze_sibling_relationship(node_id, next_node_id)
                                
                                if llm_result and llm_result['relationship'] == 'CHILD':
                                    print(f"AGENT CORRECTION (DEMOTE): Moving '{next_node_id}' to be child of '{node_id}'")
                                    
                                    parent_children_list_ref.pop(current_index + 1)
                                    current_node.setdefault('children', []).append(next_node)

                                    next_node['llm_corrected_demotion'] = True 
                                    self._parent_map[next_node_id] = node_id
                                    
                    except StopIteration: 
                        print(f"Node {node_id} not found in its parent's children list during demotion check.")
                        pass 
                    except ValueError: 
                         print(f"Node {node_id} ID inconsistency during demotion check.")
                         pass

        print("\n--- Validation Complete ---")
        return self.document_tree

class HierarchyCorrectionService:
    def __init__(self, file_manager: FileManager):
        self.file_manager = file_manager
        # Agents will be instantiated within the correct_hierarchy method

    async def correct_hierarchy(
        self,
        document_id: str,
        initial_tree_data: Dict[str, Any]
    ) -> Optional[Dict[str, Any]]:
        """
        Applies LLM-based hierarchy correction to the initial document tree
        using specialized agents. Returns the corrected tree structure.
        """
        if not initial_tree_data or not initial_tree_data.get('document_structure'):
            print("No initial tree data provided for correction.")
            return None

        print(f"Starting hierarchy correction for document: {document_id}")
        
        # Instantiate the validator with the tree data
        validator = AdvancedHierarchyValidator(initial_tree_data)
        
        try:
            # Run the validation process, which now uses async LLM agents
            corrected_tree = await validator.run_validation() 
        except Exception as e:
            print(f"Error during validation execution for {document_id}: {e}")
            return None
        
        # Optionally, save the corrected tree to a cache file for debugging
        cache_path = os.path.join(Config.OUTPUT_DIR, f"{document_id}_corrected_tree.json")
        try:
            with open(cache_path, 'w', encoding='utf-8') as f:
                json.dump(corrected_tree, f, indent=2)
            print(f"Corrected tree saved to: {cache_path}")
        except Exception as e:
            print(f"Error saving corrected tree cache: {e}")

        return corrected_tree