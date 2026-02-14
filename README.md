# 🔐 LuckySpin License Manager Panel

Admin panel berbasis browser untuk mengelola license LuckySpin.  
Berjalan 100% di sisi client (HTML/CSS/JS statis) — **tidak butuh server/VPS**.  
Bisa di-deploy gratis di **GitHub Pages**.

---

## ✨ Fitur

| Fitur | Deskripsi |
|---|---|
| 📊 Dashboard | Statistik license & aktivasi dalam satu tampilan |
| 🔑 Kelola License | Tambah, hapus, lihat detail serial key |
| ✅ Kelola Aktivasi | Lihat semua aktivasi, cabut (revoke) dari panel |
| 🎲 Generate Key | Generate serial key baru langsung dari browser |
| 🔒 Aman | Token GitHub hanya disimpan di `sessionStorage` (hilang saat browser ditutup) |
| 📱 Responsif | Bisa diakses dari HP atau tablet |

---

## 🚀 Cara Deploy ke GitHub Pages

### 1. Buat Repository Baru

```bash
# Di folder license-panel ini
cd license-panel
git init
git add .
git commit -m "Initial commit - License Manager Panel"
```

### 2. Push ke GitHub

```bash
# Buat repo baru di github.com (misal: license-panel)
git remote add origin https://github.com/USERNAME/license-panel.git
git branch -M main
git push -u origin main
```

### 3. Aktifkan GitHub Pages

1. Buka **Settings** di repository
2. Klik **Pages** di sidebar kiri
3. Di bagian **Source**, pilih:
   - Branch: `main`
   - Folder: `/ (root)`
4. Klik **Save**
5. Tunggu 1-2 menit, panel akan bisa diakses di:
   ```
   https://USERNAME.github.io/license-panel/
   ```

---

## 🔧 Cara Pakai

### Login

1. Buka URL panel di browser
2. Masukkan:
   - **GitHub Token**: Personal Access Token dengan akses `repo` scope
   - **Repository Owner**: pemilik repo license (contoh: `defragtio`)
   - **Repository Name**: nama repo license (contoh: `ls-license`)
3. Klik **Login**

### Membuat GitHub Token

1. Buka https://github.com/settings/tokens
2. Klik **Generate new token (classic)**
3. Beri nama, contoh: "License Panel"
4. Centang scope: **repo** (Full control of private repositories)
5. Klik **Generate token**
6. Salin dan simpan token tersebut

---

## 📁 Struktur File

```
license-panel/
├── index.html              # Halaman utama (login + panel)
├── README.md               # Dokumentasi ini
└── assets/
    ├── css/
    │   └── style.css       # Styling (tema hijau ala ZTE router)
    └── js/
        ├── auth.js         # Autentikasi (login/logout)
        ├── github-api.js   # Wrapper GitHub REST API
        └── panel.js        # Logika panel (CRUD license & aktivasi)
```

---

## 🔒 Keamanan

- **Token TIDAK disimpan secara permanen** — hanya di `sessionStorage` yang otomatis hilang saat tutup browser
- **Repo config** (owner/repo name) bisa disimpan di `localStorage` dengan opsi "Ingat konfigurasi"
- Panel ini adalah file statis murni — tidak ada server yang bisa diretas
- Pastikan repo license kamu bersifat **private**

---

## 🏗 Arsitektur

```
┌─────────────────┐       ┌──────────────────┐       ┌─────────────────────┐
│  License Panel  │──────▶│   GitHub REST    │──────▶│  GitHub Private Repo │
│  (GitHub Pages) │       │      API         │       │  (licenses.json &    │
│  HTML/CSS/JS    │◀──────│                  │◀──────│   activations.json)  │
└─────────────────┘       └──────────────────┘       └─────────────────────┘
                                                              ▲
                                                              │
┌─────────────────┐       ┌──────────────────┐               │
│  Aplikasi PHP   │──────▶│  Cloudflare      │───────────────┘
│  (LuckySpin)    │◀──────│  Worker API      │
└─────────────────┘       └──────────────────┘
```

Panel dan Cloudflare Worker sama-sama mengakses file JSON yang sama di repo GitHub.
Panel untuk admin mengelola, Worker untuk client validasi otomatis.

---

## 📝 Catatan

- Panel ini **tidak wajib** — hanya mempermudah pengelolaan
- Semua yang dilakukan panel juga bisa dilakukan manual melalui edit file di GitHub
- Jika GitHub Pages tidak bisa dipakai, bisa juga buka file `index.html` langsung di browser lokal
