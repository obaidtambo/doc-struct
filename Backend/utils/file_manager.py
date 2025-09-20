# utils/file_manager.py
import os
import time
import shutil
import joblib
from typing import Optional, Dict, Any

class FileManager:
    def __init__(self, input_dir: str, cache_dir: str, output_dir: str):
        self.input_dir = input_dir
        self.cache_dir = cache_dir
        self.output_dir = output_dir
        os.makedirs(self.input_dir, exist_ok=True)
        os.makedirs(self.cache_dir, exist_ok=True)
        os.makedirs(self.output_dir, exist_ok=True)

    def generate_unique_doc_id(self, filename: str) -> str:
        base_name = os.path.splitext(filename)[0]
        timestamp = int(time.time())
        return f"{base_name}_{timestamp}"

    def get_pdf_path(self, doc_id: str) -> str:
        return os.path.join(self.input_dir, f"{doc_id}.pdf")

    def get_cache_path(self, doc_id: str) -> str:
        return os.path.join(self.cache_dir, f"{doc_id}_azure_dump.joblib")

    def get_output_json_path(self, doc_id: str, suffix: str = "") -> str:
        if suffix:
            return os.path.join(self.output_dir, f"{doc_id}_{suffix}.json")
        return os.path.join(self.output_dir, f"{doc_id}.json")
    
    def save_file(self, file_content: bytes, file_path: str):
        with open(file_path, "wb") as buffer:
            buffer.write(file_content)

    def cleanup_pdf(self, doc_id: str):
        pdf_path = self.get_pdf_path(doc_id)
        if os.path.exists(pdf_path):
            os.remove(pdf_path)
            print(f"Cleaned up PDF: {pdf_path}")
    
    def load_cache(self, cache_file_path: str) -> Optional[Any]:
        if os.path.exists(cache_file_path):
            return joblib.load(cache_file_path)
        return None

    def save_cache(self, data: Any, cache_file_path: str):
        joblib.dump(data, cache_file_path)