const { getTargetJid, isGroupAdmin } = require('../../utils/helpers');

module.exports = {
    name: 'warnings',
    aliases: ['checkwarn'],
    description: 'Mengecek jumlah peringatan seorang anggota.',
    usage: 'warnings @user/reply',
    category: 'group',
    execute: async (sock, msg, args) => {
        const from = msg.key.remoteJid;
        const sender = msg.key.participant || from;
        const isGroup = from.endsWith('@g.us');

        if (!isGroup) return sock.sendMessage(from, { text: 'Perintah ini hanya untuk grup.' });

        const senderIsAdmin = await isGroupAdmin(sock, from, sender);
        if (!senderIsAdmin) return sock.sendMessage(from, { text: '❌ Perintah ini hanya untuk admin grup.' });

        const targetJid = getTargetJid(msg);
        if (!targetJid) return sock.sendMessage(from, { text: 'Tag pengguna atau balas pesannya untuk dicek.' }, { quoted: msg });

        sock.db.get(`SELECT count FROM warnings WHERE group_jid = ? AND user_jid = ?`, [from, targetJid], async (err, row) => {
            const warnCount = row ? row.count : 0;
            await sock.sendMessage(from, { text: `Jumlah peringatan untuk @${targetJid.split('@')[0]}: *${warnCount}/3*`, mentions: [targetJid] });
        });
    }
};
