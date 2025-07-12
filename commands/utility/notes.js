module.exports = {
    name: 'notes',
    aliases: ['listnote'],
    description: 'Menampilkan daftar semua catatan yang tersimpan.',
    category: 'utility',
    execute: async (sock, msg, args) => {
        const from = msg.key.remoteJid;
        sock.db.all('SELECT name FROM notes WHERE jid = ? ORDER BY name ASC', [from], async (err, rows) => {
            if (err) return sock.sendMessage(from, { text: 'Gagal mengambil data.' });
            if (rows.length === 0) return sock.sendMessage(from, { text: 'Belum ada catatan yang tersimpan di chat ini.' }, { quoted: msg });
            
            let responseText = '📋 *Daftar Catatan Tersimpan:*\n\n';
            responseText += rows.map(row => `• \`#${row.name}\``).join('\n');
            responseText += '\n\nKetik `#<nama>` untuk melihat isinya.';
            await sock.sendMessage(from, { text: responseText }, { quoted: msg });
        });
    }
};
