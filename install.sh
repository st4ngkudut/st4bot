#!/bin/bash

# Warna untuk output
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo -e "${GREEN}====================================================${NC}"
echo -e "${GREEN}   Skrip Instalasi Otomatis st4bot (Retail Version)   ${NC}"
echo -e "${GREEN}====================================================${NC}"
echo ""

# --- Langkah 1: Instalasi Dependensi Sistem ---
echo -e "${YELLOW}> Mengupdate daftar paket...${NC}"
sudo apt-get update

echo -e "\n${YELLOW}> Menginstall git, nodejs, npm, dan ffmpeg...${NC}"
sudo apt-get install -y git nodejs npm ffmpeg

# Cek jika npm butuh perbaikan
if ! command -v npm &> /dev/null
then
    echo -e "\n${YELLOW}> Memperbaiki instalasi npm...${NC}"
    sudo apt-get install -y ca-certificates
    sudo npm install -g n
    sudo n stable
fi

# --- Langkah 2: Instalasi PM2 ---
echo -e "\n${YELLOW}> Menginstall PM2 secara global...${NC}"
sudo npm install -g pm2

# --- Langkah 3: Clone Repositori dan Instal Dependensi Bot ---
echo -e "\n${YELLOW}> Mengunduh bot dari branch 'retailversion'...${NC}"
# Hapus folder lama jika ada untuk menghindari konflik
rm -rf st4bot
# Clone branch spesifik
git clone -b retailversion https://github.com/st4ngkudut/st4bot.git
cd st4bot

echo -e "\n${YELLOW}> Menginstall dependensi Node.js untuk bot...${NC}"
npm install

# --- Langkah 4: Konfigurasi Interaktif ---
echo -e "\n${GREEN}=============================================${NC}"
echo -e "${GREEN}         Konfigurasi Bot (config.json)         ${NC}"
echo -e "${GREEN}=============================================${NC}"

read -p "Masukkan nomor WhatsApp Owner (format: 628...): " owner_number
read -p "Masukkan Gemini API Key Anda: " gemini_key

# Membuat file config.json
cat > config.json << EOL
{
  "owner": "${owner_number}@s.whatsapp.net",
  "gemini_api_key": "${gemini_key}"
}
EOL

echo -e "\n${GREEN}✅ File config.json berhasil dibuat.${NC}"

# --- Langkah 5: Menjalankan Bot dengan PM2 ---
echo -e "\n${YELLOW}> Menjalankan bot dengan PM2...${NC}"
pm2 start index.js --name "st4bot"

# --- Langkah 6: Mengatur PM2 agar start saat boot ---
echo -e "\n${YELLOW}> Menyimpan daftar proses PM2...${NC}"
pm2 save
echo -e "\n${YELLOW}> Membuat skrip startup PM2...${NC}"
pm2 startup

# --- Instruksi Final ---
echo -e "\n\n${GREEN}=============================================${NC}"
echo -e "${GREEN}          🎉 INSTALASI SELESAI 🎉          ${NC}"
echo -e "${GREEN}=============================================${NC}"
echo -e "Bot Anda sekarang berjalan di background menggunakan PM2."
echo -e "\n${YELLOW}Langkah Terakhir Anda:${NC}"
echo -e "1. Jalankan perintah yang diberikan oleh 'pm2 startup' di atas (biasanya dimulai dengan 'sudo env...')."
echo -e "2. Untuk melihat log dan **memindai QR code**, gunakan perintah:"
echo -e "   ${GREEN}pm2 logs st4bot${NC}"
echo -e "3. Untuk keluar dari log, tekan ${YELLOW}Ctrl + C${NC}."
