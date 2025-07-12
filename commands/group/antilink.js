const { isGroupAdmin } = require('../../utils/helpers');

module.exports = {
    name: 'antilink',
    description: 'Mengaktifkan atau menonaktifkan fitur anti-link di grup.',
    usage: 'antilink <on/off>',
    category: 'group',
    execute: async (sock, msg, args) => {
        const from = msg.key.remoteJid;
        const sender = msg.key.participant || from;
        const isGroup = from.endsWith('@g.us');

        if (!isGroup) return sock.sendMessage(from, { text: 'Perintah ini hanya untuk grup.' });

        const senderIsAdmin = await isGroupAdmin(sock, from, sender);
        if (!senderIsAdmin) return sock.sendMessage(from, { text: '❌ Perintah ini hanya untuk admin grup.' });

        const option = args[0]?.toLowerCase();
        if (option !== 'on' && option !== 'off') return sock.sendMessage(from, { text: 'Format salah. Gunakan `.antilink on` atau `.antilink off`' }, { quoted: msg });

        const antilinkStatus = option === 'on' ? 1 : 0;
        sock.db.run(`INSERT INTO group_settings (jid, antilink) VALUES (?, ?) ON CONFLICT(jid) DO UPDATE SET antilink = ?`, [from, antilinkStatus, antilinkStatus], async (err) => {
            if (err) {
                sock.logger.error({ err }, "Gagal mengatur antilink");
                return sock.sendMessage(from, { text: 'Gagal mengubah pengaturan anti-link.' }, { quoted: msg });
            }
            await sock.sendMessage(from, { text: `✅ Fitur anti-link telah diatur ke *${option.toUpperCase()}*.` }, { quoted: msg });
        });
    }
};
