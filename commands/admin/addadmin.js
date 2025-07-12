const { getTargetJid, isBotAdmin } = require('../../utils/helpers');

module.exports = {
    name: 'addadmin',
    description: 'Menambahkan admin bot baru.',
    usage: 'addadmin @user/reply',
    category: 'admin',
    execute: async (sock, msg, args) => {
        const { config, db } = sock;
        const sender = msg.key.participant || msg.key.remoteJid;

        // Hanya owner yang bisa menjalankan
        if (sender !== config.owner) {
            return sock.sendMessage(msg.key.remoteJid, { text: '❌ Perintah ini hanya untuk Owner Bot.' });
        }

        const targetJid = getTargetJid(msg);
        if (!targetJid) {
            return sock.sendMessage(msg.key.remoteJid, { text: 'Tag pengguna atau balas pesannya untuk dijadikan admin.' }, { quoted: msg });
        }

        const targetIsAdmin = await isBotAdmin(sock, targetJid);
        if (targetIsAdmin) {
            return sock.sendMessage(msg.key.remoteJid, { text: 'Pengguna tersebut sudah menjadi admin.' }, { quoted: msg });
        }

        db.run('INSERT OR IGNORE INTO admins (jid) VALUES (?)', [targetJid], async (err) => {
            if (err) {
                sock.logger.error({ err }, "Gagal menambah admin");
                return sock.sendMessage(msg.key.remoteJid, { text: 'Gagal menambahkan admin ke database.' }, { quoted: msg });
            }
            await sock.sendMessage(msg.key.remoteJid, { text: `✅ @${targetJid.split('@')[0]} berhasil ditambahkan sebagai admin bot.`, mentions: [targetJid] }, { quoted: msg });
        });
    }
};
