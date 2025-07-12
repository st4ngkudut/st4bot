const { isGroupAdmin } = require('../../utils/helpers');

module.exports = {
    name: 'reject',
    description: 'Menolak laporan tugas rak dan mengembalikannya ke status "BELUM SELESAI".',
    usage: 'reject <nama rak>',
    category: 'checklist',
    execute: async (sock, msg, args) => {
        const from = msg.key.remoteJid;
        const sender = msg.key.participant || from;
        const isGroup = from.endsWith('@g.us');

        if (!isGroup) return sock.sendMessage(from, { text: 'Perintah ini hanya untuk grup.' });

        const senderIsAdmin = await isGroupAdmin(sock, from, sender);
        if (!senderIsAdmin) return sock.sendMessage(from, { text: '❌ Perintah ini hanya untuk admin grup.' });

        const rakName = args.join(' ');
        if (!rakName) return sock.sendMessage(from, { text: 'Sebutkan nama rak yang akan ditolak.' }, { quoted: msg });

        sock.db.get('SELECT * FROM racks WHERE group_jid = ? AND rak_name = ? AND status = ?', [from, rakName, 'PENDING'], (err, row) => {
            if (err) return sock.sendMessage(from, { text: 'Gagal query DB.' });
            if (!row) return sock.sendMessage(from, { text: `Tidak ada rak bernama "${rakName}" yang menunggu persetujuan.` });

            sock.db.run('UPDATE racks SET status = ?, completed_by = NULL, completed_at = NULL WHERE id = ?', ['BELUM SELESAI', row.id], async (updateErr) => {
                if (updateErr) return sock.sendMessage(from, { text: 'Gagal menolak rak.' });
                await sock.sendMessage(from, { text: `❌ *Ditolak!* Laporan untuk *${rakName}* ditolak oleh @${sender.split('@')[0]}. Mohon @${row.completed_by.split('@')[0]} untuk mengerjakan ulang.`, mentions: [sender, row.completed_by] });
            });
        });
    }
};
