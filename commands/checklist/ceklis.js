module.exports = {
    name: 'ceklis',
    description: 'Menampilkan status semua ceklis kebersihan di grup.',
    category: 'checklist',
    execute: async (sock, msg, args) => {
        const { db } = sock;
        const from = msg.key.remoteJid;
        const isGroup = from.endsWith('@g.us');

        if (!isGroup) return sock.sendMessage(from, { text: 'Perintah ini hanya bisa digunakan di dalam grup.' });

        db.all('SELECT rak_name, assigned_to, status FROM racks WHERE group_jid = ? ORDER BY assigned_to, rak_name', [from], async (err, rows) => {
            if (err) return sock.sendMessage(from, { text: 'Gagal mengambil data dari database.' });
            if (rows.length === 0) return sock.sendMessage(from, { text: 'Belum ada data ceklis kebersihan di grup ini. Gunakan `.tambahrak` untuk memulai.' });

            const statusMap = { 'BELUM SELESAI': '🔴', 'PENDING': '🟡', 'SELESAI': '✅' };
            let responseText = '📋 *STATUS CEKLIS KEBERSIHAN GRUP*\n\n';
            let mentions = [];
            let groupedByUser = {};

            rows.forEach(row => {
                if (!groupedByUser[row.assigned_to]) {
                    groupedByUser[row.assigned_to] = [];
                }
                groupedByUser[row.assigned_to].push(`${statusMap[row.status] || '❓'} ${row.rak_name}`);
            });
            
            for (const userId in groupedByUser) {
                if (!mentions.includes(userId)) mentions.push(userId);
                responseText += `*👤 @${userId.split('@')[0]}*\n`;
                responseText += groupedByUser[userId].join('\n');
                responseText += '\n\n';
            }

            responseText += `--------------------\n*Legenda:*\n🔴 BELUM SELESAI\n🟡 PENDING REVIEW\n✅ SELESAI`;
            await sock.sendMessage(from, { text: responseText, mentions: mentions });
        });
    }
};
