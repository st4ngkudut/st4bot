module.exports = {
    name: 'listjobs',
    aliases: ['jobs'],
    description: 'Melihat daftar semua pesan terjadwal.',
    category: 'utility',
    execute: async (sock, msg, args) => {
        const from = msg.key.remoteJid;
        sock.db.all('SELECT * FROM schedules WHERE jid = ? ORDER BY next_run ASC', [from], async (err, rows) => {
            if (err) return sock.sendMessage(from, { text: 'Gagal mengambil data.' });
            if (rows.length === 0) return sock.sendMessage(from, { text: 'Tidak ada pesan yang dijadwalkan di chat ini.' }, { quoted: msg });
            
            let responseText = '🗓️ *Daftar Tugas Terjadwal:*\n\n';
            rows.forEach(job => {
                const jobDate = new Date(job.next_run).toLocaleString('id-ID', { timeZone: 'Asia/Jakarta' });
                responseText += `*ID:* \`${job.id}\`\n*Waktu:* ${jobDate}\n*Pesan:* "${job.message.substring(0, 40)}..."\n\n`;
            });
            await sock.sendMessage(from, { text: responseText }, { quoted: msg });
        });
    }
};
