from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from urllib.parse import parse_qs, urlparse
import argparse
import hashlib
import hmac
import json
import mimetypes
import secrets
import sqlite3
from contextlib import contextmanager
from datetime import datetime, timezone


SERVER_DIR = Path(__file__).resolve().parent
PROJECT_ROOT = SERVER_DIR.parent
DB_PATH = SERVER_DIR / "restaurant.db"

ADMIN_USERNAME = "admin"
ADMIN_PASSWORD = "password123"


DEFAULT_CUSTOMERS = [
    {
        "username": "user1",
        "password": "user123",
        "name": "Pelanggan 1",
        "email": "user1@example.com",
        "phone": "081234567890",
        "address": "Jl. Contoh No. 1",
    },
    {
        "username": "user2",
        "password": "user123",
        "name": "Pelanggan 2",
        "email": "user2@example.com",
        "phone": "082345678901",
        "address": "Jl. Contoh No. 2",
    },
]

DEFAULT_MENU = [
    {
        "name": "Nasi Goreng Special",
        "category": "food",
        "price": 20000,
        "description": "Digoreng dengan bumbu rempah, telur, dan ayam suwir.",
        "image": "https://tse3.mm.bing.net/th/id/OIP.ClVYslsBXxKx4jlcnDzwdAAAAA?rs=1&pid=ImgDetMain&o=7&rm=3",
    },
    {
        "name": "Ayam Geprek",
        "category": "food",
        "price": 15000,
        "description": "Ayam krispi dan nasi hangat ditambah sambal yang pedas.",
        "image": "https://assets.pikiran-rakyat.com/crop/34x0:2161x1365/x/photo/2022/02/20/1241459943.jpg",
    },
    {
        "name": "Rice Bowl",
        "category": "food",
        "price": 22000,
        "description": "Perpaduan nasi, telur, dan daging dalam satu mangkuk.",
        "image": "https://cdn-brilio-net.akamaized.net/news/2024/05/29/286143/2281927-1000xauto-11-resep-rice-bowl-enak.jpg",
    },
    {
        "name": "Es Teh Manis",
        "category": "drink",
        "price": 5000,
        "description": "Teh melati dingin dengan gula tebu alami.",
        "image": "https://www.astronauts.id/blog/wp-content/uploads/2023/03/Beberapa-Resep-Es-Teh-Manis-Yang-Enggak-Ngebosenin-Untuk-Buka-Puasa-1024x683.jpg",
    },
    {
        "name": "Jus Alpukat",
        "category": "drink",
        "price": 12000,
        "description": "Buah Alpukat yang segar dengan es batu.",
        "image": "https://cdn.yummy.co.id/content-images/images/20220307/WxbiRNNZCXBodI5OG5Jvf6lHs6XrYIpP-31363436363535383236d41d8cd98f00b204e9800998ecf8427e.jpg",
    },
    {
        "name": "Jus Mangga",
        "category": "drink",
        "price": 15000,
        "description": "100% mangga harum manis tanpa tambahan gula.",
        "image": "https://s.kaskus.id/images/2017/12/22/10047354_20171222113742.png",
    },
    {
        "name": "Es Krim Vanilla",
        "category": "dessert",
        "price": 10000,
        "description": "Es krim lembut dengan aroma vanilla yang enak.",
        "image": "https://tse4.mm.bing.net/th/id/OIP.aUWwleENEOx37qj6WX8huQHaLN?w=768&h=1163&rs=1&pid=ImgDetMain&o=7&rm=3",
    },
    {
        "name": "Pisang Goreng Keju",
        "category": "dessert",
        "price": 15000,
        "description": "Pisang raja balut tepung renyah, tabur keju parut.",
        "image": "https://tse3.mm.bing.net/th/id/OIP.9huTUXggBuyZwQT3yQFSIgHaE7?rs=1&pid=ImgDetMain&o=7&rm=3",
    },
    {
        "name": "Kolak Pisang Ubi",
        "category": "dessert",
        "price": 20000,
        "description": "Kuah santan gula merah hangat, aroma pandan.",
        "image": "https://img-global.cpcdn.com/recipes/d66914757ea5acbb/680x482cq70/kolak-pisang-ubi-ungu-foto-resep-utama.jpg",
    },
]

DEFAULT_TABLES = [
    {"number": "1", "capacity": 4},
    {"number": "2", "capacity": 4},
    {"number": "3", "capacity": 6},
    {"number": "4", "capacity": 6},
    {"number": "5", "capacity": 2},
    {"number": "6", "capacity": 2},
    {"number": "7", "capacity": 8},
    {"number": "8", "capacity": 8},
]


def utc_now():
    return datetime.now(timezone.utc).isoformat()


@contextmanager
def connect_db():
    connection = sqlite3.connect(DB_PATH)
    connection.row_factory = sqlite3.Row
    connection.execute("PRAGMA foreign_keys = ON")
    try:
        yield connection
        connection.commit()
    except Exception:
        connection.rollback()
        raise
    finally:
        connection.close()


def hash_password(password, salt=None):
    salt = salt or secrets.token_hex(16)
    digest = hashlib.pbkdf2_hmac("sha256", password.encode("utf-8"), salt.encode("utf-8"), 120000)
    return f"pbkdf2_sha256${salt}${digest.hex()}"


def verify_password(password, stored_hash):
    try:
        algorithm, salt, expected = stored_hash.split("$", 2)
    except ValueError:
        return False

    if algorithm != "pbkdf2_sha256":
        return False

    candidate = hash_password(password, salt).split("$", 2)[2]
    return hmac.compare_digest(candidate, expected)


def row_to_dict(row):
    return dict(row) if row else None


def public_user(row):
    user = row_to_dict(row)
    if not user:
        return None

    user.pop("password_hash", None)
    return user


def init_db():
    SERVER_DIR.mkdir(exist_ok=True)

    with connect_db() as db:
        db.executescript(
            """
            CREATE TABLE IF NOT EXISTS users (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                username TEXT NOT NULL UNIQUE,
                password_hash TEXT NOT NULL,
                name TEXT NOT NULL,
                email TEXT DEFAULT '',
                phone TEXT DEFAULT '',
                address TEXT DEFAULT '',
                role TEXT NOT NULL CHECK(role IN ('admin', 'customer')),
                created_at TEXT NOT NULL
            );

            CREATE TABLE IF NOT EXISTS sessions (
                token TEXT PRIMARY KEY,
                user_id INTEGER NOT NULL,
                role TEXT NOT NULL,
                created_at TEXT NOT NULL,
                FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE
            );

            CREATE TABLE IF NOT EXISTS menu_items (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                name TEXT NOT NULL,
                category TEXT NOT NULL,
                price INTEGER NOT NULL,
                description TEXT DEFAULT '',
                image TEXT DEFAULT '',
                available INTEGER NOT NULL DEFAULT 1,
                created_at TEXT NOT NULL,
                updated_at TEXT NOT NULL
            );

            CREATE TABLE IF NOT EXISTS restaurant_tables (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                number TEXT NOT NULL UNIQUE,
                capacity INTEGER NOT NULL,
                created_at TEXT NOT NULL,
                updated_at TEXT NOT NULL
            );

            CREATE TABLE IF NOT EXISTS orders (
                id TEXT PRIMARY KEY,
                order_number TEXT NOT NULL,
                customer_user_id INTEGER,
                customer_username TEXT DEFAULT '',
                customer_name TEXT NOT NULL,
                table_number TEXT NOT NULL,
                total INTEGER NOT NULL,
                status TEXT NOT NULL DEFAULT 'pending',
                payment_method TEXT DEFAULT 'cash',
                timestamp TEXT NOT NULL,
                processed_at TEXT,
                completed_at TEXT,
                FOREIGN KEY(customer_user_id) REFERENCES users(id) ON DELETE SET NULL
            );

            CREATE TABLE IF NOT EXISTS order_items (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                order_id TEXT NOT NULL,
                name TEXT NOT NULL,
                price INTEGER NOT NULL,
                quantity INTEGER NOT NULL,
                subtotal INTEGER NOT NULL,
                FOREIGN KEY(order_id) REFERENCES orders(id) ON DELETE CASCADE
            );
            """
        )

        seed_user(db, ADMIN_USERNAME, ADMIN_PASSWORD, "Admin", "admin")

        for customer in DEFAULT_CUSTOMERS:
            seed_user(
                db,
                customer["username"],
                customer["password"],
                customer["name"],
                "customer",
                customer["email"],
                customer["phone"],
                customer["address"],
            )

        menu_count = db.execute("SELECT COUNT(*) AS total FROM menu_items").fetchone()["total"]
        if menu_count == 0:
            now = utc_now()
            db.executemany(
                """
                INSERT INTO menu_items (name, category, price, description, image, available, created_at, updated_at)
                VALUES (:name, :category, :price, :description, :image, 1, :created_at, :updated_at)
                """,
                [{**item, "created_at": now, "updated_at": now} for item in DEFAULT_MENU],
            )

        table_count = db.execute("SELECT COUNT(*) AS total FROM restaurant_tables").fetchone()["total"]
        if table_count == 0:
            now = utc_now()
            db.executemany(
                """
                INSERT INTO restaurant_tables (number, capacity, created_at, updated_at)
                VALUES (:number, :capacity, :created_at, :updated_at)
                """,
                [{**table, "created_at": now, "updated_at": now} for table in DEFAULT_TABLES],
            )


def seed_user(db, username, password, name, role, email="", phone="", address=""):
    exists = db.execute("SELECT id FROM users WHERE username = ?", (username,)).fetchone()
    if exists:
        return

    db.execute(
        """
        INSERT INTO users (username, password_hash, name, email, phone, address, role, created_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        """,
        (username, hash_password(password), name, email, phone, address, role, utc_now()),
    )


def generate_order_number():
    now = datetime.now()
    date_part = now.strftime("%y%m%d")
    random_part = secrets.randbelow(9000) + 1000
    return f"{date_part}{random_part}"


def make_session(db, user):
    token = secrets.token_urlsafe(32)
    db.execute(
        "INSERT INTO sessions (token, user_id, role, created_at) VALUES (?, ?, ?, ?)",
        (token, user["id"], user["role"], utc_now()),
    )
    return token


class RestaurantHandler(BaseHTTPRequestHandler):
    server_version = "RestaurantLocalAPI/1.0"

    def do_OPTIONS(self):
        self.send_response(204)
        self.add_cors_headers()
        self.end_headers()

    def do_GET(self):
        try:
            if self.path.startswith("/api/"):
                self.handle_api("GET")
            else:
                self.serve_static()
        except Exception as error:
            self.json_response({"error": str(error)}, 500)

    def do_POST(self):
        try:
            self.handle_api("POST")
        except Exception as error:
            self.json_response({"error": str(error)}, 500)

    def do_PUT(self):
        try:
            self.handle_api("PUT")
        except Exception as error:
            self.json_response({"error": str(error)}, 500)

    def do_DELETE(self):
        try:
            self.handle_api("DELETE")
        except Exception as error:
            self.json_response({"error": str(error)}, 500)

    def log_message(self, format_string, *args):
        print("[%s] %s" % (datetime.now().strftime("%H:%M:%S"), format_string % args))

    def add_cors_headers(self):
        self.send_header("Access-Control-Allow-Origin", "*")
        self.send_header("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS")
        self.send_header("Access-Control-Allow-Headers", "Content-Type, Authorization")

    def json_response(self, payload, status=200):
        body = json.dumps(payload, ensure_ascii=False).encode("utf-8")
        self.send_response(status)
        self.add_cors_headers()
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Content-Length", str(len(body)))
        self.end_headers()
        self.wfile.write(body)

    def read_json(self):
        content_length = int(self.headers.get("Content-Length", "0") or 0)
        if content_length == 0:
            return {}

        raw_body = self.rfile.read(content_length).decode("utf-8")
        try:
            return json.loads(raw_body)
        except json.JSONDecodeError:
            raise ValueError("Request body harus JSON valid")

    def get_auth_user(self):
        auth_header = self.headers.get("Authorization", "")
        prefix = "Bearer "
        if not auth_header.startswith(prefix):
            return None

        token = auth_header[len(prefix) :].strip()
        with connect_db() as db:
            row = db.execute(
                """
                SELECT users.*
                FROM sessions
                JOIN users ON users.id = sessions.user_id
                WHERE sessions.token = ?
                """,
                (token,),
            ).fetchone()
            return row_to_dict(row)

    def require_user(self, role=None):
        user = self.get_auth_user()
        if not user:
            self.json_response({"error": "Unauthorized"}, 401)
            return None

        if role and user["role"] != role:
            self.json_response({"error": "Forbidden"}, 403)
            return None

        return user

    def handle_api(self, method):
        parsed = urlparse(self.path)
        path = parsed.path.rstrip("/") or "/"
        query = parse_qs(parsed.query)

        if method == "GET" and path == "/api/health":
            self.json_response({"ok": True, "database": str(DB_PATH)})
            return

        if method == "POST" and path == "/api/auth/customer/register":
            self.register_customer()
            return

        if method == "POST" and path == "/api/auth/customer/login":
            self.login_user("customer")
            return

        if method == "POST" and path == "/api/auth/admin/login":
            self.login_user("admin")
            return

        if method == "GET" and path == "/api/users/me":
            user = self.require_user()
            if user:
                self.json_response({"user": public_user(user)})
            return

        if method == "GET" and path == "/api/users/customers":
            if not self.require_user("admin"):
                return
            self.list_customers()
            return

        if path == "/api/menu":
            if method == "GET":
                self.list_menu()
            elif method == "POST":
                if self.require_user("admin"):
                    self.create_menu_item()
            else:
                self.json_response({"error": "Method not allowed"}, 405)
            return

        if path.startswith("/api/menu/"):
            item_id = path.split("/")[-1]
            if method == "PUT":
                if self.require_user("admin"):
                    self.update_menu_item(item_id)
            elif method == "DELETE":
                if self.require_user("admin"):
                    self.delete_menu_item(item_id)
            else:
                self.json_response({"error": "Method not allowed"}, 405)
            return

        if path == "/api/tables":
            if method == "GET":
                self.list_tables()
            elif method == "POST":
                if self.require_user("admin"):
                    self.create_table()
            else:
                self.json_response({"error": "Method not allowed"}, 405)
            return

        if path.startswith("/api/tables/"):
            table_id = path.split("/")[-1]
            if method == "PUT":
                if self.require_user("admin"):
                    self.update_table(table_id)
            elif method == "DELETE":
                if self.require_user("admin"):
                    self.delete_table(table_id)
            else:
                self.json_response({"error": "Method not allowed"}, 405)
            return

        if path == "/api/orders":
            if method == "GET":
                user = self.require_user()
                if user:
                    self.list_orders(user)
            elif method == "POST":
                user = self.require_user("customer")
                if user:
                    self.create_order(user)
            else:
                self.json_response({"error": "Method not allowed"}, 405)
            return

        if path.startswith("/api/orders/") and path.endswith("/status"):
            if method == "PUT":
                if self.require_user("admin"):
                    order_id = path.split("/")[-2]
                    self.update_order_status(order_id)
            else:
                self.json_response({"error": "Method not allowed"}, 405)
            return

        if method == "GET" and path == "/api/reports/best-seller":
            if self.require_user("admin"):
                self.best_seller_report(query)
            return

        self.json_response({"error": "Endpoint not found"}, 404)

    def serve_static(self):
        parsed = urlparse(self.path)
        route = parsed.path

        if route in ("", "/"):
            target = PROJECT_ROOT / "index.html"
        else:
            target = (PROJECT_ROOT / route.lstrip("/")).resolve()

        if not str(target).startswith(str(PROJECT_ROOT.resolve())):
            self.send_error(403)
            return

        if not target.exists() or not target.is_file():
            self.send_error(404)
            return

        content_type, _ = mimetypes.guess_type(str(target))
        content = target.read_bytes()
        self.send_response(200)
        self.send_header("Content-Type", content_type or "application/octet-stream")
        self.send_header("Content-Length", str(len(content)))
        self.end_headers()
        self.wfile.write(content)

    def register_customer(self):
        payload = self.read_json()
        username = str(payload.get("username", "")).strip()
        password = str(payload.get("password", ""))
        name = str(payload.get("name", "")).strip()

        if not username or not password or not name:
            self.json_response({"error": "username, password, dan name wajib diisi"}, 400)
            return

        try:
            with connect_db() as db:
                db.execute(
                    """
                    INSERT INTO users (username, password_hash, name, email, phone, address, role, created_at)
                    VALUES (?, ?, ?, ?, ?, ?, 'customer', ?)
                    """,
                    (
                        username,
                        hash_password(password),
                        name,
                        str(payload.get("email", "")).strip(),
                        str(payload.get("phone", "")).strip(),
                        str(payload.get("address", "")).strip(),
                        utc_now(),
                    ),
                )
                user = db.execute("SELECT * FROM users WHERE username = ?", (username,)).fetchone()
                token = make_session(db, user)
        except sqlite3.IntegrityError:
            self.json_response({"error": "Username sudah digunakan"}, 409)
            return

        self.json_response({"token": token, "user": public_user(user)}, 201)

    def login_user(self, expected_role):
        payload = self.read_json()
        username = str(payload.get("username", "")).strip()
        password = str(payload.get("password", ""))

        with connect_db() as db:
            user = db.execute("SELECT * FROM users WHERE username = ? AND role = ?", (username, expected_role)).fetchone()
            if not user or not verify_password(password, user["password_hash"]):
                self.json_response({"error": "Username atau password salah"}, 401)
                return

            token = make_session(db, user)

        self.json_response({"token": token, "user": public_user(user)})

    def list_customers(self):
        with connect_db() as db:
            rows = db.execute(
                """
                SELECT id, username, name, email, phone, address, role, created_at
                FROM users
                WHERE role = 'customer'
                ORDER BY created_at DESC
                """
            ).fetchall()

        self.json_response({"users": [row_to_dict(row) for row in rows]})

    def list_menu(self):
        with connect_db() as db:
            rows = db.execute("SELECT * FROM menu_items ORDER BY category, name").fetchall()
        self.json_response({"menu": [row_to_dict(row) for row in rows]})

    def create_menu_item(self):
        payload = self.read_json()
        now = utc_now()
        with connect_db() as db:
            cursor = db.execute(
                """
                INSERT INTO menu_items (name, category, price, description, image, available, created_at, updated_at)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?)
                """,
                (
                    str(payload.get("name", "")).strip(),
                    str(payload.get("category", "")).strip(),
                    int(payload.get("price", 0)),
                    str(payload.get("description", "")).strip(),
                    str(payload.get("image", "")).strip(),
                    1 if payload.get("available", True) else 0,
                    now,
                    now,
                ),
            )
            item = db.execute("SELECT * FROM menu_items WHERE id = ?", (cursor.lastrowid,)).fetchone()
        self.json_response({"item": row_to_dict(item)}, 201)

    def update_menu_item(self, item_id):
        payload = self.read_json()
        allowed = {"name", "category", "price", "description", "image", "available"}
        updates = {key: payload[key] for key in allowed if key in payload}

        if not updates:
            self.json_response({"error": "Tidak ada data yang diubah"}, 400)
            return

        updates["updated_at"] = utc_now()
        assignments = ", ".join([f"{key} = ?" for key in updates.keys()])
        values = [int(value) if key in ("price", "available") else value for key, value in updates.items()]
        values.append(item_id)

        with connect_db() as db:
            db.execute(f"UPDATE menu_items SET {assignments} WHERE id = ?", values)
            item = db.execute("SELECT * FROM menu_items WHERE id = ?", (item_id,)).fetchone()

        if not item:
            self.json_response({"error": "Menu tidak ditemukan"}, 404)
            return

        self.json_response({"item": row_to_dict(item)})

    def delete_menu_item(self, item_id):
        with connect_db() as db:
            cursor = db.execute("DELETE FROM menu_items WHERE id = ?", (item_id,))
            deleted = cursor.rowcount > 0
        self.json_response({"deleted": deleted})

    def list_tables(self):
        with connect_db() as db:
            rows = db.execute("SELECT * FROM restaurant_tables ORDER BY CAST(number AS INTEGER), number").fetchall()
        self.json_response({"tables": [row_to_dict(row) for row in rows]})

    def create_table(self):
        payload = self.read_json()
        now = utc_now()
        try:
            with connect_db() as db:
                cursor = db.execute(
                    """
                    INSERT INTO restaurant_tables (number, capacity, created_at, updated_at)
                    VALUES (?, ?, ?, ?)
                    """,
                    (str(payload.get("number", "")).strip(), int(payload.get("capacity", 0)), now, now),
                )
                table = db.execute("SELECT * FROM restaurant_tables WHERE id = ?", (cursor.lastrowid,)).fetchone()
        except sqlite3.IntegrityError:
            self.json_response({"error": "Nomor meja sudah ada"}, 409)
            return

        self.json_response({"table": row_to_dict(table)}, 201)

    def update_table(self, table_id):
        payload = self.read_json()
        updates = {}
        if "number" in payload:
            updates["number"] = str(payload["number"]).strip()
        if "capacity" in payload:
            updates["capacity"] = int(payload["capacity"])
        updates["updated_at"] = utc_now()

        assignments = ", ".join([f"{key} = ?" for key in updates.keys()])
        values = list(updates.values())
        values.append(table_id)

        with connect_db() as db:
            db.execute(f"UPDATE restaurant_tables SET {assignments} WHERE id = ?", values)
            table = db.execute("SELECT * FROM restaurant_tables WHERE id = ?", (table_id,)).fetchone()

        if not table:
            self.json_response({"error": "Meja tidak ditemukan"}, 404)
            return

        self.json_response({"table": row_to_dict(table)})

    def delete_table(self, table_id):
        with connect_db() as db:
            cursor = db.execute("DELETE FROM restaurant_tables WHERE id = ?", (table_id,))
            deleted = cursor.rowcount > 0
        self.json_response({"deleted": deleted})

    def list_orders(self, user):
        with connect_db() as db:
            if user["role"] == "admin":
                order_rows = db.execute("SELECT * FROM orders ORDER BY timestamp DESC").fetchall()
            else:
                order_rows = db.execute(
                    "SELECT * FROM orders WHERE customer_user_id = ? ORDER BY timestamp DESC",
                    (user["id"],),
                ).fetchall()

            orders = []
            for order in order_rows:
                order_data = row_to_dict(order)
                item_rows = db.execute("SELECT name, price, quantity, subtotal FROM order_items WHERE order_id = ?", (order["id"],)).fetchall()
                order_data["items"] = [row_to_dict(row) for row in item_rows]
                orders.append(order_data)

        self.json_response({"orders": orders})

    def create_order(self, user):
        payload = self.read_json()
        items = payload.get("items")

        if not isinstance(items, list) or not items:
            self.json_response({"error": "items wajib berupa array dan tidak boleh kosong"}, 400)
            return

        normalized_items = []
        total = 0

        for item in items:
            name = str(item.get("name", "")).strip()
            price = int(item.get("price", 0))
            quantity = int(item.get("quantity", 0))
            if not name or price < 0 or quantity <= 0:
                self.json_response({"error": "Item pesanan tidak valid"}, 400)
                return
            subtotal = price * quantity
            total += subtotal
            normalized_items.append({"name": name, "price": price, "quantity": quantity, "subtotal": subtotal})

        order_number = str(payload.get("orderNumber") or generate_order_number())
        timestamp = utc_now()
        table_number = str(payload.get("tableNumber", "")).strip()

        if not table_number:
            self.json_response({"error": "tableNumber wajib diisi"}, 400)
            return

        order = {
            "id": order_number,
            "order_number": order_number,
            "customer_user_id": user["id"],
            "customer_username": user["username"],
            "customer_name": str(payload.get("customerName") or user["name"]),
            "table_number": table_number,
            "total": total,
            "status": "pending",
            "payment_method": str(payload.get("paymentMethod", "cash")),
            "timestamp": timestamp,
        }

        with connect_db() as db:
            db.execute(
                """
                INSERT INTO orders (
                    id, order_number, customer_user_id, customer_username, customer_name,
                    table_number, total, status, payment_method, timestamp
                )
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                """,
                (
                    order["id"],
                    order["order_number"],
                    order["customer_user_id"],
                    order["customer_username"],
                    order["customer_name"],
                    order["table_number"],
                    order["total"],
                    order["status"],
                    order["payment_method"],
                    order["timestamp"],
                ),
            )
            db.executemany(
                """
                INSERT INTO order_items (order_id, name, price, quantity, subtotal)
                VALUES (?, ?, ?, ?, ?)
                """,
                [(order["id"], item["name"], item["price"], item["quantity"], item["subtotal"]) for item in normalized_items],
            )

        order["items"] = normalized_items
        self.json_response({"order": order}, 201)

    def update_order_status(self, order_id):
        payload = self.read_json()
        status = str(payload.get("status", "")).strip()
        allowed_statuses = {"pending", "processing", "completed", "cancelled"}

        if status not in allowed_statuses:
            self.json_response({"error": "Status tidak valid"}, 400)
            return

        fields = {"status": status}
        if status == "processing":
            fields["processed_at"] = utc_now()
        if status == "completed":
            fields["completed_at"] = utc_now()

        assignments = ", ".join([f"{key} = ?" for key in fields.keys()])
        values = list(fields.values())
        values.append(order_id)

        with connect_db() as db:
            db.execute(f"UPDATE orders SET {assignments} WHERE id = ?", values)
            order = db.execute("SELECT * FROM orders WHERE id = ?", (order_id,)).fetchone()

        if not order:
            self.json_response({"error": "Pesanan tidak ditemukan"}, 404)
            return

        self.json_response({"order": row_to_dict(order)})

    def best_seller_report(self, query):
        start = (query.get("start") or [""])[0]
        end = (query.get("end") or [""])[0]
        filters = ["orders.status != 'cancelled'"]
        values = []

        if start:
            filters.append("date(orders.timestamp) >= date(?)")
            values.append(start)
        if end:
            filters.append("date(orders.timestamp) <= date(?)")
            values.append(end)

        where_clause = " AND ".join(filters)
        with connect_db() as db:
            rows = db.execute(
                f"""
                SELECT
                    order_items.name,
                    SUM(order_items.quantity) AS quantity,
                    SUM(order_items.subtotal) AS revenue
                FROM order_items
                JOIN orders ON orders.id = order_items.order_id
                WHERE {where_clause}
                GROUP BY order_items.name
                ORDER BY quantity DESC, revenue DESC
                """,
                values,
            ).fetchall()

        self.json_response({"items": [row_to_dict(row) for row in rows]})


def run_server(host, port):
    init_db()
    server = ThreadingHTTPServer((host, port), RestaurantHandler)
    print(f"Local API running at http://{host}:{port}")
    print(f"Frontend: http://{host}:{port}/index.html")
    print(f"Admin:    http://{host}:{port}/admin.html")
    server.serve_forever()


def self_test():
    init_db()
    with connect_db() as db:
        admin = db.execute("SELECT * FROM users WHERE username = ? AND role = 'admin'", (ADMIN_USERNAME,)).fetchone()
        customers = db.execute("SELECT COUNT(*) AS total FROM users WHERE role = 'customer'").fetchone()["total"]
        menu = db.execute("SELECT COUNT(*) AS total FROM menu_items").fetchone()["total"]
        tables = db.execute("SELECT COUNT(*) AS total FROM restaurant_tables").fetchone()["total"]

    assert admin is not None
    assert verify_password(ADMIN_PASSWORD, admin["password_hash"])
    assert customers >= 2
    assert menu >= 9
    assert tables >= 8
    print("Self-test OK")


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Local restaurant backend")
    parser.add_argument("--host", default="127.0.0.1")
    parser.add_argument("--port", type=int, default=8000)
    parser.add_argument("--init-only", action="store_true")
    parser.add_argument("--self-test", action="store_true")
    args = parser.parse_args()

    if args.self_test:
        self_test()
    elif args.init_only:
        init_db()
        print(f"Database initialized at {DB_PATH}")
    else:
        run_server(args.host, args.port)
