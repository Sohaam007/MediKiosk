"""
Configuration and environment variable management for MediKiosk backend.
"""
import os
from pathlib import Path

# Try importing dotenv to load local .env files
try:
    from dotenv import load_dotenv
    # Load .env from backend directory or project root
    env_path = Path(__file__).resolve().parent / ".env"
    if not env_path.exists():
        env_path = Path(__file__).resolve().parent.parent / ".env"
    if env_path.exists():
        load_dotenv(dotenv_path=env_path)
    else:
        load_dotenv()
except ImportError:
    pass

LLM_PROVIDER: str = os.getenv("LLM_PROVIDER", "gemini").lower()
GEMINI_API_KEY: str = os.getenv("GEMINI_API_KEY") or os.getenv("GOOGLE_API_KEY") or ""
GEMINI_MODEL: str = os.getenv("GEMINI_MODEL", "gemini-1.5-flash")
OPENAI_API_KEY: str = os.getenv("OPENAI_API_KEY", "")
PORT: int = int(os.getenv("PORT", "8000"))
DEBUG: bool = os.getenv("DEBUG", "false").lower() in ("true", "1", "yes")
