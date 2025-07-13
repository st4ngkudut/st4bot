const axios = require('axios');

// Fungsi untuk menerjemahkan nama waktu sholat dari Inggris ke Indonesia
const translatePrayerName = (name) => {
    const names = {
        Fajr: 'Subuh',
        Sunrise: 'Terbit',
        Dhuhr: 'Dzuhur',
        Asr: 'Ashar',
        Maghrib: 'Maghrib',
        Isha: 'Isya',
        Imsak: 'Imsak'
    };
    return names[name] || name;
};

module.exports = {
    name: 'jadwalsholat',
    aliases: ['sholat', 'jadwal'],
    description: 'Menampilkan jadwal sholat untuk kota tertentu di Indonesia.',
    usage: 'jadwalsholat <nama kota>',
    category: 'utility',
    execute: async (sock, msg, args) => {
        const from = msg.key.remoteJid;
        const cityName = args.join(' ');

        if (!cityName) {
            return sock.sendMessage(from, { text: 'Masukkan nama kota yang ingin Anda cek.\nContoh: `.jadwalsholat Medan`' }, { quoted: msg });
        }

        await sock.sendMessage(from, { react: { text: '🕌', key: msg.key } });

        try {
            // --- PERUBAHAN API DI SINI ---
            // Menggunakan API Aladhan dengan metode Kemenag (method=11)
            const scheduleUrl = `http://api.aladhan.com/v1/timingsByCity?city=${encodeURIComponent(cityName)}&country=Indonesia&method=11`;
            const response = await axios.get(scheduleUrl);

            if (response.data.code !== 200 || !response.data.data) {
                return sock.sendMessage(from, { text: 'Gagal mengambil jadwal sholat. Pastikan nama kota benar.' }, { quoted: msg });
            }

            const timings = response.data.data.timings;
            const dateInfo = response.data.data.date.readable;
            const hijriInfo = response.data.data.date.hijri.date;

            let responseText = `*Jadwal Sholat untuk ${cityName}*\n`;
            responseText += `*Tanggal:* ${dateInfo} / ${hijriInfo}\n\n`;
            responseText += `Imsak   : ${timings.Imsak}\n`;
            responseText += `Subuh   : ${timings.Fajr}\n`;
            responseText += `Terbit  : ${timings.Sunrise}\n`;
            responseText += `Dzuhur  : ${timings.Dhuhr}\n`;
            responseText += `Ashar   : ${timings.Asr}\n`;
            responseText += `Maghrib : ${timings.Maghrib}\n`;
            responseText += `Isya    : ${timings.Isha}`;

            await sock.sendMessage(from, { text: responseText }, { quoted: msg });

        } catch (error) {
            if (error.response && error.response.status === 404) {
                 await sock.sendMessage(from, { text: `Maaf, kota "${cityName}" tidak ditemukan.` }, { quoted: msg });
            } else {
                sock.logger.error({ err: error }, "Error pada fitur jadwal sholat (Aladhan API)");
                await sock.sendMessage(from, { text: 'Terjadi kesalahan saat mengambil data jadwal sholat. API mungkin sedang tidak dapat dijangkau.' }, { quoted: msg });
            }
        }
    }
};

