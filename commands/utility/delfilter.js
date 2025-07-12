const { isBotAdmin } = require('../../utils/helpers');

module.exports = {
    name: 'delfilter',
    description: 'Menghapus sebuah filter.',
    usage: 'delfilter <keyword>',
    category: 'utility',
    execute: async (sock, msg, args) => {
        const from = msg.key.remoteJid;
        const sender = msg.key.participant || from;

        const senderIsBotAdmin = await isBotAdmin(sock, sender);
        if (!senderIsBotAdmin) return sock.sendMessage(from, { text: '❌ Perintah ini hanya untuk admin bot.' }, { quoted: msg });

        if (args.length < 1) return sock.sendMessage(from, { text: '❌ Format salah!\n\nGunakan: `.delfilter <keyword>`' }, { quoted: msg });

        const keyword = args[0].toLowerCase().trim();
        sock.db.run('DELETE FROM filters WHERE jid = ? AND keyword = ?', [from, keyword], async function (err) {
            if (err) return sock.sendMessage(from, { text: 'Gagal menghapus filter dari database.' }, { quoted: msg });
            if (this.changes === 0) return sock.sendMessage(from, { text: `❌ Filter untuk keyword *'${keyword}'* tidak ditemukan.` }, { quoted: msg });

            sock.filtersCache.delete(from); // Invalidate cache
            await sock.sendMessage(from, { text: `🗑️ Filter untuk keyword *'${keyword}'* berhasil dihapus.` }, { quoted: msg });
        });
    }
};
