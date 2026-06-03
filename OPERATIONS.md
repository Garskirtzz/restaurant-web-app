# Operations Guide

Last updated: 2026-06-04, Asia/Jakarta

Dokumen ini berisi prosedur operasional harian untuk merawat, memulihkan, dan menyerahkan restaurant web app setelah live di produksi. Ini melengkapi `README.md`, `DEPLOYMENT.md`, dan `RELEASE_CHECKLIST.md`.

Aturan dasar (sama dengan `AI_HANDOFF_PROGRESS.md`):

- Jangan menulis password, token, atau connection string asli di file ini atau di Git.
- Jangan menonaktifkan RLS Supabase untuk "memperbaiki" error akses.
- Frontend hanya bicara ke API Python (`/api/...`), bukan langsung ke Supabase.
- Setelah mengubah env var Vercel, selalu redeploy dan verifikasi `/api/health`.

Referensi cepat lingkungan produksi:

```text
Production URL  : https://project-hqcx7.vercel.app
Supabase schema : restaurant_app
Database        : Supabase Postgres (Transaction Pooler untuk runtime)
Admin seed env  : RESTAURANT_ADMIN_USERNAME, RESTAURANT_ADMIN_PASSWORD
```

---

## 1. Cara Kerja Admin & Password (Wajib Dibaca Dulu)

Memahami ini mencegah kesalahan operasional yang umum.

- Akun admin di-*seed* saat database pertama kali dibuat, memakai env `RESTAURANT_ADMIN_USERNAME` (default `admin`) dan `RESTAURANT_ADMIN_PASSWORD`.
- Password disimpan sebagai hash PBKDF2-SHA256 dengan format `pbkdf2_sha256$<iterations>$<salt>$<digest>`. Password mentah tidak pernah disimpan.
- Saat startup, `init_db()` memanggil `seed_user(...)`. Jika `RESTAURANT_ADMIN_PASSWORD` di-set di environment, seeding admin memakai `force_password=True`, artinya hash admin ditimpa ulang dari env.

PENTING — perilaku produksi yang berbeda:

- Pada **Postgres produksi yang sudah ter-seed**, `init_db()` berhenti lebih awal (lihat `postgres_bootstrap_ready` di `server/app.py`). Akibatnya `seed_user` **tidak** dijalankan lagi.
- Konsekuensinya: mengubah `RESTAURANT_ADMIN_PASSWORD` di Vercel lalu redeploy **TIDAK** mengganti password admin yang sudah ada di Supabase.
- Reset env hanya efektif untuk **database baru/kosong** atau **SQLite lokal** (yang selalu menjalankan seeding ulang).

Maka untuk produksi yang sudah jalan, ganti password admin lewat SQL update (Bagian 2B), bukan lewat env saja.

---

## 2. Reset / Ganti Password Admin

### 2A. Database baru atau SQLite lokal

1. Set `RESTAURANT_ADMIN_PASSWORD` ke password kuat baru.
   - Lokal: di `.env` atau environment shell.
   - Vercel: Project Settings > Environment Variables.
2. Lokal: restart `python server/app.py`. Vercel: redeploy.
3. Verifikasi login admin.

Ini bekerja karena seeding menimpa hash admin saat inisialisasi DB.

### 2B. Produksi Supabase yang sudah ter-seed (cara yang benar)

Karena seeding tidak berjalan ulang, hash baru harus dibuat dan di-`UPDATE` langsung.

Langkah 1 — buat hash dari mesin lokal memakai fungsi hashing aplikasi (dari root project):

```powershell
python -c "import sys; sys.path.insert(0, 'server'); import app; print(app.hash_password('PASSWORD_BARU_YANG_KUAT'))"
```

Catatan:
- Pastikan `RESTAURANT_PASSWORD_ITERATIONS` lokal sama dengan produksi (default `210000`) supaya hash konsisten. Sebenarnya verifikasi tetap jalan walau iterations berbeda, tetapi menyamakan lebih rapi.
- Output berbentuk `pbkdf2_sha256$210000$<salt>$<digest>`. Salin seluruh string itu.

Langkah 2 — jalankan di Supabase SQL Editor (Dashboard > SQL Editor):

```sql
UPDATE restaurant_app.users
SET password_hash = 'pbkdf2_sha256$210000$...tempel-hash-penuh...'
WHERE username = 'admin' AND role = 'admin';
```

Langkah 3 — verifikasi:
- Login admin di `https://project-hqcx7.vercel.app/admin.html`.
- Sesi lama tetap valid sampai kedaluwarsa. Untuk memaksa logout semua sesi admin, lihat Bagian 8.

Langkah 4 — selaraskan env (opsional tapi disarankan):
- Update `RESTAURANT_ADMIN_PASSWORD` di Vercel agar cocok dengan password baru, supaya kalau database di-bootstrap ulang dari nol nilainya sama.

---

## 3. Membuat Akun Admin Baru

Tidak ada endpoint publik untuk membuat admin (register hanya membuat `customer`). Buat admin lewat salah satu cara berikut.

### 3A. Sebagai admin pertama di DB baru

Set `RESTAURANT_ADMIN_USERNAME` dan `RESTAURANT_ADMIN_PASSWORD`, lalu inisialisasi DB baru. Admin akan ter-seed otomatis.

### 3B. Admin tambahan di DB yang sudah ada (SQL)

Langkah 1 — buat hash password (lihat Bagian 2B Langkah 1).

Langkah 2 — insert di Supabase SQL Editor:

```sql
INSERT INTO restaurant_app.users (username, password_hash, name, email, phone, address, role, created_at)
VALUES (
  'admin2',
  'pbkdf2_sha256$210000$...tempel-hash-penuh...',
  'Nama Admin',
  '', '', '',
  'admin',
  now()::text
);
```

Langkah 3 — verifikasi login admin dengan kredensial baru.

Untuk SQLite lokal, jalankan `INSERT` yang sama lewat tool SQLite apa pun terhadap `server/restaurant.db` (gunakan `datetime('now')` sebagai pengganti `now()::text`).

---

## 4. Mengecek Pesanan di Admin Panel

1. Buka `https://project-hqcx7.vercel.app/admin.html`.
2. Login sebagai admin.
3. Monitoring pesanan ada di **Dashboard**, dengan tab status:
   - **Pesanan Masuk** (`pending`)
   - **Diproses** (`processing`)
   - **Selesai** (`completed`)
4. Badge notifikasi menandai pesanan baru per status; mengklik tab menandainya sebagai sudah dibaca.
5. Ubah status pesanan: `pending -> processing -> completed`. Perubahan tersimpan via API dan memperbarui `processed_at`/`completed_at`.

Cek cepat lewat API (butuh token admin):

```powershell
# Login admin -> ambil token
$login = Invoke-RestMethod -Uri "https://project-hqcx7.vercel.app/api/auth/admin/login" `
  -Method Post -ContentType "application/json" `
  -Body (@{ username = "admin"; password = "PASSWORD_ADMIN" } | ConvertTo-Json)

# Daftar semua order
Invoke-RestMethod -Uri "https://project-hqcx7.vercel.app/api/orders" `
  -Headers @{ Authorization = "Bearer $($login.token)" } | ConvertTo-Json -Depth 6
```

Inspeksi langsung di database:

```sql
SELECT id, order_number, customer_name, table_number, total, status, timestamp
FROM restaurant_app.orders
ORDER BY timestamp DESC
LIMIT 50;
```

---

## 4B. Audit Log Aksi Admin

Setiap mutasi admin dicatat ke tabel `admin_audit_log`: update settings, CRUD menu, CRUD meja, dan perubahan status order. Tiap baris menyimpan `admin_user_id`, `admin_username`, `action`, `target_type`, `target_id`, `detail`, `ip`, dan `created_at`.

Lihat via API (butuh token admin, default 100 entri terbaru, maksimal `?limit=500`):

```powershell
Invoke-RestMethod -Uri "https://project-hqcx7.vercel.app/api/audit-log?limit=50" `
  -Headers @{ Authorization = "Bearer $($login.token)" } | ConvertTo-Json -Depth 6
```

Lihat langsung di database:

```sql
SELECT created_at, admin_username, action, target_type, target_id, detail, ip
FROM restaurant_app.admin_audit_log
ORDER BY created_at DESC
LIMIT 50;
```

Nilai `action` yang dicatat: `settings.update`, `menu.create`, `menu.update`, `menu.delete`, `table.create`, `table.update`, `table.delete`, `order.status`.

## 5. Backup Supabase / Postgres

### 5A. Backup otomatis Supabase

- Supabase menyediakan backup terjadwal sesuai paket (Dashboard > Database > Backups). Pada paket gratis, backup terbatas; jangan mengandalkannya sebagai satu-satunya cadangan untuk data penting.

### 5B. Backup manual dengan `pg_dump` (disarankan sebelum perubahan besar)

Gunakan **direct connection / session pooler** (port `5432`), bukan transaction pooler (`6543`), karena `pg_dump` butuh koneksi sesi penuh. Ambil string koneksi dari Supabase Dashboard > Connect.

```powershell
# Hanya schema aplikasi, tanpa owner/privilege agar mudah di-restore
pg_dump "postgresql://USER:PASSWORD@HOST:5432/postgres?sslmode=require" `
  --schema=restaurant_app --no-owner --no-privileges `
  -f "backup-restaurant_app-$(Get-Date -Format yyyyMMdd-HHmmss).sql"
```

Simpan file backup di luar repo (jangan commit). Untuk restore ke database lain:

```powershell
psql "postgresql://USER:PASSWORD@HOST:5432/postgres?sslmode=require" -f backup-restaurant_app-YYYYMMDD-HHMMSS.sql
```

### 5C. Backup SQLite lokal

```powershell
.\server\backup-database.ps1
```

Hasil backup masuk ke `server/backups/` (diabaikan Git).

---

## 6. Rollback Deployment Vercel

Jika deploy baru bermasalah, kembalikan ke versi sebelumnya yang sehat.

Lewat Dashboard:
1. Vercel > project > tab **Deployments**.
2. Pilih deployment produksi sebelumnya yang sehat.
3. Klik menu (`...`) > **Promote to Production** (Instant Rollback).
4. Verifikasi `/api/health` (Bagian 9).

Lewat CLI:

```powershell
vercel rollback
```

Catatan:
- Rollback hanya mengembalikan kode/build, bukan data database. Data Supabase tidak ikut ter-rollback.
- Jika masalah disebabkan env var, perbaiki env var lalu redeploy, bukan sekadar rollback.

---

## 7. Rotasi Password Database & Env Var Vercel

### 7A. Rotasi password database Supabase

1. Supabase Dashboard > Project Settings > Database > **Reset database password**.
2. Salin password baru (jangan tulis ke Git).
3. Update env Vercel:
   - `RESTAURANT_DB_PASSWORD` (jika memakai variabel terpisah), dan/atau
   - `DATABASE_URL` (jika memakai satu connection string).
4. Redeploy produksi.
5. Verifikasi `/api/health` mengembalikan `storageMode: persistent` dan `database: postgres:restaurant_app`.
6. Tes login admin dan satu order.

### 7B. Rotasi/ubah env var Vercel umum

1. Vercel > Project Settings > Environment Variables > edit nilai.
2. **Redeploy** (perubahan env tidak berlaku sampai redeploy).
3. Verifikasi `/api/health` dan login.

Env var penting (lihat juga `.env.example` dan `DEPLOYMENT.md`):

```text
RESTAURANT_ADMIN_USERNAME
RESTAURANT_ADMIN_PASSWORD
RESTAURANT_SESSION_TTL_SECONDS
RESTAURANT_PASSWORD_ITERATIONS
RESTAURANT_ALLOWED_ORIGINS
RESTAURANT_MAX_JSON_BODY_BYTES
RESTAURANT_LOGIN_MAX_FAILURES
RESTAURANT_LOGIN_FAILURE_WINDOW_SECONDS
RESTAURANT_RATE_LIMIT_MAX
RESTAURANT_RATE_LIMIT_WINDOW_SECONDS
RESTAURANT_LOG_LEVEL
RESTAURANT_APP_VERSION
RESTAURANT_DB_SCHEMA
RESTAURANT_DB_SSLMODE
RESTAURANT_DB_HOST
RESTAURANT_DB_PORT
RESTAURANT_DB_NAME
RESTAURANT_DB_USER
RESTAURANT_DB_PASSWORD
DATABASE_URL
```

Catatan keamanan:
- Setelah mengganti `RESTAURANT_ALLOWED_ORIGINS`, pastikan domain frontend yang dipakai ikut terdaftar, atau request lintas-origin akan ditolak.
- Variabel `RESTAURANT_DB_*` terpisah lebih disukai daripada `DATABASE_URL` karena password tidak perlu URL-encode.

---

## 8. Mencabut Sesi (Force Logout)

Token sesi tersimpan di tabel `sessions` dengan kolom `expires_at`. Untuk memaksa logout:

Logout satu admin (semua sesi user tertentu):

```sql
DELETE FROM restaurant_app.sessions
WHERE user_id = (SELECT id FROM restaurant_app.users WHERE username = 'admin' AND role = 'admin');
```

Cabut semua sesi (semua user harus login ulang):

```sql
DELETE FROM restaurant_app.sessions;
```

Sesi yang sudah kedaluwarsa juga dibersihkan otomatis saat login berikutnya.

---

## 8B. Rate Limiting & Lockout Login

Backend punya proteksi brute-force/abuse in-process (best-effort per instance, tidak dibagi antar instance serverless):

- **Lockout login**: setelah `RESTAURANT_LOGIN_MAX_FAILURES` (default 5) login gagal untuk kombinasi (IP, role, username) dalam `RESTAURANT_LOGIN_FAILURE_WINDOW_SECONDS` (default 900 detik), API membalas `429` dengan header `Retry-After`. Login berhasil otomatis mereset hitungan.
- **Rate limit register/order**: `RESTAURANT_RATE_LIMIT_MAX` (default 60) per `RESTAURANT_RATE_LIMIT_WINDOW_SECONDS` (default 60 detik), per IP untuk register dan per user untuk pembuatan order.

Jika admin sah ikut terkunci (mis. salah ketik berulang):

- Tunggu sampai window berlalu (default 15 menit), **atau**
- Redeploy/restart instance (state in-memory ikut hilang sehingga kunci tereset), **atau**
- Login dari jaringan/IP lain (kunci termasuk IP).

Untuk melonggarkan/memperketat, ubah env var di atas lalu redeploy. Karena state tidak persisten antar instance serverless, ini lapisan pertahanan pertama; untuk jaminan ketat butuh store bersama (DB/Redis).

## 9. Pemulihan Saat Koneksi Supabase Gagal

Gejala: `/api/health` error, login gagal, atau `storageMode` tidak `persistent`.

Cek kesehatan:

```powershell
Invoke-RestMethod -Uri "https://project-hqcx7.vercel.app/api/health" | ConvertTo-Json -Depth 6
```

Respons sehat:

```json
{
  "ok": true,
  "appVersion": "production",
  "schemaVersion": 3,
  "database": "postgres:restaurant_app",
  "storageMode": "persistent",
  "users": 3
}
```

Urutan diagnosa:

1. **Proyek Supabase di-pause.** Paket gratis bisa pause setelah idle. Buka Supabase Dashboard dan resume project.
2. **Password DB salah/baru saja dirotasi.** Pastikan `RESTAURANT_DB_PASSWORD`/`DATABASE_URL` di Vercel sudah diperbarui, lalu redeploy (Bagian 7).
3. **Host/port pooler salah.** Runtime memakai Transaction Pooler (`6543`). Cek `RESTAURANT_DB_HOST`, `RESTAURANT_DB_PORT`, `RESTAURANT_DB_USER` (format `postgres.<project-ref>`).
4. **SSL.** `RESTAURANT_DB_SSLMODE` harus `require`.
5. **Schema hilang/berubah.** Pastikan `RESTAURANT_DB_SCHEMA=restaurant_app`. Jangan menghapus schema.
6. **psycopg2 tidak terpasang.** Error menyebut `psycopg2-binary`. Pastikan `requirements.txt` ikut ter-deploy.
7. **Cek Function Logs** di Vercel untuk `request_id` dan pesan error spesifik.

Jika fix env var, selalu redeploy lalu cek `/api/health` lagi. Jangan menonaktifkan RLS atau menambah policy `anon` luas sebagai "perbaikan".

---

## 9B. Membaca Log Server

Backend memakai logger Python bernama `restaurant` yang menulis ke stderr dengan format `waktu LEVEL [restaurant] pesan`. Di Vercel, ini muncul di **Function Logs**.

- Level diatur via `RESTAURANT_LOG_LEVEL` (`DEBUG`, `INFO`, `WARNING`, `ERROR`). Default `INFO`. Set `WARNING` untuk meredam log akses dan hanya menampilkan masalah.
- **Error 500** dicatat sebagai `unhandled error` lengkap dengan `request_id`, `method`, `path`, `client`, dan stack trace. Respons ke pengguna tetap generik (`Internal server error`) — detail hanya ada di log.
- Setiap respons error juga membawa header `X-Request-ID`; cocokkan nilai itu dengan `request_id` di log untuk menemukan kejadian spesifik.
- Klien yang memutus koneksi di tengah respons dicatat ringkas sebagai `client disconnected` di level WARNING (bukan error/trace), jadi bisa diabaikan.

## 10. Cek Kesehatan Rutin

```powershell
# Produksi
Invoke-RestMethod -Uri "https://project-hqcx7.vercel.app/api/health" | ConvertTo-Json -Depth 6

# Lokal (validasi sebelum commit)
git status --short
npm test
python -m py_compile .\server\app.py .\api\index.py
python .\server\app.py --self-test
```

---

## 11. QA di Produksi Dengan Aman

Jika harus menguji di produksi:

- Buat record QA dengan nama unik (mis. username `qa-<timestamp>`).
- Bersihkan segera setelah selesai:

```sql
-- Hapus order QA beserta item-nya (order_items ikut terhapus via ON DELETE CASCADE)
DELETE FROM restaurant_app.orders WHERE customer_username LIKE 'qa-%';

-- Hapus user QA (sessions ikut terhapus via ON DELETE CASCADE)
DELETE FROM restaurant_app.users WHERE username LIKE 'qa-%' AND role = 'customer';
```

- Jangan pernah menghapus data pelanggan/order asli untuk keperluan QA.
