import sys
import json
import os
import io
import warnings
import logging
from http.server import HTTPServer, BaseHTTPRequestHandler
from socketserver import ThreadingMixIn

class ThreadingHTTPServer(ThreadingMixIn, HTTPServer):
    """Threaded OCR server to handle concurrent document validation requests without blocking."""
    daemon_threads = True

# Suppress all library warnings and verbose logs
warnings.filterwarnings("ignore")
logging.disable(logging.WARNING)

os.environ["FLAGS_use_onednn"] = "0"
os.environ["FLAGS_use_mkldnn"] = "0"
os.environ["FLAGS_enable_pir_api"] = "0"
os.environ["FLAGS_allocator_strategy"] = "naive_best_fit"
os.environ["OPENBLAS_NUM_THREADS"] = "1"
os.environ["MKL_NUM_THREADS"] = "1"
os.environ["OMP_NUM_THREADS"] = "1"
os.environ["KMP_DUPLICATE_LIB_OK"] = "TRUE"

# Ensure venv site-packages is first in sys.path
venv_path = r"d:\gcr\venv_ocr\Lib\site-packages"
if os.path.exists(venv_path) and venv_path not in sys.path:
    sys.path.insert(0, venv_path)

sys.path = [p for p in sys.path if "AppData\\Roaming\\Python" not in p]

from ocr_engine import run_ocr, get_paddle_ocr

class OCRHandler(BaseHTTPRequestHandler):
    def log_message(self, format, *args):
        pass

    def do_GET(self):
        if self.path == '/health':
            self.send_response(200)
            self.send_header('Content-Type', 'application/json')
            self.end_headers()
            self.wfile.write(b'{"status":"ready","engine":"PaddleOCR (Local Self-Hosted)"}')
        else:
            self.send_response(404)
            self.end_headers()

    def do_POST(self):
        if self.path == '/ocr':
            try:
                content_length = int(self.headers.get('Content-Length', 0))
                body = self.rfile.read(content_length).decode('utf-8')
                req_json = json.loads(body)

                data = req_json.get('data', '')
                is_pdf = bool(req_json.get('isPdf', False))
                process_all = bool(req_json.get('processAllPages', True))

                result = run_ocr(data, is_pdf=is_pdf, process_all_pages=process_all)
                resp_bytes = json.dumps(result).encode('utf-8')

                self.send_response(200)
                self.send_header('Content-Type', 'application/json')
                self.send_header('Content-Length', str(len(resp_bytes)))
                self.end_headers()
                self.wfile.write(resp_bytes)
            except Exception as e:
                err_resp = json.dumps({"error": str(e), "text": "", "lines": [], "pages": [], "num_pages": 1, "is_blurred": False}).encode('utf-8')
                self.send_response(500)
                self.send_header('Content-Type', 'application/json')
                self.send_header('Content-Length', str(len(err_resp)))
                self.end_headers()
                self.wfile.write(err_resp)
        else:
            self.send_response(404)
            self.end_headers()

def run_server(port=5002):
    print(f"Pre-warming PaddleOCR reader (Telugu & English)...")
    get_paddle_ocr('en')
    get_paddle_ocr('te')
    server = ThreadingHTTPServer(('127.0.0.1', port), OCRHandler)
    print(f"Fast Local PaddleOCR Engine running on http://127.0.0.1:{port}")
    sys.stdout.flush()
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        server.server_close()

if __name__ == "__main__":
    port = 5002
    if len(sys.argv) > 1:
        try:
            port = int(sys.argv[1])
        except Exception:
            pass
    run_server(port)
