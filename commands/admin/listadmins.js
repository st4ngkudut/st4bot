module.exports = {
    name: 'listadmins',
    description: 'Menampilkan daftar semua admin bot.',
    category: 'admin',
    execute: async (sock, msg, args) => {
        const { config, db } = sock;
        
        db.all('SELECT jid FROM admins', [], async (err, rows) => {
            if (err) {
                sock.logger.error({ err }, "Gagal mengambil daftar admin");
                return sock.sendMessage(msg.key.remoteJid, { text: 'Gagal mengambil data dari database.' });
            }

            let responseText = `👑 *DAFTAR ADMIN BOT*\n\n*Owner:*\n• @${config.owner.split('@')[0]}\n\n`;
            const mentions = [config.owner];

            if (rows.length > 0) {
                responseText += `*Admin:*\n`;
                rows.forEach(row => {
                    responseText += `• @${row.jid.split('@')[0]}\n`;
                    mentions.push(row.jid);
                });
            } else {
                responseText += `*Admin:*\nTidak ada.`;
            }
            
            await sock.sendMessage(msg.key.remoteJid, { text: responseText, mentions: mentions }, { quoted: msg });
        });
    }
};
