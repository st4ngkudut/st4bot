const { isBotAdmin } = require('../../utils/helpers');
const fs = require('fs');

module.exports = {
    name: 'delete',
    aliases: ['delnote'],
    description: 'Menghapus catatan (notes).',
    usage: 'delete <nama catatan>',
    category: 'utility',
    execute: async (sock, msg, args) => {
        const from = msg.key.remoteJid;
        const sender = msg.key.participant || from;

        const senderIsBotAdmin = await isBotAdmin(sock, sender);
        if (!senderIsBotAdmin) return sock.sendMessage(from, { text: '❌ Perintah ini hanya untuk admin bot.' }, { quoted: msg });

        if (args.length < 1) return sock.sendMessage(from, { text: '❌ Format salah! Gunakan: `.delete <nama>`' }, { quoted: msg });
        
        const noteName = args[0].toLowerCase().trim();
        sock.db.get('SELECT file_path FROM notes WHERE jid = ? AND name = ?', [from, noteName], (err, row) => {
            if (err) return sock.sendMessage(from, { text: 'Error database.' });
            if (!row) return sock.sendMessage(from, { text: `❌ Catatan *${noteName}* tidak ditemukan.` }, { quoted: msg });

            if (row.file_path && fs.existsSync(row.file_path)) {
                fs.unlinkSync(row.file_path);
            }
            sock.db.run('DELETE FROM notes WHERE jid = ? AND name = ?', [from, noteName], async (delErr) => {
                if (delErr) return sock.sendMessage(from, { text: 'Gagal menghapus catatan dari database.' }, { quoted: msg });
                await sock.sendMessage(from, { text: `🗑️ Catatan *${noteName}* berhasil dihapus.` }, { quoted: msg });
            });
        });
    }
};
