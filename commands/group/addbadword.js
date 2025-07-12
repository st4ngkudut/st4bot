const { isGroupAdmin } = require('../../utils/helpers');

module.exports = {
    name: 'addbadword',
    description: 'Menambahkan kata ke daftar terlarang di grup.',
    usage: 'addbadword <kata>',
    category: 'group',
    execute: async (sock, msg, args) => {
        const from = msg.key.remoteJid;
        const sender = msg.key.participant || from;
        const isGroup = from.endsWith('@g.us');

        if (!isGroup) return sock.sendMessage(from, { text: 'Perintah ini hanya untuk grup.' });

        const senderIsAdmin = await isGroupAdmin(sock, from, sender);
        if (!senderIsAdmin) return sock.sendMessage(from, { text: '❌ Perintah ini hanya untuk admin grup.' });

        const word = args[0]?.toLowerCase();
        if (!word) return sock.sendMessage(from, { text: 'Format salah. Gunakan `.addbadword <kata>`' }, { quoted: msg });

        sock.db.run(`INSERT OR IGNORE INTO badwords (jid, word) VALUES (?, ?)`, [from, word], async function(err) {
            if (err) return sock.sendMessage(from, { text: 'Gagal menambahkan kata.' }, { quoted: msg });
            if (this.changes === 0) return sock.sendMessage(from, { text: `Kata *'${word}'* sudah ada dalam daftar.`, mentions: [targetJid] });
            
            // Hapus cache agar daftar badword diperbarui pada pesan berikutnya
            sock.badwordsCache.delete(from);
            
            await sock.sendMessage(from, { text: `✅ Kata *'${word}'* telah ditambahkan ke daftar terlarang.` }, { quoted: msg });
        });
    }
};
