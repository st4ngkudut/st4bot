module.exports = {
    name: 'filters',
    aliases: ['listfilter'],
    description: 'Melihat daftar semua filter yang aktif.',
    category: 'utility',
    execute: async (sock, msg, args) => {
        const from = msg.key.remoteJid;
        sock.db.all('SELECT keyword FROM filters WHERE jid = ? ORDER BY keyword ASC', [from], async (err, rows) => {
            if (err) return sock.sendMessage(from, { text: 'Gagal mengambil data.' });
            if (rows.length === 0) return sock.sendMessage(from, { text: 'Tidak ada filter yang aktif di chat ini.' }, { quoted: msg });
            
            let responseText = '💬 *Daftar Filter Aktif:*\n\n';
            responseText += rows.map(row => `• \`${row.keyword}\``).join('\n');
            await sock.sendMessage(from, { text: responseText }, { quoted: msg });
        });
    }
};
