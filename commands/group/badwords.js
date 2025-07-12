const { isGroupAdmin } = require('../../utils/helpers');

module.exports = {
    name: 'badwords',
    aliases: ['listbadword'],
    description: 'Melihat daftar kata terlarang di grup.',
    category: 'group',
    execute: async (sock, msg, args) => {
        const from = msg.key.remoteJid;
        const sender = msg.key.participant || from;
        const isGroup = from.endsWith('@g.us');

        if (!isGroup) return sock.sendMessage(from, { text: 'Perintah ini hanya untuk grup.' });

        const senderIsAdmin = await isGroupAdmin(sock, from, sender);
        if (!senderIsAdmin) return sock.sendMessage(from, { text: '❌ Perintah ini hanya untuk admin grup.' });

        sock.db.all('SELECT word FROM badwords WHERE jid = ? ORDER BY word ASC', [from], async (err, rows) => {
            if (err) return sock.sendMessage(from, { text: 'Gagal mengambil data.' });
            if (rows.length === 0) return sock.sendMessage(from, { text: 'Tidak ada kata terlarang yang diatur di grup ini.' }, { quoted: msg });

            let responseText = '🚫 *Daftar Kata Terlarang:*\n\n';
            responseText += rows.map(row => `• ${row.word}`).join('\n');
            await sock.sendMessage(from, { text: responseText }, { quoted: msg });
        });
    }
};
