const { isGroupAdmin } = require('../../utils/helpers');

module.exports = {
    name: 'resetceklis',
    description: 'Menghapus semua data ceklis di grup (butuh konfirmasi).',
    category: 'checklist',
    execute: async (sock, msg, args) => {
        const from = msg.key.remoteJid;
        const sender = msg.key.participant || from;
        const isGroup = from.endsWith('@g.us');

        if (!isGroup) return sock.sendMessage(from, { text: 'Perintah ini hanya untuk grup.' });

        const senderIsAdmin = await isGroupAdmin(sock, from, sender);
        if (!senderIsAdmin) return sock.sendMessage(from, { text: '❌ Perintah ini hanya untuk admin grup.' });

        const confirmKey = `${from}:${sender}`;
        sock.pendingConfirmation.set(confirmKey, {
            command: '.confirmreset',
            action: async () => {
                sock.db.run('DELETE FROM racks WHERE group_jid = ?', [from], async (err) => {
                    if (err) return sock.sendMessage(from, { text: 'Gagal mereset ceklis.' });
                    await sock.sendMessage(from, { text: '🧹 Semua data ceklis kebersihan di grup ini telah berhasil direset.' });
                });
            }
        });
        
        setTimeout(() => {
            if (sock.pendingConfirmation.has(confirmKey)) {
                sock.pendingConfirmation.delete(confirmKey);
            }
        }, 30000); // Konfirmasi berlaku selama 30 detik

        await sock.sendMessage(from, { text: '⚠️ *PERINGATAN!* Perintah ini akan menghapus SEMUA data ceklis di grup ini.\n\nKetik `.confirmreset` dalam 30 detik untuk melanjutkan.' });
    }
};
