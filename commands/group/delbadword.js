const { isGroupAdmin } = require('../../utils/helpers');

module.exports = {
    name: 'delbadword',
    description: 'Menghapus kata dari daftar terlarang.',
    usage: 'delbadword <kata>',
    category: 'group',
    execute: async (sock, msg, args) => {
        const from = msg.key.remoteJid;
        const sender = msg.key.participant || from;
        const isGroup = from.endsWith('@g.us');

        if (!isGroup) return sock.sendMessage(from, { text: 'Perintah ini hanya untuk grup.' });

        const senderIsAdmin = await isGroupAdmin(sock, from, sender);
        if (!senderIsAdmin) return sock.sendMessage(from, { text: '❌ Perintah ini hanya untuk admin grup.' });

        const word = args[0]?.toLowerCase();
        if (!word) return sock.sendMessage(from, { text: 'Format salah. Gunakan `.delbadword <kata>`' }, { quoted: msg });

        sock.db.run(`DELETE FROM badwords WHERE jid = ? AND word = ?`, [from, word], async function(err) {
            if (err) return sock.sendMessage(from, { text: 'Gagal menghapus kata.' }, { quoted: msg });
            if (this.changes === 0) return sock.sendMessage(from, { text: `Kata *'${word}'* tidak ditemukan dalam daftar.` }, { quoted: msg });
            
            // Hapus cache agar daftar badword diperbarui
            sock.badwordsCache.delete(from);

            await sock.sendMessage(from, { text: `✅ Kata *'${word}'* telah dihapus dari daftar terlarang.` }, { quoted: msg });
        });
    }
};
