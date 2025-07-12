# ST4BOT (Retail Version) - Bot WhatsApp Multifungsi

**ST4BOT** adalah sebuah bot WhatsApp serbaguna yang dibangun menggunakan Node.js dan Baileys. Terinspirasi dari fungsionalitas Rose Bot di Telegram, bot ini dikembangkan dengan berbagai fitur canggih, mulai dari moderasi grup otomatis, utilitas sehari-hari, hingga integrasi dengan AI generatif Google Gemini.

## Detail Fitur

Bot ini dirancang dengan berbagai modul untuk memenuhi kebutuhan manajemen grup dan produktivitas Anda.

### ✨ AI Cerdas (Google Gemini)
-   **`.gemini <pertanyaan>`**: Ajukan pertanyaan apa pun ke AI. Bot juga bisa memahami konteks jika Anda membalas (reply) pesan lain saat menggunakan perintah ini.

### 🎨 Hiburan & Stiker
-   **`.sticker`**: Ubah gambar atau GIF/video menjadi stiker WhatsApp. Cukup balas media yang diinginkan dengan perintah ini. Video akan otomatis dipotong menjadi 6 detik.

### ✅ Ceklis Kebersihan Interaktif
Sistem manajemen tugas untuk mengelola dan memantau pekerjaan rutin di dalam grup.
-   **`.tambahrak @user <tugas>`**: (Admin) Memberi tugas kepada anggota.
-   **`.selesai <tugas>`**: (Anggota) Menandai tugas sebagai selesai untuk direview.
-   **`.approve <tugas>`**: (Admin) Menyetujui pekerjaan yang sudah selesai. Bisa multi-rak dan bisa langsung menyelesaikan tugas yang belum dikerjakan.
-   **`.reject <tugas>`**: (Admin) Menolak laporan pekerjaan.
-   **`.ceklis`**: Menampilkan papan skor kebersihan seluruh tugas.
-   **`.rakku`**: Melihat daftar tugas pribadi.

### 🛡️ Moderasi & Manajemen Grup
-   **`.setwelcome <pesan>`**: Mengatur pesan selamat datang otomatis untuk anggota baru. Gunakan `@user` untuk mention anggota tersebut. Kirim `.setwelcome off` untuk menonaktifkan.
-   **`.antilink <on/off>`**: Mengaktifkan/menonaktifkan larangan mengirim link di grup bagi anggota biasa.
-   **`.warn @user`**: Memberi peringatan kepada anggota. 3 kali peringatan akan otomatis mengeluarkan anggota dari grup.
-   **`.addbadword <kata>`**: Menambahkan kata ke daftar terlarang. Pesan yang mengandung kata ini akan otomatis dihapus.

### 📝 Utilitas & Produktivitas
-   **`.save <nama> [teks]`**: Menyimpan catatan. Bisa menyimpan teks biasa atau media (gambar/video/dokumen) dengan cara me-reply media tersebut.
-   **`.notes`**: Melihat daftar semua catatan yang tersimpan.
-   **`#<nama>`**: Memanggil atau menampilkan isi catatan yang sudah disimpan.
-   **`.schedule <waktu> <pesan>`**: Menjadwalkan pengiriman pesan. Waktu bisa relatif (misal: `10m`, `2h`) atau berulang (`everyday 09:00`).
-   **`.help`**: Menampilkan panduan lengkap semua fitur bot.

### 👑 Sistem Admin & Owner
-   **`.addadmin @user`**: (Owner) Menambahkan pengguna sebagai admin bot.
-   **`.deladmin @user`**: (Owner) Menghapus admin bot.
-   Perintah moderasi dan pengaturan grup hanya bisa diakses oleh admin grup.

---
## Instalasi

Anda bisa memilih untuk menginstal **`retailversion`** (direkomendasikan, fitur lengkap dan terstruktur) atau versi **`main`** (versi lama/legacy).

### Opsi 1: Instalasi `retailversion` (Direkomendasikan)

Ini adalah versi terbaru dengan struktur kode yang rapi dan fitur yang telah disempurnakan.

#### ► Instalasi Cepat (Otomatis)
Script ini akan secara otomatis mengunduh branch `retailversion` dan menyiapkan semuanya untuk Anda.

-   **Untuk VPS Linux (Debian/Ubuntu/dll.):**
    ```bash
    curl -sL [https://raw.githubusercontent.com/st4ngkudut/st4bot/retailversion/install.sh](https://raw.githubusercontent.com/st4ngkudut/st4bot/retailversion/install.sh) | bash
    ```
-   **Untuk Termux (Android):**
    ```bash
    curl -sL [https://raw.githubusercontent.com/st4ngkudut/st4bot/retailversion/termux-install.sh](https://raw.githubusercontent.com/st4ngkudut/st4bot/retailversion/termux-install.sh) | bash
    ```

#### ► Instalasi Manual

1.  **Prasyarat Sistem**
    Pastikan sistem Anda memiliki: Node.js (v16+), NPM, Git, dan FFmpeg.

2.  **Clone Branch `retailversion`**
    Gunakan perintah `git clone` dengan flag `-b` untuk langsung mengambil branch spesifik.
    ```bash
    git clone -b retailversion [https://github.com/st4ngkudut/st4bot.git](https://github.com/st4ngkudut/st4bot.git)
    ```
3.  **Masuk ke Direktori Proyek**
    ```bash
    cd st4bot
    ```
4.  **Install Semua Dependensi**
    ```bash
    npm install
    ```
5.  **Buat & Edit File Konfigurasi**
    Salin file contoh dan isi dengan data Anda.
    ```bash
    cp example.config.json config.json
    nano config.json
    ```
    -   `"owner"`: Isi dengan nomor WhatsApp Anda (`628... @s.whatsapp.net`).
    -   `"gemini_api_key"`: Isi dengan API Key Google Gemini Anda.

### Opsi 2: Instalasi Versi `main` (Lama/Legacy)

<details>
<summary>Klik di sini untuk melihat instruksi instalasi versi lama (main)</summary>

Ini adalah versi lama dengan kode dalam satu file. Tidak direkomendasikan untuk pengembangan lebih lanjut.

-   **Instalasi Cepat:**
    ```bash
    # Untuk VPS Linux
    curl -sL [https://raw.githubusercontent.com/st4ngkudut/st4bot/main/install.sh](https://raw.githubusercontent.com/st4ngkudut/st4bot/main/install.sh) | bash
    # Untuk Termux
    curl -sL [https://raw.githubusercontent.com/st4ngkudut/st4bot/main/termux-install.sh](https://raw.githubusercontent.com/st4ngkudut/st4bot/main/termux-install.sh) | bash
    ```
-   **Instalasi Manual:**
    ```bash
    # 1. Clone repositori (ini akan mengambil branch 'main' secara default)
    git clone [https://github.com/st4ngkudut/st4bot.git](https://github.com/st4ngkudut/st4bot.git)
    # 2. Masuk ke direktori
    cd st4bot
    # 3. Lanjutkan dengan `npm install` dan konfigurasi seperti biasa.
    ```
</details>

---

### Menjalankan Bot

Langkah-langkah ini sama untuk kedua versi setelah instalasi selesai.

-   **Untuk Menjalankan Langsung (Development/Testing):**
    ```bash
    node index.js
    ```
-   **Untuk Menjalankan di Latar Belakang 24/7 (Produksi):**
    Sangat disarankan menggunakan **PM2**.
    ```bash
    # Install PM2 secara global jika belum ada
    npm install -g pm2

    # Jalankan bot dengan PM2
    pm2 start index.js --name "st4bot"
    ```
-   **Melihat Log dan Kode QR:**
    Untuk melihat output bot, termasuk kode QR saat pertama kali dijalankan, gunakan perintah:
    ```bash
    pm2 logs st4bot
    ```
-   **Menyimpan Proses PM2:**
    Agar bot otomatis berjalan kembali setelah server reboot:
    ```bash
    pm2 save
    pm2 startup
    ```
---
## Lisensi

![Versi](https://img.shields.io/badge/version-2.0.0-blue.svg)
![Lisensi](https://img.shields.io/badge/license-MIT-green.svg)
