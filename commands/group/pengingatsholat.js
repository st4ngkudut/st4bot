const axios = require('axios');
const { isGroupAdmin } = require('../../utils/helpers');

module.exports = {
    name: 'pengingatsholat',
    description: 'Mengaktifkan atau menonaktifkan pengingat sholat otomatis untuk grup.',
    usage: 'pengingatsholat <on/off> [nama kota]',
    category: 'group',
    execute: async (sock, msg, args) => {
        const from = msg.key.remoteJid;
        const sender = msg.key.participant || from;
        const isGroup = from.endsWith('@g.us');

        if (!isGroup) return sock.sendMessage(from, { text: 'Perintah ini hanya untuk grup.' });

        const senderIsAdmin = await isGroupAdmin(sock, from, sender);
        if (!senderIsAdmin) return sock.sendMessage(from, { text: '❌ Perintah ini hanya untuk admin grup.' });

        const option = args[0]?.toLowerCase();
        const cityName = args.slice(1).join(' ');

        if (option === 'on') {
            if (!cityName) {
                return sock.sendMessage(from, { text: 'Masukkan nama kota setelah "on".\nContoh: `.pengingatsholat on Medan`' }, { quoted: msg });
            }

            try {
                // --- PERUBAHAN API DI SINI ---
                // Validasi kota dengan mencoba mengambil jadwal dari API Aladhan
                const validationUrl = `http://api.aladhan.com/v1/timingsByCity?city=${encodeURIComponent(cityName)}&country=Indonesia&method=11`;
                await axios.get(validationUrl);

                // Jika berhasil, simpan nama kota yang divalidasi
                const validatedCityName = cityName.split(' ').map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase()).join(' ');

                // Kita akan menyimpan nama kota di kedua kolom untuk konsistensi, meskipun city_id tidak lagi berupa angka.
                sock.db.run(`INSERT INTO prayer_reminders (group_jid, city_id, city_name, is_active) VALUES (?, ?, ?, 1) ON CONFLICT(group_jid) DO UPDATE SET city_id=?, city_name=?, is_active=1`,
                    [from, validatedCityName, validatedCityName, validatedCityName, validatedCityName],
                    async (err) => {
                        if (err) {
                            sock.logger.error({ err }, "Gagal menyimpan pengingat sholat");
                            return sock.sendMessage(from, { text: 'Gagal menyimpan pengaturan.' });
                        }
                        await sock.sendMessage(from, { text: `✅ Pengingat sholat berhasil diaktifkan untuk wilayah *${validatedCityName}*.` });
                    }
                );
            } catch (error) {
                if (error.response && error.response.status === 404) {
                    await sock.sendMessage(from, { text: `Gagal mengaktifkan pengingat. Kota "${cityName}" tidak dapat ditemukan.` }, { quoted: msg });
                } else {
                    sock.logger.error({ err: error }, "Error saat validasi kota (Aladhan API)");
                    await sock.sendMessage(from, { text: 'Gagal memvalidasi kota karena terjadi kesalahan server.' });
                }
            }

        } else if (option === 'off') {
            sock.db.run(`UPDATE prayer_reminders SET is_active = 0 WHERE group_jid = ?`, [from], async function(err) {
                if (err) return sock.sendMessage(from, { text: 'Gagal menonaktifkan pengingat.' });
                if (this.changes === 0) return sock.sendMessage(from, { text: 'Pengingat sholat memang belum aktif di grup ini.' });
                await sock.sendMessage(from, { text: `✅ Pengingat sholat berhasil dinonaktifkan.` });
            });
        } else {
            return sock.sendMessage(from, { text: 'Gunakan format `.pengingatsholat on <kota>` atau `.pengingatsholat off`.' }, { quoted: msg });
        }
    }
};

