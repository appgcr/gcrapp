"""
GCR Property Valuation System — OCR Engine Configuration Settings
Handles environment discovery, language packs (eng + tel), and secure temp directory handling.
"""

import os
import sys
import logging
from pathlib import Path

# Load environment from .env if python-dotenv is installed
try:
    from dotenv import load_dotenv
    env_path = Path(__file__).resolve().parent.parent / '.env'
    if env_path.exists():
        load_dotenv(dotenv_path=env_path)
except ImportError:
    pass

# Environment Mode
PYTHON_ENV = os.getenv("PYTHON_ENV", "development").lower()

# Network & Daemon Settings
OCR_HOST = os.getenv("OCR_HOST", "127.0.0.1")
OCR_PORT = int(os.getenv("OCR_PORT", "5002"))
OCR_TIMEOUT_SECONDS = int(os.getenv("OCR_TIMEOUT_SECONDS", "60"))
OCR_MAX_FILE_SIZE_MB = int(os.getenv("OCR_MAX_FILE_SIZE_MB", "25"))
OCR_PARALLEL_WORKERS = int(os.getenv("OCR_PARALLEL_WORKERS", "2"))

# Languages: Default to English and Telugu for Andhra Pradesh / Telangana SBI sale deeds
OCR_LANGUAGE = os.getenv("OCR_LANGUAGE", "eng+tel")

# Tesseract paths (if using system binary fallback)
TESSERACT_CMD = os.getenv("TESSERACT_CMD", "")
TESSDATA_PREFIX = os.getenv("TESSDATA_PREFIX", "")

# Temp Directory Management
OCR_TEMP_DIRECTORY = os.getenv("OCR_TEMP_DIRECTORY", "./temp")
temp_path = Path(OCR_TEMP_DIRECTORY).resolve()
temp_path.mkdir(parents=True, exist_ok=True)

# Preprocessing & Resolution
PDF_DPI = int(os.getenv("PDF_DPI", "300"))
IMAGE_PREPROCESSING_ENABLED = os.getenv("IMAGE_PREPROCESSING_ENABLED", "true").lower() in ("true", "1", "yes")

# Gemini AI Vision Fallback (Optional)
GEMINI_ENABLED = os.getenv("GEMINI_ENABLED", "false").lower() in ("true", "1", "yes")
GEMINI_API_KEY = os.getenv("GEMINI_API_KEY", "")
GEMINI_MODEL = os.getenv("GEMINI_MODEL", "gemini-1.5-flash")

# Logging Configuration — NEVER EXPOSE DOCUMENT TEXTS OR SECRETS IN LOGS
LOG_LEVEL_STR = os.getenv("OCR_LOG_LEVEL", "INFO").upper()
LOG_LEVEL = getattr(logging, LOG_LEVEL_STR, logging.INFO)

logging.basicConfig(
    level=LOG_LEVEL,
    format="%(asctime)s [%(levelname)s] %(name)s: %(message)s",
    handlers=[logging.StreamHandler(sys.stdout)]
)

logger = logging.getLogger("GCR_OCR")

def validate_environment():
    """Validates runtime OCR setup without exposing credentials or document data."""
    logger.info("Initializing GCR OCR Engine settings in [%s] mode...", PYTHON_ENV)
    logger.info("Supported OCR languages: %s", OCR_LANGUAGE)
    logger.info("Temporary storage directory: %s", str(temp_path))
    
    if GEMINI_ENABLED:
        if not GEMINI_API_KEY:
            logger.warning("GEMINI_ENABLED is True but GEMINI_API_KEY is empty. Falling back to local offline OCR.")
        else:
            logger.info("Gemini Vision AI fallback is configured with model: %s", GEMINI_MODEL)
    else:
        logger.info("Gemini Vision AI is DISABLED. Running in 100% offline local OCR mode.")

validate_environment()
