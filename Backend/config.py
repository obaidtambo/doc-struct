# config.py
import os
from dotenv import load_dotenv

load_dotenv() # Load environment variables from .env file

class Config:
    # Azure Document Intelligence
    AZURE_ENDPOINT: str = os.getenv("AZURE_ENDPOINT")
    AZURE_KEY: str = os.getenv("AZURE_KEY")

    # Google Gemini (for step 2)
    GEMINI_API_KEY: str = os.getenv("GEMINI_API_KEY")

    # Directories
    BASE_DIR: str = os.path.dirname(os.path.abspath(__file__))
    INPUT_DIR: str = os.path.join(BASE_DIR, "PDFs")
    CACHE_DIR: str = os.path.join(BASE_DIR, "Azure_Dump")
    OUTPUT_DIR: str = os.path.join(BASE_DIR, "Output_Directory")
    
    # Ensure directories exist
    os.makedirs(INPUT_DIR, exist_ok=True)
    os.makedirs(CACHE_DIR, exist_ok=True)
    os.makedirs(OUTPUT_DIR, exist_ok=True)

    # Database
    DATABASE_URL: str = os.getenv("DATABASE_URL")