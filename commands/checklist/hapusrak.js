const { isGroupAdmin } = require('../../utils/helpers');

module.exports = {
    name: 'hapusrak',
    description: 'Menghapus sebuah tugas rak dari daftar.',
    usage: 'hapusrak <nama rak>',
    category: 'checklist',
    execute: async (sock, msg, args) => {
        const from = msg.key.remoteJid;
        const sender = msg.key.participant || from;
        const isGroup = from.endsWith('@g.us');

        if (!isGroup) return sock.sendMessage(from, { text: 'Perintah ini hanya untuk grup.' });

        const senderIsAdmin = await isGroupAdmin(sock, from, sender);
        if (!senderIsAdmin) return sock.sendMessage(from, { text: '❌ Perintah ini hanya untuk admin grup.' });

        const rakName = args.join(' ');
        if (!rakName) return sock.sendMessage(from, { text: 'Sebutkan nama rak yang akan dihapus.' }, { quoted: msg });

        sock.db.run('DELETE FROM racks WHERE group_jid = ? AND rak_name = ?', [from, rakName], async function(err) {
            if (err) return sock.sendMessage(from, { text: 'Gagal menghapus rak dari DB.' }, { quoted: msg });
            if (this.changes === 0) return sock.sendMessage(from, { text: `Rak dengan nama "${rakName}" tidak ditemukan.` }, { quoted: msg });
            await sock.sendMessage(from, { text: `🗑️ Rak "${rakName}" berhasil dihapus.` }, { quoted: msg });
        });
    }
};
