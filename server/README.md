# Backend Lokal Restoran

Backend lokal memakai Python standard library dan SQLite tanpa dependency eksternal.

## Menjalankan

Dari root project:

```powershell
python server/app.py --self-test
python server/app.py
```

Server akan berjalan di:

```text
http://127.0.0.1:8000
```

Halaman frontend:

```text
http://127.0.0.1:8000/index.html
http://127.0.0.1:8000/admin.html
```

Database lokal dibuat otomatis di:

```text
server/restaurant.db
```

## Akun seed

Admin:

```text
username: admin
password: password123
```

Customer:

```text
username: user1
password: user123

username: user2
password: user123
```

Credential ini hanya untuk development lokal. Password disimpan sebagai PBKDF2-SHA256, dan token login disimpan sebagai session dengan masa berlaku.

## Konfigurasi auth

Gunakan environment variable PowerShell jika ingin mengganti admin seed atau masa berlaku session:

```powershell
$env:RESTAURANT_ADMIN_USERNAME="admin"
$env:RESTAURANT_ADMIN_PASSWORD="password-yang-lebih-kuat"
$env:RESTAURANT_SESSION_TTL_SECONDS="86400"
$env:RESTAURANT_PASSWORD_ITERATIONS="210000"
python server/app.py
```

Jika `RESTAURANT_ADMIN_PASSWORD` diisi, password admin seed akan diperbarui saat server menginisialisasi database.

## Endpoint awal

```text
GET  /api/health
POST /api/auth/customer/register
POST /api/auth/customer/login
POST /api/auth/admin/login
GET  /api/users/me
PUT  /api/users/me
GET  /api/users/customers
GET  /api/settings
PUT  /api/settings
GET  /api/menu
POST /api/menu
PUT  /api/menu/{id}
DELETE /api/menu/{id}
GET  /api/tables
POST /api/tables
PUT  /api/tables/{id}
DELETE /api/tables/{id}
GET  /api/orders
POST /api/orders
PUT  /api/orders/{orderId}/status
GET  /api/reports/best-seller?start=YYYY-MM-DD&end=YYYY-MM-DD
```

Endpoint yang mengubah data admin membutuhkan token admin dari login. Endpoint order customer membutuhkan token customer. Token kadaluarsa sesuai `RESTAURANT_SESSION_TTL_SECONDS`.

Header token:

```text
Authorization: Bearer <token>
```

## Database test

Path database bisa diarahkan lewat environment variable:

```powershell
$env:RESTAURANT_DB_PATH="server/.playwright-test.db"
python server/app.py --host 127.0.0.1 --port 8010
```

Konfigurasi Playwright memakai database test ini agar perubahan dari automated test tidak menyentuh `server/restaurant.db`.

## Integrasi Frontend

Saat halaman dibuka lewat server lokal, frontend akan memakai API untuk bagian berikut:

- `index.html`: login/register customer, daftar meja checkout, checkout order, order history customer.
- `admin.html`: login admin/customer, membaca order dashboard, update status order `pending -> processing -> completed`, CRUD menu, CRUD meja, profile customer, pengaturan restoran, dan laporan Best Seller.

Login, register customer, checkout, dan order history membutuhkan API aktif. `localStorage` hanya dipakai untuk cache UI non-sensitif seperti keranjang sementara dan fallback data tampilan saat development.

## Dokumentasi Project

Panduan setup lengkap, struktur modul frontend, command test, dan kredensial development tersedia di README root project.
