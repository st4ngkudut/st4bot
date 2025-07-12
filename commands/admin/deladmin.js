const { getTargetJid, isBotAdmin } = require('../../utils/helpers');

module.exports = {
    name: 'deladmin',
    description: 'Menghapus admin bot.',
    usage: 'deladmin @user/reply',
    category: 'admin',
    execute: async (sock, msg, args) => {
        const { config, db } = sock;
        const sender = msg.key.participant || msg.key.remoteJid;

        if (sender !== config.owner) {
            return sock.sendMessage(msg.key.remoteJid, { text: '❌ Perintah ini hanya untuk Owner Bot.' });
        }

        const targetJid = getTargetJid(msg);
        if (!targetJid) {
            return sock.sendMessage(msg.key.remoteJid, { text: 'Tag admin atau balas pesannya untuk dihapus.' }, { quoted: msg });
        }

        if (targetJid === config.owner) {
            return sock.sendMessage(msg.key.remoteJid, { text: '❌ Owner tidak bisa dihapus dari daftar admin.' }, { quoted: msg });
        }

        db.run('DELETE FROM admins WHERE jid = ?', [targetJid], async function (err) {
            if (err) {
                sock.logger.error({ err }, "Gagal menghapus admin");
                return sock.sendMessage(msg.key.remoteJid, { text: 'Gagal menghapus admin dari database.' }, { quoted: msg });
            }
            if (this.changes === 0) {
                return sock.sendMessage(msg.key.remoteJid, { text: 'Pengguna tersebut bukan admin.' }, { quoted: msg });
            }
            await sock.sendMessage(msg.key.remoteJid, { text: `✅ @${targetJid.split('@')[0]} berhasil dihapus dari daftar admin.`, mentions: [targetJid] }, { quoted: msg });
        });
    }
};
