# Deployment Guide

Panduan ini menyiapkan project untuk deploy preview/public di Vercel.

## Ringkasan Vercel

Vercel cocok untuk:

- Menyajikan `index.html`, `admin.html`, dan asset static.
- Menjalankan API Python melalui Vercel Functions di folder `api/`.
- Preview publik gratis untuk validasi UI dan demo.

Vercel tidak cocok untuk menyimpan SQLite lokal sebagai database production permanen. Untuk data order/customer/menu yang persisten, gunakan Supabase Postgres melalui `DATABASE_URL`.

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
RESTAURANT_DB_SCHEMA=restaurant_app
RESTAURANT_DB_SSLMODE=require
DATABASE_URL=postgres://postgres.project-ref:<password>@aws-0-region.pooler.supabase.com:6543/postgres
```

Ambil `DATABASE_URL` dari Supabase Dashboard > Connect > Transaction pooler. Jangan set `RESTAURANT_DB_PATH` di Vercel kecuali sudah memakai storage persisten yang benar-benar tersedia. Jika `DATABASE_URL` kosong, Vercel hanya berjalan sebagai demo ephemeral.

## Deploy

1. Push repository ke GitHub.
2. Import repository di Vercel.
3. Pastikan framework preset adalah `Other`.
4. Isi environment variable di atas.
5. Deploy.
6. Buka `/api/health` dan pastikan response `ok: true`.
7. Pastikan `storageMode` bernilai `persistent` dan `database` bernilai `postgres:restaurant_app`.

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
