# st4bot - Bot WhatsApp Multifungsi


**st4bot** adalah sebuah bot WhatsApp serbaguna yang dibangun menggunakan Node.js dan Baileys. Terinspirasi dari fungsionalitas Rose Bot di Telegram, bot ini dikembangkan dengan berbagai fitur canggih, mulai dari moderasi grup otomatis, utilitas sehari-hari, hingga integrasi dengan AI generatif Google Gemini.

## Fitur Utama
- **✨ AI Cerdas**: Terhubung dengan Google Gemini (`gemini-2.5-pro`) untuk menjawab pertanyaan, meringkas teks, dan berinteraksi secara kontekstual dengan membalas pesan.
- **🎨 Hiburan**: Membuat stiker statis dari gambar dan stiker bergerak dari video/GIF secara langsung.
- **📝 Catatan & Filter**: Menyimpan catatan (notes) dan filter balasan otomatis, baik dalam bentuk teks maupun media (gambar, video, dokumen).
- **⏰ Penjadwal Pesan**: Mengirim pesan terjadwal, baik sekali jalan maupun berulang (harian, per beberapa hari, atau mingguan).
- **🛡️ Moderasi Grup**:
  - Pesan selamat datang (`.setwelcome`) untuk anggota baru.
  - Sistem peringatan (`.warn`) yang dapat otomatis mengeluarkan anggota setelah 3x peringatan.
  - Anti-link dan filter kata-kata terlarang (`.badword`).
- **👑 Sistem Admin**: Tingkatan hak akses antara Owner, Admin Bot, dan Admin Grup.
- **⚙️ Utilitas**: Cooldown perintah, notifikasi startup ke owner, dan lainnya.

## Prasyarat
Sebelum instalasi, pastikan sistem Anda (disarankan server Linux/VPS) memiliki:
- **Node.js** (v16 atau lebih tinggi)
- **NPM**
- **Git**
- **FFmpeg** (wajib untuk fitur stiker bergerak)
- **Curl** (biasanya sudah terinstal di sebagian besar sistem Linux)

## Instalasi Cepat (Direkomendasikan)
```bash
curl -sL https://raw.githubusercontent.com/st4ngkudut/st4bot/main/install.sh | bash
```
## Instalasi Manual

1.  **Clone Repositori**
    ```bash
    git clone https://github.com/st4ngkudut/st4bot.git
    ```
2.  **Masuk ke Direktori Proyek**
    ```bash
    cd st4bot
    ```
3.  **Install Dependensi**
    ```bash
    npm install
    ```
4.  **Edit File Konfigurasi**
    ```bash
    cp -r example.config.json config.json && nano config.json
    ```
Edit konfigurasi, masukkan nomer admin dan api gemini anda

## Menjalankan Bot
- **Untuk development/testing:**
  ```bash
  node index.js
  ```
- **Untuk produksi (agar berjalan 24/7):**
  Gunakan PM2.
  ```bash
  pm2 start index.js --name "st4bot"
  ```
  Untuk menyimpan proses agar bot otomatis berjalan setelah server reboot:
  ```bash
  pm2 save
  pm2 startup
  ```
  **PENTING:** Setelah menjalankan bot untuk pertama kali, lihat log untuk memindai QR code:
  ```bash
  pm2 logs st4bot
  ```

## Lisensi

![Versi](https://img.shields.io/badge/version-1.0.0-blue.svg)
![Lisensi](https://img.shields.io/badge/license-MIT-green.svg)
