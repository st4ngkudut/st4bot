module.exports = {
    name: 'rakku',
    description: 'Menampilkan tugas rak yang ditugaskan kepada Anda.',
    category: 'checklist',
    execute: async (sock, msg, args) => {
        const from = msg.key.remoteJid;
        const sender = msg.key.participant || from;
        const isGroup = from.endsWith('@g.us');
        const senderName = msg.pushName || sender.split('@')[0];

        if (!isGroup) return sock.sendMessage(from, { text: 'Perintah ini hanya untuk grup.' });

        sock.db.all('SELECT rak_name, status FROM racks WHERE group_jid = ? AND assigned_to = ? ORDER BY status', [from, sender], async (err, rows) => {
            if (err) return sock.sendMessage(from, { text: 'Gagal mengambil data.' });
            if (rows.length === 0) return sock.sendMessage(from, { text: `Anda tidak memiliki tugas rak di grup ini, ${senderName}.` });

            const statusMap = { 'BELUM SELESAI': '🔴', 'PENDING': '🟡', 'SELESAI': '✅' };
            let responseText = `📋 *Tugas Rak Anda, ${senderName}:*\n\n`;
            responseText += rows.map(row => `${statusMap[row.status]} ${row.rak_name}`).join('\n');
            await sock.sendMessage(from, { text: responseText });
        });
    }
};
