# Release Checklist

Gunakan checklist ini sebelum publikasi demo atau production.

## Local QA

- [ ] `python server/app.py --self-test` lolos.
- [ ] `npm test` lolos.
- [ ] Login admin berhasil.
- [ ] Register customer berhasil.
- [ ] Customer bisa menambahkan item ke cart.
- [ ] Customer bisa checkout order.
- [ ] Customer bisa melihat order history.
- [ ] Admin melihat pesanan masuk.
- [ ] Admin bisa mengubah status `pending -> processing -> completed`.
- [ ] Laporan Best Seller tampil.
- [ ] Manajemen menu dan meja bisa create/update/delete.
- [ ] Tampilan mobile tidak overflow.
- [ ] Tidak ada teks mojibake di UI.

## Security

- [ ] Password admin production bukan `password123`.
- [ ] `RESTAURANT_ALLOWED_ORIGINS` dibatasi ke domain frontend.
- [ ] Token logout dicabut dari server.
- [ ] Endpoint mutasi membutuhkan token sesuai role.
- [ ] File `.env` tidak masuk Git.
- [ ] Password Supabase tidak pernah ditulis di source code.
- [ ] RLS/revokasi akses Supabase untuk schema aplikasi sudah ditinjau sebelum production publik.

## Data

- [ ] SQLite lokal sudah dibackup jika masih dipakai untuk development.
- [ ] Untuk production, konfigurasi Supabase Transaction Pooler sudah disiapkan di Vercel.
- [ ] Strategi migrasi data order/customer sudah jelas.

## Vercel

- [ ] Environment variable Vercel sudah diisi.
- [ ] `/api/health` mengembalikan `ok: true`.
- [ ] `storageMode` bernilai `persistent` dan `database` bernilai `postgres:restaurant_app`.
- [ ] Domain production sudah dimasukkan ke `RESTAURANT_ALLOWED_ORIGINS`.

## Post Release

- [ ] Coba checkout dari perangkat mobile asli.
- [ ] Coba admin dashboard dari browser berbeda.
- [ ] Cek function logs jika API error.
- [ ] Catat feedback pengguna pertama untuk iterasi UI/UX.
