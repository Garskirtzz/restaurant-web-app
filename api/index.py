from pathlib import Path
from urllib.parse import parse_qs, urlencode, urlparse
import sys


PROJECT_ROOT = Path(__file__).resolve().parents[1]
if str(PROJECT_ROOT) not in sys.path:
    sys.path.insert(0, str(PROJECT_ROOT))

from server.app import RestaurantHandler, ensure_db_initialized  # noqa: E402


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

    def dispatch(self, method):
        ensure_db_initialized()
        self.normalize_vercel_api_path()
        self.handle_api(method)

    def do_OPTIONS(self):
        self.normalize_vercel_api_path()
        super().do_OPTIONS()
