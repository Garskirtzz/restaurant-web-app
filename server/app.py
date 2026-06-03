from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from urllib.parse import parse_qs, urlparse
import argparse
import hashlib
import hmac
import json
import mimetypes
import os
import re
import secrets
import sqlite3
from contextlib import contextmanager
from datetime import datetime, timedelta, timezone


SERVER_DIR = Path(__file__).resolve().parent
PROJECT_ROOT = SERVER_DIR.parent


def default_db_path():
    if os.environ.get("VERCEL") and "RESTAURANT_DB_PATH" not in os.environ:
        return Path(os.environ.get("TMPDIR", "/tmp")) / "restaurant.db"

    return SERVER_DIR / "restaurant.db"


DB_PATH = Path(os.environ.get("RESTAURANT_DB_PATH") or default_db_path())
DATABASE_URL = os.environ.get("DATABASE_URL") or os.environ.get("RESTAURANT_DATABASE_URL")
POSTGRES_HOST = os.environ.get("RESTAURANT_DB_HOST", "").strip()
try:
    POSTGRES_PORT = int(os.environ.get("RESTAURANT_DB_PORT", 6543))
except (TypeError, ValueError):
    POSTGRES_PORT = 6543
POSTGRES_PORT = POSTGRES_PORT if POSTGRES_PORT > 0 else 6543
POSTGRES_NAME = os.environ.get("RESTAURANT_DB_NAME", "postgres").strip() or "postgres"
POSTGRES_USER = os.environ.get("RESTAURANT_DB_USER", "").strip()
POSTGRES_PASSWORD = os.environ.get("RESTAURANT_DB_PASSWORD", "")
USE_POSTGRES_CONFIG = bool(POSTGRES_HOST and POSTGRES_USER and POSTGRES_PASSWORD)
USE_POSTGRES = bool(USE_POSTGRES_CONFIG or DATABASE_URL)
POSTGRES_SCHEMA = os.environ.get("RESTAURANT_DB_SCHEMA", "restaurant_app").strip() or "restaurant_app"
POSTGRES_SSLMODE = os.environ.get("RESTAURANT_DB_SSLMODE", "require").strip() or "require"

if not re.fullmatch(r"[A-Za-z_][A-Za-z0-9_]*", POSTGRES_SCHEMA):
    raise RuntimeError("RESTAURANT_DB_SCHEMA hanya boleh berisi huruf, angka, dan underscore")


def positive_int_env(name, default):
    try:
        value = int(os.environ.get(name, default))
    except (TypeError, ValueError):
        return default

    return value if value > 0 else default


def csv_env(name, default):
    raw_value = os.environ.get(name, default)
    return {item.strip() for item in raw_value.split(",") if item.strip()}


ADMIN_USERNAME = os.environ.get("RESTAURANT_ADMIN_USERNAME", "admin").strip() or "admin"
ADMIN_PASSWORD = os.environ.get("RESTAURANT_ADMIN_PASSWORD", "password123")
ADMIN_PASSWORD_FROM_ENV = "RESTAURANT_ADMIN_PASSWORD" in os.environ
PASSWORD_SCHEME = "pbkdf2_sha256"
PASSWORD_ITERATIONS = positive_int_env("RESTAURANT_PASSWORD_ITERATIONS", 210000)
LEGACY_PASSWORD_ITERATIONS = 120000
SESSION_TTL_SECONDS = positive_int_env("RESTAURANT_SESSION_TTL_SECONDS", 60 * 60 * 24)
MAX_JSON_BODY_BYTES = positive_int_env("RESTAURANT_MAX_JSON_BODY_BYTES", 128 * 1024)
ALLOWED_ORIGINS = csv_env("RESTAURANT_ALLOWED_ORIGINS", "*")
APP_VERSION = os.environ.get("RESTAURANT_APP_VERSION", "local")
SCHEMA_VERSION = 2


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

MENU_CATEGORIES = {"food", "drink", "dessert"}
ORDER_STATUSES = {"pending", "processing", "completed", "cancelled"}
PAYMENT_METHODS = {"cash", "qris", "bank-transfer"}
MAX_ORDER_ITEMS = 50
MAX_ORDER_QUANTITY = 99


def utc_now_dt():
    return datetime.now(timezone.utc)


def utc_now():
    return utc_now_dt().isoformat()


def parse_utc_timestamp(value):
    if not value:
        return None

    try:
        parsed = datetime.fromisoformat(str(value).replace("Z", "+00:00"))
    except ValueError:
        return None

    if parsed.tzinfo is None:
        parsed = parsed.replace(tzinfo=timezone.utc)

    return parsed.astimezone(timezone.utc)


def session_expiry():
    return (utc_now_dt() + timedelta(seconds=SESSION_TTL_SECONDS)).isoformat()


POSTGRES_SCHEMA_SQL = """
CREATE TABLE IF NOT EXISTS users (
    id BIGINT GENERATED BY DEFAULT AS IDENTITY PRIMARY KEY,
    username TEXT NOT NULL UNIQUE,
    password_hash TEXT NOT NULL,
    name TEXT NOT NULL,
    email TEXT DEFAULT '',
    phone TEXT DEFAULT '',
    address TEXT DEFAULT '',
    role TEXT NOT NULL CHECK (role IN ('admin', 'customer')),
    created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS sessions (
    token TEXT PRIMARY KEY,
    user_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    role TEXT NOT NULL,
    created_at TEXT NOT NULL,
    expires_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS menu_items (
    id BIGINT GENERATED BY DEFAULT AS IDENTITY PRIMARY KEY,
    name TEXT NOT NULL,
    category TEXT NOT NULL CHECK (category IN ('food', 'drink', 'dessert')),
    price INTEGER NOT NULL CHECK (price > 0),
    description TEXT DEFAULT '',
    image TEXT DEFAULT '',
    available INTEGER NOT NULL DEFAULT 1 CHECK (available IN (0, 1)),
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS restaurant_tables (
    id BIGINT GENERATED BY DEFAULT AS IDENTITY PRIMARY KEY,
    number TEXT NOT NULL UNIQUE,
    capacity INTEGER NOT NULL CHECK (capacity > 0),
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS restaurant_settings (
    id INTEGER PRIMARY KEY CHECK (id = 1),
    name TEXT DEFAULT '',
    address TEXT DEFAULT '',
    phone TEXT DEFAULT '',
    hours TEXT DEFAULT '',
    updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS orders (
    id TEXT PRIMARY KEY,
    order_number TEXT NOT NULL,
    customer_user_id BIGINT REFERENCES users(id) ON DELETE SET NULL,
    customer_username TEXT DEFAULT '',
    customer_name TEXT NOT NULL,
    table_number TEXT NOT NULL,
    total INTEGER NOT NULL CHECK (total >= 0),
    status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'processing', 'completed', 'cancelled')),
    payment_method TEXT DEFAULT 'cash' CHECK (payment_method IN ('cash', 'qris', 'bank-transfer')),
    timestamp TEXT NOT NULL,
    processed_at TEXT,
    completed_at TEXT
);

CREATE TABLE IF NOT EXISTS order_items (
    id BIGINT GENERATED BY DEFAULT AS IDENTITY PRIMARY KEY,
    order_id TEXT NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    price INTEGER NOT NULL CHECK (price > 0),
    quantity INTEGER NOT NULL CHECK (quantity > 0),
    subtotal INTEGER NOT NULL CHECK (subtotal >= 0)
);

CREATE TABLE IF NOT EXISTS schema_migrations (
    version INTEGER PRIMARY KEY,
    name TEXT NOT NULL,
    applied_at TEXT NOT NULL
);
"""


def is_postgres_db(db):
    return isinstance(db, PostgresConnection)


def import_psycopg2():
    try:
        import psycopg2
        from psycopg2.extras import RealDictCursor
    except ImportError as error:
        raise RuntimeError(
            "DATABASE_URL aktif, tetapi dependency psycopg2-binary belum terpasang. "
            "Jalankan pip install -r requirements.txt atau deploy dengan requirements.txt."
        ) from error

    return psycopg2, RealDictCursor


def adapt_postgres_sql(query, params=None):
    sql = query
    if isinstance(params, dict):
        sql = re.sub(r":([A-Za-z_][A-Za-z0-9_]*)", r"%(\1)s", sql)
    elif params is not None:
        sql = sql.replace("?", "%s")

    return sql, params


def needs_lastrowid(query):
    normalized = " ".join(query.lower().split())
    return normalized.startswith("insert into menu_items") or normalized.startswith("insert into restaurant_tables")


class PostgresCursor:
    def __init__(self, cursor, lastrowid=None):
        self.cursor = cursor
        self.lastrowid = lastrowid

    @property
    def rowcount(self):
        return self.cursor.rowcount

    def fetchone(self):
        return self.cursor.fetchone()

    def fetchall(self):
        return self.cursor.fetchall()


class PostgresConnection:
    backend = "postgres"

    def __init__(self, connection):
        self.connection = connection

    def ensure_schema(self):
        cursor = self.connection.cursor()
        cursor.execute(f'CREATE SCHEMA IF NOT EXISTS "{POSTGRES_SCHEMA}"')
        cursor.execute(f'SET search_path TO "{POSTGRES_SCHEMA}", public')

    def execute(self, query, params=None):
        sql, postgres_params = adapt_postgres_sql(query, params)
        cursor = self.connection.cursor()
        cursor.execute(sql, postgres_params)
        lastrowid = None

        if needs_lastrowid(sql):
            id_cursor = self.connection.cursor()
            id_cursor.execute("SELECT LASTVAL() AS id")
            row = id_cursor.fetchone()
            lastrowid = row["id"] if row else None

        return PostgresCursor(cursor, lastrowid)

    def executemany(self, query, param_rows):
        rows = list(param_rows)
        cursor = self.connection.cursor()
        if not rows:
            return PostgresCursor(cursor)

        sql, _ = adapt_postgres_sql(query, rows[0])
        cursor.executemany(sql, rows)
        return PostgresCursor(cursor)

    def executescript(self, script):
        cursor = self.connection.cursor()
        for statement in script.split(";"):
            sql = statement.strip()
            if sql:
                cursor.execute(sql)
        return PostgresCursor(cursor)

    def table_columns(self, table_name):
        cursor = self.execute(
            """
            SELECT column_name AS name
            FROM information_schema.columns
            WHERE table_schema = %s AND table_name = %s
            """,
            (POSTGRES_SCHEMA, table_name),
        )
        return {row["name"] for row in cursor.fetchall()}

    def index_names(self):
        cursor = self.execute(
            """
            SELECT indexname AS name
            FROM pg_indexes
            WHERE schemaname = %s
            """,
            (POSTGRES_SCHEMA,),
        )
        return {row["name"] for row in cursor.fetchall()}

    def commit(self):
        self.connection.commit()

    def rollback(self):
        self.connection.rollback()

    def close(self):
        self.connection.close()


@contextmanager
def connect_db():
    if USE_POSTGRES:
        psycopg2, RealDictCursor = import_psycopg2()
        connection_options = {
            "cursor_factory": RealDictCursor,
            "sslmode": POSTGRES_SSLMODE,
            "connect_timeout": 10,
        }
        if USE_POSTGRES_CONFIG:
            connection_options.update(
                {
                    "host": POSTGRES_HOST,
                    "port": POSTGRES_PORT,
                    "dbname": POSTGRES_NAME,
                    "user": POSTGRES_USER,
                    "password": POSTGRES_PASSWORD,
                }
            )
            connection = psycopg2.connect(**connection_options)
        else:
            connection = psycopg2.connect(DATABASE_URL, **connection_options)
        db = PostgresConnection(connection)
        db.ensure_schema()
    else:
        connection = sqlite3.connect(DB_PATH)
        connection.row_factory = sqlite3.Row
        connection.execute("PRAGMA foreign_keys = ON")
        db = connection

    try:
        yield db
        db.commit()
    except Exception:
        db.rollback()
        raise
    finally:
        db.close()


def hash_password(password, salt=None, iterations=None):
    salt = salt or secrets.token_hex(16)
    iterations = iterations or PASSWORD_ITERATIONS
    digest = hashlib.pbkdf2_hmac("sha256", password.encode("utf-8"), salt.encode("utf-8"), iterations)
    return f"{PASSWORD_SCHEME}${iterations}${salt}${digest.hex()}"


def verify_password(password, stored_hash):
    if not stored_hash:
        return False

    parts = str(stored_hash).split("$")
    if len(parts) == 4:
        algorithm, iteration_text, salt, expected = parts
        try:
            iterations = int(iteration_text)
        except ValueError:
            return False
    elif len(parts) == 3:
        algorithm, salt, expected = parts
        iterations = LEGACY_PASSWORD_ITERATIONS
    else:
        return hmac.compare_digest(password, str(stored_hash))

    if algorithm != PASSWORD_SCHEME or iterations <= 0:
        return False

    candidate = hashlib.pbkdf2_hmac(
        "sha256",
        password.encode("utf-8"),
        salt.encode("utf-8"),
        iterations,
    ).hex()
    return hmac.compare_digest(candidate, expected)


def password_needs_rehash(stored_hash):
    parts = str(stored_hash or "").split("$")
    if len(parts) != 4:
        return True

    algorithm, iteration_text, _salt, _expected = parts
    try:
        iterations = int(iteration_text)
    except ValueError:
        return True

    return algorithm != PASSWORD_SCHEME or iterations != PASSWORD_ITERATIONS


def parse_int(value):
    try:
        return int(value)
    except (TypeError, ValueError):
        return None


def parse_bool(value):
    if isinstance(value, bool):
        return value

    if isinstance(value, (int, float)):
        return value != 0

    if isinstance(value, str):
        normalized = value.strip().lower()
        if normalized in {"1", "true", "yes", "on"}:
            return True
        if normalized in {"0", "false", "no", "off"}:
            return False

    return bool(value)


def row_to_dict(row):
    return dict(row) if row else None


def public_user(row):
    user = row_to_dict(row)
    if not user:
        return None

    user.pop("password_hash", None)
    user.pop("session_expires_at", None)
    return user


def table_columns(db, table_name):
    if is_postgres_db(db):
        return db.table_columns(table_name)

    return {row["name"] for row in db.execute(f"PRAGMA table_info({table_name})").fetchall()}


def ensure_column(db, table_name, column_name, definition):
    if column_name not in table_columns(db, table_name):
        db.execute(f"ALTER TABLE {table_name} ADD COLUMN {column_name} {definition}")


def record_migration(db, version, name):
    if is_postgres_db(db):
        db.execute(
            """
            INSERT INTO schema_migrations (version, name, applied_at)
            VALUES (?, ?, ?)
            ON CONFLICT (version) DO NOTHING
            """,
            (version, name, utc_now()),
        )
    else:
        db.execute(
            """
            INSERT OR IGNORE INTO schema_migrations (version, name, applied_at)
            VALUES (?, ?, ?)
            """,
            (version, name, utc_now()),
        )


def create_integrity_indexes(db):
    db.executescript(
        """
        CREATE INDEX IF NOT EXISTS idx_sessions_user_id ON sessions(user_id);
        CREATE INDEX IF NOT EXISTS idx_sessions_expires_at ON sessions(expires_at);
        CREATE INDEX IF NOT EXISTS idx_users_role_created_at ON users(role, created_at);
        CREATE INDEX IF NOT EXISTS idx_menu_items_category_available ON menu_items(category, available);
        CREATE INDEX IF NOT EXISTS idx_orders_customer_user_id_timestamp ON orders(customer_user_id, timestamp);
        CREATE INDEX IF NOT EXISTS idx_orders_status_timestamp ON orders(status, timestamp);
        CREATE INDEX IF NOT EXISTS idx_order_items_order_id ON order_items(order_id);
        """
    )


def index_names(db):
    if is_postgres_db(db):
        return db.index_names()

    return {row["name"] for row in db.execute("SELECT name FROM sqlite_master WHERE type = 'index'").fetchall()}


def is_integrity_error(error):
    if isinstance(error, sqlite3.IntegrityError):
        return True

    error_name = error.__class__.__name__
    return error_name in {"IntegrityError", "UniqueViolation"}


def migrate_schema(db):
    ensure_column(db, "sessions", "expires_at", "TEXT")
    db.execute(
        "UPDATE sessions SET expires_at = ? WHERE expires_at IS NULL OR expires_at = ''",
        (session_expiry(),),
    )
    create_integrity_indexes(db)
    record_migration(db, 1, "bootstrap_schema")
    record_migration(db, 2, "session_expiry_and_integrity_indexes")


def purge_expired_sessions(db):
    db.execute(
        "DELETE FROM sessions WHERE expires_at IS NOT NULL AND expires_at <= ?",
        (utc_now(),),
    )


def session_user(db, token):
    row = db.execute(
        """
        SELECT users.*, sessions.expires_at AS session_expires_at
        FROM sessions
        JOIN users ON users.id = sessions.user_id
        WHERE sessions.token = ?
        """,
        (token,),
    ).fetchone()

    if not row:
        return None

    expires_at = parse_utc_timestamp(row["session_expires_at"])
    if not expires_at or expires_at <= utc_now_dt():
        db.execute("DELETE FROM sessions WHERE token = ?", (token,))
        return None

    user = row_to_dict(row)
    user.pop("session_expires_at", None)
    return user


def init_db():
    if not USE_POSTGRES:
        DB_PATH.parent.mkdir(parents=True, exist_ok=True)

    with connect_db() as db:
        if USE_POSTGRES:
            db.executescript(POSTGRES_SCHEMA_SQL)
        else:
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
                    expires_at TEXT NOT NULL,
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

                CREATE TABLE IF NOT EXISTS restaurant_settings (
                    id INTEGER PRIMARY KEY CHECK(id = 1),
                    name TEXT DEFAULT '',
                    address TEXT DEFAULT '',
                    phone TEXT DEFAULT '',
                    hours TEXT DEFAULT '',
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

                CREATE TABLE IF NOT EXISTS schema_migrations (
                    version INTEGER PRIMARY KEY,
                    name TEXT NOT NULL,
                    applied_at TEXT NOT NULL
                );
                """
            )

        migrate_schema(db)

        seed_user(db, ADMIN_USERNAME, ADMIN_PASSWORD, "Admin", "admin", force_password=ADMIN_PASSWORD_FROM_ENV)

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

        settings = db.execute("SELECT id FROM restaurant_settings WHERE id = 1").fetchone()
        if not settings:
            db.execute(
                """
                INSERT INTO restaurant_settings (id, name, address, phone, hours, updated_at)
                VALUES (1, 'Menu Digital Restoran', '', '', '', ?)
                """,
                (utc_now(),),
            )


def seed_user(db, username, password, name, role, email="", phone="", address="", force_password=False):
    exists = db.execute("SELECT * FROM users WHERE username = ?", (username,)).fetchone()
    if exists:
        should_rehash = verify_password(password, exists["password_hash"]) and password_needs_rehash(exists["password_hash"])
        if force_password or should_rehash:
            db.execute(
                "UPDATE users SET password_hash = ? WHERE id = ?",
                (hash_password(password), exists["id"]),
            )
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
    purge_expired_sessions(db)
    token = secrets.token_urlsafe(32)
    expires_at = session_expiry()
    db.execute(
        "INSERT INTO sessions (token, user_id, role, created_at, expires_at) VALUES (?, ?, ?, ?, ?)",
        (token, user["id"], user["role"], utc_now(), expires_at),
    )
    return token, expires_at


class RestaurantHandler(BaseHTTPRequestHandler):
    server_version = "RestaurantLocalAPI/1.0"

    def do_OPTIONS(self):
        self.send_response(204)
        self.add_cors_headers()
        self.add_security_headers()
        self.end_headers()

    def do_GET(self):
        try:
            if self.path.startswith("/api/"):
                self.handle_api("GET")
            else:
                self.serve_static()
        except ValueError as error:
            self.error_response(str(error), 400)
        except Exception as error:
            self.log_error_detail(error)
            self.error_response("Internal server error", 500)

    def do_POST(self):
        try:
            self.handle_api("POST")
        except ValueError as error:
            self.error_response(str(error), 400)
        except Exception as error:
            self.log_error_detail(error)
            self.error_response("Internal server error", 500)

    def do_PUT(self):
        try:
            self.handle_api("PUT")
        except ValueError as error:
            self.error_response(str(error), 400)
        except Exception as error:
            self.log_error_detail(error)
            self.error_response("Internal server error", 500)

    def do_DELETE(self):
        try:
            self.handle_api("DELETE")
        except ValueError as error:
            self.error_response(str(error), 400)
        except Exception as error:
            self.log_error_detail(error)
            self.error_response("Internal server error", 500)

    def log_message(self, format_string, *args):
        print("[%s] %s" % (datetime.now().strftime("%H:%M:%S"), format_string % args))

    def get_request_id(self):
        if not hasattr(self, "_request_id"):
            self._request_id = secrets.token_hex(8)

        return self._request_id

    def log_error_detail(self, error):
        print(
            "[%s] ERROR request_id=%s path=%s error=%s"
            % (datetime.now().strftime("%H:%M:%S"), self.get_request_id(), self.path, error)
        )

    def add_cors_headers(self):
        origin = self.headers.get("Origin", "")
        if "*" in ALLOWED_ORIGINS:
            self.send_header("Access-Control-Allow-Origin", "*")
        elif origin in ALLOWED_ORIGINS:
            self.send_header("Access-Control-Allow-Origin", origin)
            self.send_header("Vary", "Origin")

        self.send_header("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS")
        self.send_header("Access-Control-Allow-Headers", "Content-Type, Authorization")

    def add_security_headers(self):
        self.send_header("X-Content-Type-Options", "nosniff")
        self.send_header("X-Frame-Options", "DENY")
        self.send_header("Referrer-Policy", "strict-origin-when-cross-origin")

    def json_response(self, payload, status=200):
        body = json.dumps(payload, ensure_ascii=False).encode("utf-8")
        self.send_response(status)
        self.add_cors_headers()
        self.add_security_headers()
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Cache-Control", "no-store")
        self.send_header("X-Request-ID", self.get_request_id())
        self.send_header("Content-Length", str(len(body)))
        self.end_headers()
        self.wfile.write(body)

    def error_response(self, message, status):
        self.json_response({"error": message, "requestId": self.get_request_id()}, status)

    def read_json(self):
        content_length = int(self.headers.get("Content-Length", "0") or 0)
        if content_length == 0:
            return {}

        if content_length > MAX_JSON_BODY_BYTES:
            raise ValueError(f"Request body maksimal {MAX_JSON_BODY_BYTES} bytes")

        raw_body = self.rfile.read(content_length).decode("utf-8")
        try:
            payload = json.loads(raw_body)
        except json.JSONDecodeError:
            raise ValueError("Request body harus JSON valid")

        if not isinstance(payload, dict):
            raise ValueError("Request body harus berupa JSON object")

        return payload

    def get_bearer_token(self):
        auth_header = self.headers.get("Authorization", "")
        prefix = "Bearer "
        if not auth_header.startswith(prefix):
            return ""

        return auth_header[len(prefix) :].strip()

    def get_auth_user(self):
        token = self.get_bearer_token()
        if not token:
            return None

        with connect_db() as db:
            return session_user(db, token)

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
            self.health_check()
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

        if method == "POST" and path == "/api/auth/logout":
            self.logout_user()
            return

        if method == "GET" and path == "/api/users/me":
            user = self.require_user()
            if user:
                self.json_response({"user": public_user(user)})
            return

        if method == "PUT" and path == "/api/users/me":
            user = self.require_user()
            if user:
                self.update_current_user(user)
            return

        if method == "GET" and path == "/api/users/customers":
            if not self.require_user("admin"):
                return
            self.list_customers()
            return

        if path == "/api/settings":
            if method == "GET":
                self.get_settings()
            elif method == "PUT":
                if self.require_user("admin"):
                    self.update_settings()
            else:
                self.json_response({"error": "Method not allowed"}, 405)
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

    def health_check(self):
        with connect_db() as db:
            migration = db.execute("SELECT MAX(version) AS version FROM schema_migrations").fetchone()
            user_count = db.execute("SELECT COUNT(*) AS total FROM users").fetchone()["total"]

        if USE_POSTGRES:
            database = f"postgres:{POSTGRES_SCHEMA}"
            storage_mode = "persistent"
        else:
            database = str(DB_PATH)
            storage_mode = "ephemeral" if os.environ.get("VERCEL") and "RESTAURANT_DB_PATH" not in os.environ else "persistent"

        self.json_response(
            {
                "ok": True,
                "appVersion": APP_VERSION,
                "schemaVersion": migration["version"] or 0,
                "database": database,
                "storageMode": storage_mode,
                "users": user_count,
            }
        )

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
        self.add_security_headers()
        self.send_header("Content-Type", content_type or "application/octet-stream")
        if target.suffix.lower() == ".html":
            self.send_header("Cache-Control", "no-store")
        else:
            self.send_header("Cache-Control", "public, max-age=3600")
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
                token, expires_at = make_session(db, user)
        except Exception as error:
            if not is_integrity_error(error):
                raise
            self.json_response({"error": "Username sudah digunakan"}, 409)
            return

        self.json_response({"token": token, "expiresAt": expires_at, "user": public_user(user)}, 201)

    def login_user(self, expected_role):
        payload = self.read_json()
        username = str(payload.get("username", "")).strip()
        password = str(payload.get("password", ""))

        with connect_db() as db:
            user = db.execute("SELECT * FROM users WHERE username = ? AND role = ?", (username, expected_role)).fetchone()
            if not user or not verify_password(password, user["password_hash"]):
                self.json_response({"error": "Username atau password salah"}, 401)
                return

            token, expires_at = make_session(db, user)

        self.json_response({"token": token, "expiresAt": expires_at, "user": public_user(user)})

    def logout_user(self):
        token = self.get_bearer_token()
        if token:
            with connect_db() as db:
                db.execute("DELETE FROM sessions WHERE token = ?", (token,))

        self.json_response({"ok": True})

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

    def update_current_user(self, user):
        payload = self.read_json()
        updates = {}

        for field in ("name", "email", "phone", "address"):
            if field in payload:
                updates[field] = str(payload.get(field, "")).strip()

        if not updates:
            self.json_response({"error": "Tidak ada data yang diubah"}, 400)
            return

        if "name" in updates and not updates["name"]:
            self.json_response({"error": "Nama tidak boleh kosong"}, 400)
            return

        assignments = ", ".join([f"{key} = ?" for key in updates.keys()])
        values = list(updates.values())
        values.append(user["id"])

        with connect_db() as db:
            db.execute(f"UPDATE users SET {assignments} WHERE id = ?", values)
            updated_user = db.execute("SELECT * FROM users WHERE id = ?", (user["id"],)).fetchone()

        self.json_response({"user": public_user(updated_user)})

    def get_settings(self):
        with connect_db() as db:
            settings = db.execute("SELECT name, address, phone, hours, updated_at FROM restaurant_settings WHERE id = 1").fetchone()

        self.json_response({"settings": row_to_dict(settings) or {}})

    def update_settings(self):
        payload = self.read_json()
        fields = {
            "name": str(payload.get("name", "")).strip(),
            "address": str(payload.get("address", "")).strip(),
            "phone": str(payload.get("phone", "")).strip(),
            "hours": str(payload.get("hours", "")).strip(),
            "updated_at": utc_now(),
        }

        with connect_db() as db:
            db.execute(
                """
                INSERT INTO restaurant_settings (id, name, address, phone, hours, updated_at)
                VALUES (1, :name, :address, :phone, :hours, :updated_at)
                ON CONFLICT(id) DO UPDATE SET
                    name = excluded.name,
                    address = excluded.address,
                    phone = excluded.phone,
                    hours = excluded.hours,
                    updated_at = excluded.updated_at
                """,
                fields,
            )
            settings = db.execute("SELECT name, address, phone, hours, updated_at FROM restaurant_settings WHERE id = 1").fetchone()

        self.json_response({"settings": row_to_dict(settings)})

    def list_menu(self):
        with connect_db() as db:
            rows = db.execute("SELECT * FROM menu_items ORDER BY category, name").fetchall()
        self.json_response({"menu": [row_to_dict(row) for row in rows]})

    def create_menu_item(self):
        payload = self.read_json()
        name = str(payload.get("name", "")).strip()
        category = str(payload.get("category", "")).strip()
        price = parse_int(payload.get("price"))
        description = str(payload.get("description", "")).strip()
        image = str(payload.get("image", "")).strip()
        available = 1 if parse_bool(payload.get("available", True)) else 0

        if not name:
            self.json_response({"error": "Nama menu wajib diisi"}, 400)
            return

        if category not in MENU_CATEGORIES:
            self.json_response({"error": "Kategori menu tidak valid"}, 400)
            return

        if price is None or price <= 0:
            self.json_response({"error": "Harga menu harus berupa angka lebih dari 0"}, 400)
            return

        now = utc_now()
        with connect_db() as db:
            cursor = db.execute(
                """
                INSERT INTO menu_items (name, category, price, description, image, available, created_at, updated_at)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?)
                """,
                (
                    name,
                    category,
                    price,
                    description,
                    image,
                    available,
                    now,
                    now,
                ),
            )
            item = db.execute("SELECT * FROM menu_items WHERE id = ?", (cursor.lastrowid,)).fetchone()
        self.json_response({"item": row_to_dict(item)}, 201)

    def update_menu_item(self, item_id):
        payload = self.read_json()
        updates = {}

        if "name" in payload:
            name = str(payload["name"]).strip()
            if not name:
                self.json_response({"error": "Nama menu wajib diisi"}, 400)
                return
            updates["name"] = name

        if "category" in payload:
            category = str(payload["category"]).strip()
            if category not in MENU_CATEGORIES:
                self.json_response({"error": "Kategori menu tidak valid"}, 400)
                return
            updates["category"] = category

        if "price" in payload:
            price = parse_int(payload["price"])
            if price is None or price <= 0:
                self.json_response({"error": "Harga menu harus berupa angka lebih dari 0"}, 400)
                return
            updates["price"] = price

        if "description" in payload:
            updates["description"] = str(payload["description"]).strip()

        if "image" in payload:
            updates["image"] = str(payload["image"]).strip()

        if "available" in payload:
            updates["available"] = 1 if parse_bool(payload["available"]) else 0

        if not updates:
            self.json_response({"error": "Tidak ada data yang diubah"}, 400)
            return

        updates["updated_at"] = utc_now()
        assignments = ", ".join([f"{key} = ?" for key in updates.keys()])
        values = list(updates.values())
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
        table_number = str(payload.get("number", "")).strip()
        capacity = parse_int(payload.get("capacity"))

        if not table_number:
            self.json_response({"error": "Nomor meja wajib diisi"}, 400)
            return

        if capacity is None or capacity <= 0:
            self.json_response({"error": "Kapasitas meja harus berupa angka lebih dari 0"}, 400)
            return

        now = utc_now()
        try:
            with connect_db() as db:
                cursor = db.execute(
                    """
                    INSERT INTO restaurant_tables (number, capacity, created_at, updated_at)
                    VALUES (?, ?, ?, ?)
                    """,
                    (table_number, capacity, now, now),
                )
                table = db.execute("SELECT * FROM restaurant_tables WHERE id = ?", (cursor.lastrowid,)).fetchone()
        except Exception as error:
            if not is_integrity_error(error):
                raise
            self.json_response({"error": "Nomor meja sudah ada"}, 409)
            return

        self.json_response({"table": row_to_dict(table)}, 201)

    def update_table(self, table_id):
        payload = self.read_json()
        updates = {}
        if "number" in payload:
            table_number = str(payload["number"]).strip()
            if not table_number:
                self.json_response({"error": "Nomor meja wajib diisi"}, 400)
                return
            updates["number"] = table_number

        if "capacity" in payload:
            capacity = parse_int(payload["capacity"])
            if capacity is None or capacity <= 0:
                self.json_response({"error": "Kapasitas meja harus berupa angka lebih dari 0"}, 400)
                return
            updates["capacity"] = capacity

        if not updates:
            self.json_response({"error": "Tidak ada data yang diubah"}, 400)
            return

        updates["updated_at"] = utc_now()

        assignments = ", ".join([f"{key} = ?" for key in updates.keys()])
        values = list(updates.values())
        values.append(table_id)

        try:
            with connect_db() as db:
                db.execute(f"UPDATE restaurant_tables SET {assignments} WHERE id = ?", values)
                table = db.execute("SELECT * FROM restaurant_tables WHERE id = ?", (table_id,)).fetchone()
        except Exception as error:
            if not is_integrity_error(error):
                raise
            self.json_response({"error": "Nomor meja sudah ada"}, 409)
            return

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

        if len(items) > MAX_ORDER_ITEMS:
            self.json_response({"error": f"Jumlah item pesanan maksimal {MAX_ORDER_ITEMS}"}, 400)
            return

        normalized_items = []
        total = 0

        for item in items:
            if not isinstance(item, dict):
                self.json_response({"error": "Item pesanan tidak valid"}, 400)
                return

            name = str(item.get("name", "")).strip()
            price = parse_int(item.get("price"))
            quantity = parse_int(item.get("quantity"))
            if not name or price is None or quantity is None or price <= 0 or quantity <= 0 or quantity > MAX_ORDER_QUANTITY:
                self.json_response({"error": "Item pesanan tidak valid"}, 400)
                return

            subtotal = price * quantity
            total += subtotal
            normalized_items.append({"name": name, "price": price, "quantity": quantity, "subtotal": subtotal})

        order_number = str(payload.get("orderNumber") or generate_order_number())
        timestamp = utc_now()
        table_number = str(payload.get("tableNumber", "")).strip()
        payment_method = str(payload.get("paymentMethod", "cash")).strip()
        customer_name = str(payload.get("customerName") or user["name"]).strip()

        if not table_number:
            self.json_response({"error": "tableNumber wajib diisi"}, 400)
            return

        if payment_method not in PAYMENT_METHODS:
            self.json_response({"error": "Metode pembayaran tidak valid"}, 400)
            return

        if not customer_name:
            self.json_response({"error": "customerName wajib diisi"}, 400)
            return

        order = {
            "id": order_number,
            "order_number": order_number,
            "customer_user_id": user["id"],
            "customer_username": user["username"],
            "customer_name": customer_name,
            "table_number": table_number,
            "total": total,
            "status": "pending",
            "payment_method": payment_method,
            "timestamp": timestamp,
        }

        with connect_db() as db:
            table_exists = db.execute("SELECT id FROM restaurant_tables WHERE number = ?", (table_number,)).fetchone()
            if not table_exists:
                self.json_response({"error": "Nomor meja tidak ditemukan"}, 400)
                return

            while db.execute("SELECT id FROM orders WHERE id = ?", (order["id"],)).fetchone():
                order_number = generate_order_number()
                order["id"] = order_number
                order["order_number"] = order_number

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

        if status not in ORDER_STATUSES:
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
        settings = db.execute("SELECT * FROM restaurant_settings WHERE id = 1").fetchone()
        session_columns = table_columns(db, "sessions")
        schema_version = db.execute("SELECT MAX(version) AS version FROM schema_migrations").fetchone()["version"]
        indexes = index_names(db)
        token = ""
        expires_at = ""
        session = None
        loaded_user = None
        expired_user = None
        expired_session = None

        if admin:
            token, expires_at = make_session(db, admin)
            session = db.execute("SELECT expires_at FROM sessions WHERE token = ?", (token,)).fetchone()
            loaded_user = session_user(db, token)

            expired_token = "expired-" + secrets.token_urlsafe(8)
            db.execute(
                """
                INSERT INTO sessions (token, user_id, role, created_at, expires_at)
                VALUES (?, ?, ?, ?, ?)
                """,
                (
                    expired_token,
                    admin["id"],
                    admin["role"],
                    utc_now(),
                    (utc_now_dt() - timedelta(seconds=1)).isoformat(),
                ),
            )
            expired_user = session_user(db, expired_token)
            expired_session = db.execute("SELECT token FROM sessions WHERE token = ?", (expired_token,)).fetchone()

    assert admin is not None
    assert verify_password(ADMIN_PASSWORD, admin["password_hash"])
    assert not password_needs_rehash(admin["password_hash"])
    assert customers >= 2
    assert menu >= 9
    assert tables >= 8
    assert settings is not None
    assert "expires_at" in session_columns
    assert schema_version >= SCHEMA_VERSION
    assert "idx_orders_status_timestamp" in indexes
    assert "idx_order_items_order_id" in indexes
    assert MAX_JSON_BODY_BYTES > 0
    assert ALLOWED_ORIGINS
    assert token
    assert session is not None
    assert parse_utc_timestamp(expires_at) > utc_now_dt()
    assert parse_utc_timestamp(session["expires_at"]) > utc_now_dt()
    assert loaded_user and loaded_user["id"] == admin["id"]
    assert expired_user is None
    assert expired_session is None
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
