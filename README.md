# st4bot - Bot WhatsApp Multifungsi


**st4bot** adalah sebuah bot WhatsApp serbaguna yang dibangun menggunakan Node.js dan Baileys. Terinspirasi dari fungsionalitas Rose Bot di Telegram, bot ini dikembangkan dengan berbagai fitur canggih, mulai dari moderasi grup otomatis, utilitas sehari-hari, hingga integrasi dengan AI generatif Google Gemini.

## Fitur Utama
- **✨ AI Cerdas**: Terhubung dengan Google Gemini (`gemini-1.5-pro`) untuk menjawab pertanyaan, meringkas teks, dan berinteraksi secara kontekstual dengan membalas pesan.
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
Untuk server Linux baru (Ubuntu/Debian), Anda bisa melakukan instalasi otomatis hanya dengan menyalin dan menjalankan satu baris perintah berikut di terminal:

```bash
curl -sL [https://raw.githubusercontent.com/st4ngkudut/st4bot/main/install.sh](https://raw.githubusercontent.com/st4ngkudut/st4bot/main/install.sh) | bash
```
Skrip akan menangani semua dependensi, mengunduh bot, dan memandu Anda melalui proses konfigurasi secara interaktif.

## Konfigurasi
Jika Anda melakukan instalasi manual, Anda perlu membuat file `config.json` di direktori utama dan isi sesuai format berikut:

```json
{
  "owner": "6281234567890@s.whatsapp.net",
  "ownerName": "ST4NGKUDUT",
  "github": "[https://github.com/st4ngkudut](https://github.com/st4ngkudut)",
  "gemini_api_key": "MASUKKAN_API_KEY_GEMINI_ANDA_DI_SINI"
}
```
- **`owner`**: Nomor WhatsApp Anda sebagai pemilik utama bot (wajib diakhiri `@s.whatsapp.net`).
- **`ownerName`**: Nama Anda yang akan ditampilkan di menu dan kredit.
- **`github`**: Link profil GitHub Anda.
- **`gemini_api_key`**: Kunci API dari Google AI Studio untuk mengaktifkan fitur `.gemini`.

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

## Daftar Perintah
Berikut adalah daftar perintah yang tersedia di dalam bot. Anda juga bisa melihatnya dengan mengetik `.menu`.

```
*🤖 MENU PERINTAH BOT*

*✨ AI (GEMINI)*
• *.gemini <pertanyaan>*
  _Bisa juga balas pesan dengan .gemini_

*🎨 HIBURAN*
• *.sticker*
  _Balas gambar/video/gif untuk dijadikan stiker._

*📝 CATATAN & FILTER*
• *.save <nama> [teks]*
• *#<nama>*
• *.notes*
• *.delete <nama>* _(Admin Bot)_
• *.addfilter <keyword> [jawaban]* _(Admin Bot)_
• *.delfilter <keyword>* _(Admin Bot)_
• *.filters*

*⏰ PENJADWALAN*
• *.schedule <waktu> <pesan>*
• *.listjobs*
• *.deletejob <id>*

*🛡️ ADMIN GRUP*
• *.setwelcome <pesan>*
• *.antilink <on/off>*
• *.warn @user/reply*
• *.warnings @user/reply*
• *.resetwarn @user/reply*
• *.addbadword <kata>*
• *.delbadword <kata>*
• *.badwords*

*👑 ADMIN BOT*
• *.credit / .owner*
• *.addadmin @user/reply*
• *.deladmin @user/reply*
• *.listadmins*

-----------------------------------
_Bot by: ST4NGKUDUT_
```

## Kredit
Dibuat dan dikembangkan oleh **ST4NGKUDUT**.

## Lisensi

![Versi](https://img.shields.io/badge/version-1.0.0-blue.svg)
![Lisensi](https://img.shields.io/badge/license-MIT-green.svg)
Proyek ini dilisensikan di bawah [Lisensi MIT](LICENSE).
