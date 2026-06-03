# 🏛️ Cetak Biru Arsitektur Web & Panduan AI (Sistem Restoran Digital)

## 1. Lingkungan Proyek & Tumpukan Teknologi
- **Project Name:** Project_Website_Penjualan
- **Workspace:** VS Code + Live Server
- **Engine:** HTML5, CSS3 (Modern Flexbox & Grid), JavaScript Vanilla (ES6+)
- **Database/State:** Client-side persistent via `localStorage`

## 2. Filosofi Visual: Grey Aesthetic Premium (Anti-Template AI)
Kamu wajib menjauhi layout kaku khas Bootstrap atau komponen bawaan AI yang pasaran. Desain harus terasa minimalis, industrial, bersih, dan berkelas.

### A. Token Warna & Variabel CSS (Wajib di `:root`)
```css
:root {
    --bg-main: #f8f9fa;       /* Latar belakang utama (Abu-abu industrial sangat terang) */
    --bg-card: #ffffff;       /* Kontainer aktif / Kartu data (White solid) */
    --surface-grey: #e9ecef;  /* Komponen sekunder, background input, & efek hover */
    --border-grey: #dee2e6;   /* Garis batas tipis 1px pembentuk struktur */
    --text-dark: #212529;     /* Tipografi utama (Hitam pekat, kontras tinggi) */
    --text-muted: #6c757d;    /* Tipografi sekunder (Abu-abu gelap untuk deskripsi) */
    
    /* Aksen Kontras Mikro (Aksen Restoran) */
    --accent: #f45656;        
    --accent-hover: #d32f2f;
    
    /* Batasan Efek Geometris */
    --radius-premium: 16px;   /* Lengkungan sudut modern untuk komponen */
    --shadow-soft: 0 10px 30px rgba(0, 0, 0, 0.02); /* Shadow tipis hampir tak terlihat */
}