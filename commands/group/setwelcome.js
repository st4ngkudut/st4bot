const { isGroupAdmin } = require('../../utils/helpers');

module.exports = {
    name: 'setwelcome',
    description: 'Mengatur atau menonaktifkan pesan selamat datang untuk anggota baru.',
    usage: 'setwelcome <pesan> atau setwelcome off',
    category: 'group',
    execute: async (sock, msg, args) => {
        const from = msg.key.remoteJid;
        const sender = msg.key.participant || from;
        const isGroup = from.endsWith('@g.us');

        if (!isGroup) return sock.sendMessage(from, { text: 'Perintah ini hanya untuk grup.' });

        const senderIsAdmin = await isGroupAdmin(sock, from, sender);
        if (!senderIsAdmin) return sock.sendMessage(from, { text: '❌ Perintah ini hanya untuk admin grup.' });

        const message = args.join(' ');
        if (!message) return sock.sendMessage(from, { text: 'Format salah. Gunakan `.setwelcome <pesan>`\nContoh: `.setwelcome Selamat datang @user di grup kami!`\nUntuk menonaktifkan, ketik `.setwelcome off`' }, { quoted: msg });

        const welcomeMessage = message.toLowerCase() === 'off' ? null : message;

        sock.db.run(`INSERT INTO group_settings (jid, welcome_message) VALUES (?, ?) ON CONFLICT(jid) DO UPDATE SET welcome_message = ?`, [from, welcomeMessage, welcomeMessage], async (err) => {
            if (err) {
                sock.logger.error({ err }, "Gagal mengatur welcome message");
                return sock.sendMessage(from, { text: 'Gagal mengatur pesan selamat datang.' }, { quoted: msg });
            }
            const status = welcomeMessage ? 'diatur' : 'dinonaktifkan';
            await sock.sendMessage(from, { text: `✅ Pesan selamat datang berhasil ${status}.` }, { quoted: msg });
        });
    }
};
