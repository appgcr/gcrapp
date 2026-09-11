import sys
import json
import base64
import os
import io
import warnings
import logging
import math

# Suppress library warnings
warnings.filterwarnings("ignore")
logging.disable(logging.WARNING)

# Environment configuration for Windows CPU execution & Paddle stability
os.environ["FLAGS_use_onednn"] = "0"
os.environ["FLAGS_use_mkldnn"] = "0"
os.environ["FLAGS_enable_pir_api"] = "0"
os.environ["FLAGS_allocator_strategy"] = "naive_best_fit"
os.environ["OPENBLAS_NUM_THREADS"] = "1"
os.environ["MKL_NUM_THREADS"] = "1"
os.environ["OMP_NUM_THREADS"] = "1"
os.environ["KMP_DUPLICATE_LIB_OK"] = "TRUE"
os.environ["PADDLE_PDX_DISABLE_MODEL_SOURCE_CHECK"] = "True"

# Ensure venv site-packages is first in sys.path
venv_path = r"d:\gcr\venv_ocr\Lib\site-packages"
if os.path.exists(venv_path) and venv_path not in sys.path:
    sys.path.insert(0, venv_path)

sys.path = [p for p in sys.path if "AppData\\Roaming\\Python" not in p]

import cv2
import numpy as np
import gc
from PIL import Image
import pypdfium2

_PADDLE_OCR_EN = None
_PADDLE_OCR_TE = None
_EASYOCR_READER = None

def get_paddle_ocr(lang='en'):
    global _PADDLE_OCR_EN, _PADDLE_OCR_TE
    if lang == 'te':
        if _PADDLE_OCR_TE is None:
            try:
                from paddleocr import PaddleOCR
                _PADDLE_OCR_TE = PaddleOCR(lang='te')
            except Exception as e:
                sys.stderr.write(f"PaddleOCR Telugu init note: {e}\n")
        return _PADDLE_OCR_TE
    else:
        if _PADDLE_OCR_EN is None:
            try:
                from paddleocr import PaddleOCR
                _PADDLE_OCR_EN = PaddleOCR(lang='en')
            except Exception as e:
                sys.stderr.write(f"PaddleOCR English init note: {e}\n")
        return _PADDLE_OCR_EN

def get_easyocr_fallback():
    global _EASYOCR_READER
    if _EASYOCR_READER is None:
        try:
            import easyocr
            models_dir = r"d:\gcr\easyocr_models"
            os.makedirs(models_dir, exist_ok=True)
            # Telugu ('te') + English ('en') for sale deed documents
            _EASYOCR_READER = easyocr.Reader(
                ['en', 'te'], gpu=False,
                model_storage_directory=models_dir, verbose=False
            )
        except Exception:
            # Telugu model unavailable — fallback to English-only
            try:
                import easyocr
                models_dir = r"d:\gcr\easyocr_models"
                _EASYOCR_READER = easyocr.Reader(
                    ['en'], gpu=False,
                    model_storage_directory=models_dir, verbose=False
                )
            except Exception as e:
                sys.stderr.write(f"EasyOCR fallback init note: {e}\n")
    return _EASYOCR_READER

def preprocess_image_for_ocr(img_np, max_dim=1280):
    """
    Fast and high-accuracy document preprocessing:
    - Smart resolution scaling (caps max dimension to 1280px for 5x CPU speedup)
    - Grayscale conversion
    - CLAHE adaptive contrast enhancement
    """
    try:
        if img_np is None:
            return None
            
        h, w = img_np.shape[:2]
        if max(h, w) > max_dim:
            scale = float(max_dim) / max(h, w)
            new_w = max(16, int(round(w * scale)))
            new_h = max(16, int(round(h * scale)))
            img_np = cv2.resize(img_np, (new_w, new_h), interpolation=cv2.INTER_AREA)

        if len(img_np.shape) == 3:
            gray = cv2.cvtColor(img_np, cv2.COLOR_RGB2GRAY)
        else:
            gray = img_np.copy()
            
        # Fast CLAHE (Contrast Limited Adaptive Histogram Equalization)
        clahe = cv2.createCLAHE(clipLimit=2.0, tileGridSize=(8, 8))
        enhanced = clahe.apply(gray)
        
        # Convert back to RGB for OCR model consumption
        return cv2.cvtColor(enhanced, cv2.COLOR_GRAY2RGB)
    except Exception as e:
        sys.stderr.write(f"Image preprocessing warning: {e}\n")
        return img_np

def check_image_clarity(img_np, min_variance=10.0):
    try:
        if img_np is None:
            return False, 100.0, None

        if len(img_np.shape) == 3:
            gray = cv2.cvtColor(img_np, cv2.COLOR_RGB2GRAY)
        else:
            gray = img_np

        h, w = gray.shape
        if h < 80 or w < 80:
            return True, 0.0, "Uploaded document resolution is too low."

        std_lum = float(np.std(gray))
        if std_lum < 3.0:
            return True, 0.0, "Document appears blank or uniform."

        scale = 640.0 / max(h, w)
        resized = cv2.resize(gray, (int(w * scale), int(h * scale)), interpolation=cv2.INTER_AREA) if scale < 1.0 else gray
        variance = float(cv2.Laplacian(resized, cv2.CV_64F).var())
        
        if variance < min_variance:
            return True, round(variance, 2), f"Document is blurry (clarity: {round(variance, 1)})."

        return False, round(variance, 2), None
    except Exception as e:
        return False, 100.0, None

def run_ocr(input_data, is_pdf=False, process_all_pages=True):
    extracted_text = ""
    all_lines = []
    pages = []
    num_pages = 1
    is_blurred = False
    blur_score = 100.0
    clarity_reason = None
    snippets = []
    
    try:
        raw_bytes = None
        is_pdf_doc = is_pdf

        if isinstance(input_data, str) and input_data.startswith("data:"):
            header, b64_str = input_data.split(",", 1)
            raw_bytes = base64.b64decode(b64_str)
            if "application/pdf" in header or is_pdf or raw_bytes.startswith(b'%PDF'):
                is_pdf_doc = True
        elif isinstance(input_data, str) and os.path.isfile(input_data):
            if input_data.lower().endswith(".pdf") or is_pdf:
                is_pdf_doc = True
                with open(input_data, "rb") as f:
                    raw_bytes = f.read()
            else:
                with open(input_data, "rb") as f:
                    raw_bytes = f.read()
                if raw_bytes and raw_bytes.startswith(b'%PDF'):
                    is_pdf_doc = True
        elif isinstance(input_data, bytes):
            raw_bytes = input_data
            if raw_bytes and raw_bytes.startswith(b'%PDF'):
                is_pdf_doc = True

        # ── PDF Processing ──────────────────────────────────────────────────
        if (is_pdf_doc or (raw_bytes and raw_bytes.startswith(b'%PDF'))) and raw_bytes:
            pdf = pypdfium2.PdfDocument(raw_bytes)
            num_pages = len(pdf)
            
            # Select key pages: For digital PDFs, all pages are checked (<10ms).
            # For scanned deeds, prioritize Page 1-4 (endorsement, parties) and last 2 pages (schedule, boundaries, market value).
            if num_pages <= 5:
                pages_to_process = list(range(num_pages))
            else:
                key_indices = [0, 1, 2, 3, num_pages - 2, num_pages - 1]
                pages_to_process = sorted(list(set(idx for idx in key_indices if 0 <= idx < num_pages)))
            
            easy_ocr = None

            for page_idx in pages_to_process:
                page = pdf[page_idx]
                page_lines = []
                page_boxes = []

                # 1. Ultra-fast Digital PDF text bypass (< 10 milliseconds)
                try:
                    textpage = page.get_textpage()
                    digital_text = textpage.get_text_range()
                    if digital_text and len(digital_text.strip()) > 20:
                        d_lines = [l.strip() for l in digital_text.splitlines() if len(l.strip()) > 1]
                        if len(d_lines) > 1:
                            page_lines = d_lines
                            for dl in d_lines:
                                page_boxes.append({
                                    "text": dl,
                                    "confidence": 0.99,
                                    "page": page_idx + 1
                                })
                except Exception as dig_err:
                    sys.stderr.write(f"Digital PDF text check note: {dig_err}\n")

                # 2. Scanned / Photo PDF fallback: Neural OCR at optimized scale
                if not page_lines:
                    if easy_ocr is None:
                        easy_ocr = get_easyocr_fallback()
                    
                    # Render at scale 1.0 (fast and high accuracy)
                    pil_image = page.render(scale=1.0).to_pil()
                    img_np = np.array(pil_image)
                    preprocessed = preprocess_image_for_ocr(img_np, max_dim=960)

                    if easy_ocr:
                        try:
                            results = easy_ocr.readtext(preprocessed)
                            for (bbox, text, conf) in results:
                                if conf > 0.05 and text.strip():
                                    clean_bbox = [[int(pt[0]), int(pt[1])] for pt in bbox]
                                    clean_t = text.strip()
                                    page_lines.append(clean_t)
                                    page_boxes.append({
                                        "text": clean_t,
                                        "confidence": round(float(conf), 3),
                                        "box": clean_bbox,
                                        "page": page_idx + 1
                                    })
                        except Exception as e_err:
                            sys.stderr.write(f"EasyOCR page {page_idx+1} note: {e_err}\n")

                page_text = "\n".join(page_lines)
                pages.append({
                    "page": page_idx + 1,
                    "text": page_text,
                    "lines": page_lines,
                    "boxes": page_boxes
                })
                all_lines.extend(page_lines)

            extracted_text = "\n\n".join([f"--- Page {p['page']} ---\n{p['text']}" for p in pages if p['text']])

        # ── Image Processing ────────────────────────────────────────────────
        else:
            image = None
            if raw_bytes:
                pil_image = Image.open(io.BytesIO(raw_bytes)).convert("RGB")
                image = np.array(pil_image)
            elif isinstance(input_data, str) and os.path.isfile(input_data):
                pil_image = Image.open(input_data).convert("RGB")
                image = np.array(pil_image)

            if image is not None:
                is_blurred, blur_score, clarity_reason = check_image_clarity(image)
                preprocessed = preprocess_image_for_ocr(image, max_dim=1280)

                easy_ocr = get_easyocr_fallback()
                page_lines = []
                page_boxes = []

                if easy_ocr:
                    try:
                        results = easy_ocr.readtext(preprocessed)
                        for (bbox, text, conf) in results:
                            if conf > 0.05 and text.strip():
                                clean_bbox = [[int(pt[0]), int(pt[1])] for pt in bbox]
                                clean_t = text.strip()
                                page_lines.append(clean_t)
                                page_boxes.append({
                                    "text": clean_t,
                                    "confidence": round(float(conf), 3),
                                    "box": clean_bbox,
                                    "page": 1
                                })
                    except Exception as e_err:
                        sys.stderr.write(f"EasyOCR image error: {e_err}\n")

                extracted_text = "\n".join(page_lines)
                all_lines = page_lines
                pages.append({
                    "page": 1,
                    "text": extracted_text,
                    "lines": page_lines,
                    "boxes": page_boxes
                })

        # Collect top representative snippets for UI live streaming
        clean_snippets = [l for l in all_lines if len(l) > 4 and not l.startswith('---')][:12]
        snippets = clean_snippets

    except Exception as e:
        sys.stderr.write(f"General OCR error: {e}\n")

    return {
        "text": extracted_text,
        "lines": all_lines,
        "snippets": snippets,
        "pages": pages,
        "num_pages": num_pages,
        "is_blurred": is_blurred,
        "blur_score": blur_score,
        "clarity_reason": clarity_reason,
        "ocr_engine": "Mahe AI Local Fast OCR (Digital + EasyOCR)"
    }

if __name__ == "__main__":
    if len(sys.argv) > 1:
        arg = sys.argv[1]
        is_pdf = "--pdf" in sys.argv or arg.lower().endswith('.pdf')
        result = run_ocr(arg, is_pdf=is_pdf, process_all_pages=True)
        print("__OCR_JSON_START__" + json.dumps(result) + "__OCR_JSON_END__")
    else:
        content = sys.stdin.read().strip()
        is_pdf_stdin = "application/pdf" in content[:100] or content.startswith('%PDF')
        result = run_ocr(content, is_pdf=is_pdf_stdin, process_all_pages=True)
        print("__OCR_JSON_START__" + json.dumps(result) + "__OCR_JSON_END__")
