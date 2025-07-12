const { getTargetJid, isGroupAdmin } = require('../../utils/helpers');

module.exports = {
    name: 'resetwarn',
    description: 'Mereset jumlah peringatan seorang anggota menjadi 0.',
    usage: 'resetwarn @user/reply',
    category: 'group',
    execute: async (sock, msg, args) => {
        const from = msg.key.remoteJid;
        const sender = msg.key.participant || from;
        const isGroup = from.endsWith('@g.us');

        if (!isGroup) return sock.sendMessage(from, { text: 'Perintah ini hanya untuk grup.' });

        const senderIsAdmin = await isGroupAdmin(sock, from, sender);
        if (!senderIsAdmin) return sock.sendMessage(from, { text: '❌ Perintah ini hanya untuk admin grup.' });

        const targetJid = getTargetJid(msg);
        if (!targetJid) return sock.sendMessage(from, { text: 'Tag pengguna atau balas pesannya untuk direset.' }, { quoted: msg });

        sock.db.run(`DELETE FROM warnings WHERE group_jid = ? AND user_jid = ?`, [from, targetJid], async function(err) {
            if (err) return sock.sendMessage(from, { text: 'Gagal mereset peringatan.' }, { quoted: msg });
            if (this.changes === 0) return sock.sendMessage(from, { text: `Pengguna @${targetJid.split('@')[0]} tidak memiliki catatan peringatan.`, mentions: [targetJid] });
            await sock.sendMessage(from, { text: `✅ Peringatan untuk @${targetJid.split('@')[0]} telah direset.`, mentions: [targetJid] });
        });
    }
};
