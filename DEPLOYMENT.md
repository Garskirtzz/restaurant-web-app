# Deployment Guide

Panduan ini menyiapkan project untuk deploy preview/public di Vercel.

## Ringkasan Vercel

Vercel cocok untuk:

- Menyajikan `index.html`, `admin.html`, dan asset static.
- Menjalankan API Python melalui Vercel Functions di folder `api/`.
- Preview publik gratis untuk validasi UI dan demo.

Vercel tidak cocok untuk menyimpan SQLite lokal sebagai database production permanen. Saat berjalan di Vercel tanpa `RESTAURANT_DB_PATH`, backend memakai `/tmp/restaurant.db` agar function bisa berjalan, tetapi data dapat hilang saat instance serverless dibuat ulang.

Untuk production yang menyimpan order/customer/menu secara permanen, pindahkan database ke provider eksternal seperti Postgres/Neon/Supabase/Turso dan buat adapter database baru.

## File Deployment

```text
api/index.py       Adapter Vercel Python Function untuk semua route /api/*
vercel.json        Rewrites /api/:path* ke api/index.py
.vercelignore      Menghindari deploy file lokal/test/database
.env.example       Template environment variable
```

## Environment Vercel

Set dari Vercel Dashboard:

```text
RESTAURANT_ADMIN_USERNAME=admin
RESTAURANT_ADMIN_PASSWORD=<password-kuat>
RESTAURANT_SESSION_TTL_SECONDS=86400
RESTAURANT_PASSWORD_ITERATIONS=210000
RESTAURANT_ALLOWED_ORIGINS=https://your-project.vercel.app
RESTAURANT_MAX_JSON_BODY_BYTES=131072
RESTAURANT_APP_VERSION=production
```

Jangan set `RESTAURANT_DB_PATH` di Vercel kecuali sudah memakai storage persisten yang benar-benar tersedia. Untuk demo Vercel, biarkan kosong.

## Deploy

1. Push repository ke GitHub.
2. Import repository di Vercel.
3. Pastikan framework preset adalah `Other`.
4. Isi environment variable di atas.
5. Deploy.
6. Buka `/api/health` dan pastikan response `ok: true`.

## Local Smoke Test

```powershell
python server/app.py --self-test
npm test
```

## Backup SQLite Lokal

Untuk database lokal sebelum perubahan besar:

```powershell
.\server\backup-database.ps1
```

Backup akan dibuat di `server/backups/` dan folder itu diabaikan Git.
