module.exports = {
    name: 'pending',
    description: 'Melihat daftar tugas yang menunggu persetujuan admin.',
    category: 'checklist',
    execute: async (sock, msg, args) => {
        const from = msg.key.remoteJid;
        const isGroup = from.endsWith('@g.us');

        if (!isGroup) return sock.sendMessage(from, { text: 'Perintah ini hanya untuk grup.' });

        sock.db.all('SELECT rak_name, assigned_to FROM racks WHERE group_jid = ? AND status = ? ORDER BY completed_at', [from, 'PENDING'], async (err, rows) => {
            if (err) return sock.sendMessage(from, { text: 'Gagal mengambil data.' });
            if (rows.length === 0) return sock.sendMessage(from, { text: `👍 Tidak ada tugas yang menunggu persetujuan saat ini.` });

            let responseText = `🟡 *DAFTAR TUGAS MENUNGGU PERSETUJUAN*\n\n`;
            let mentions = [];
            responseText += rows.map(row => {
                mentions.push(row.assigned_to);
                return `• *${row.rak_name}* (Oleh: @${row.assigned_to.split('@')[0]})`;
            }).join('\n');
            await sock.sendMessage(from, { text: responseText, mentions: mentions });
        });
    }
};
