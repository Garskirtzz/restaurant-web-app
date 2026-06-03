from pathlib import Path
from urllib.parse import parse_qs, urlencode, urlparse
import sys


PROJECT_ROOT = Path(__file__).resolve().parents[1]
if str(PROJECT_ROOT) not in sys.path:
    sys.path.insert(0, str(PROJECT_ROOT))

from server.app import RestaurantHandler, init_db  # noqa: E402


class handler(RestaurantHandler):
    def normalize_vercel_api_path(self):
        parsed = urlparse(self.path)
        query = parse_qs(parsed.query)
        forwarded_path = (query.pop("path", [""])[0] or "").strip("/")

        if parsed.path in ("/api", "/api/", "/api/index.py"):
            normalized_path = "/api"
            if forwarded_path:
                normalized_path += "/" + forwarded_path

            query_string = urlencode(query, doseq=True)
            self.path = normalized_path + (f"?{query_string}" if query_string else "")

    def handle_api_request(self, method):
        init_db()
        self.normalize_vercel_api_path()
        self.handle_api(method)

    def do_OPTIONS(self):
        self.normalize_vercel_api_path()
        super().do_OPTIONS()

    def do_GET(self):
        try:
            self.handle_api_request("GET")
        except ValueError as error:
            self.error_response(str(error), 400)
        except Exception as error:
            self.log_error_detail(error)
            self.error_response("Internal server error", 500)

    def do_POST(self):
        try:
            self.handle_api_request("POST")
        except ValueError as error:
            self.error_response(str(error), 400)
        except Exception as error:
            self.log_error_detail(error)
            self.error_response("Internal server error", 500)

    def do_PUT(self):
        try:
            self.handle_api_request("PUT")
        except ValueError as error:
            self.error_response(str(error), 400)
        except Exception as error:
            self.log_error_detail(error)
            self.error_response("Internal server error", 500)

    def do_DELETE(self):
        try:
            self.handle_api_request("DELETE")
        except ValueError as error:
            self.error_response(str(error), 400)
        except Exception as error:
            self.log_error_detail(error)
            self.error_response("Internal server error", 500)
