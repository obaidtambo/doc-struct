# database/database.py
from sqlalchemy import create_engine
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import sessionmaker
from config import Config

SQLALCHEMY_DATABASE_URL = Config.DATABASE_URL

# For SQLite, check_same_thread=False is needed for multiple threads
# In production with PostgreSQL/MySQL, remove this.
engine = create_engine(
    SQLALCHEMY_DATABASE_URL, connect_args={"check_same_thread": False} if "sqlite" in SQLALCHEMY_DATABASE_URL else {}
)
# --- EXPORT SessionLocal ---
# Make SessionLocal available for import by other modules
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine) 

Base = declarative_base()

# Dependency for FastAPI to get DB session
def get_db():
    db = SessionLocal() # This uses the exported SessionLocal
    try:
        yield db
    finally:
        db.close()

# This function is a regular utility function and can be imported and called.
def create_db_tables():
    Base.metadata.create_all(bind=engine)