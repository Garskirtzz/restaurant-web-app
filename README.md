# Restaurant Web App

Aplikasi restoran lokal dengan halaman customer, panel admin, backend Python/SQLite, dan smoke test Playwright.

## Status Project

Project ini sudah siap untuk pengembangan lokal yang rapi:

- Frontend dipisah menjadi HTML, CSS, dan modul JavaScript per domain.
- Backend lokal memakai Python standard library dan SQLite.
- Admin dan customer flow sudah terhubung ke API saat server aktif.
- Smoke test Playwright tersedia untuk cek halaman publik, login modal, login admin, dan pengaturan restoran.

Backend lokal sudah memakai PBKDF2-SHA256 untuk password dan session token dengan masa berlaku. Project ini tetap belum disarankan langsung untuk production publik tanpa HTTPS, rate limiting, konfigurasi environment production, audit keamanan, dan deployment backend yang stabil.

## Struktur Utama

```text
index.html                  Halaman menu customer
admin.html                  Halaman admin dan customer panel
assets/css/index.css        Styling halaman customer
assets/css/admin.css        Styling admin panel
assets/js/index.js          Logic halaman customer publik
assets/js/api-client.js     Client API frontend
assets/js/shared-utils.js   Utility bersama
assets/js/admin-state.js    State, storage, normalizer, formatter admin
assets/js/admin.js          Auth, navigasi, bootstrap admin/customer panel
assets/js/admin-settings.js Pengaturan restoran dan profil customer
assets/js/admin-tables.js   Manajemen meja
assets/js/admin-orders.js   Dashboard dan status pesanan
assets/js/admin-reports.js  Laporan dan Best Seller chart
assets/js/admin-menu.js     Manajemen menu
assets/js/admin-customer.js Riwayat dan pembuatan pesanan customer
server/app.py               Backend API lokal
tests/smoke.spec.js         Smoke test Playwright
```

## Prasyarat

- Python 3.11 atau lebih baru.
- Node.js LTS dan npm.
- PowerShell.

Cek dari root project:

```powershell
python --version
node -v
npm -v
```

Jika `node`, `npm`, atau `npx` tidak dikenali, install ulang Node.js LTS dengan opsi `Add to PATH`, lalu tutup dan buka ulang PowerShell.

## Setup Lokal

Dari root project:

```powershell
npm install
npx playwright install chromium
python server/app.py --self-test
```

`server/restaurant.db` akan dibuat otomatis saat backend dijalankan. File database lokal diabaikan oleh Git.

## Menjalankan Aplikasi

Jalankan server:

```powershell
python server/app.py
```

Buka halaman:

```text
http://127.0.0.1:8000/index.html
http://127.0.0.1:8000/admin.html
```

## Akun Development

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

Kredensial ini hanya untuk development lokal.

## Konfigurasi Auth Lokal

Credential admin dan masa berlaku session bisa diatur lewat environment variable PowerShell sebelum server dijalankan:

```powershell
$env:RESTAURANT_ADMIN_USERNAME="admin"
$env:RESTAURANT_ADMIN_PASSWORD="password-yang-lebih-kuat"
$env:RESTAURANT_SESSION_TTL_SECONDS="86400"
$env:RESTAURANT_PASSWORD_ITERATIONS="210000"
$env:RESTAURANT_ALLOWED_ORIGINS="http://127.0.0.1:8000"
$env:RESTAURANT_MAX_JSON_BODY_BYTES="131072"
python server/app.py
```

Jika `RESTAURANT_ADMIN_PASSWORD` diisi, seed admin lokal akan diperbarui saat database diinisialisasi. Saat deploy, batasi `RESTAURANT_ALLOWED_ORIGINS` ke origin frontend yang valid. Jangan commit credential production ke repository.

## Menjalankan Test

```powershell
npm test
```

Playwright akan menjalankan backend test di port `8010` dengan database terpisah:

```text
server/.playwright-test.db
```

Database test dan artefak test diabaikan oleh Git.

## Alur Utama

Customer:

- Sign in atau create account dari halaman `index.html`.
- Melihat menu, menambahkan item ke keranjang, checkout, dan melihat order history.
- Login, register, checkout, dan order history membutuhkan API lokal agar credential dan pesanan tidak diproses dari JavaScript browser.

Admin:

- Login dari `admin.html`.
- Melihat dashboard pesanan masuk, diproses, dan selesai.
- Mengubah status pesanan.
- Mengelola menu dan meja.
- Melihat laporan Best Seller.
- Menyimpan pengaturan restoran.

## Git

Command dasar:

```powershell
git status
git log --oneline -5
```

Jangan commit file lokal seperti:

```text
node_modules/
server/*.db
test-results/
playwright-report/
```

File tersebut sudah tercakup di `.gitignore`.
