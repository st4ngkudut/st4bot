const fs = require('fs');

module.exports = {
    name: 'getnote',
    category: 'internal', // Kategori internal tidak akan muncul di menu help
    execute: async (sock, msg, args) => {
        const from = msg.key.remoteJid;
        const noteName = args[0];
        if (!noteName) return;

        sock.db.get('SELECT content_type, content, file_path FROM notes WHERE jid = ? AND name = ?', [from, noteName], async (err, row) => {
            if (err || !row) return; // Jangan kirim pesan error agar tidak spam
            
            if (row.content_type === 'text') {
                await sock.sendMessage(from, { text: row.content });
            } else if (row.file_path && fs.existsSync(row.file_path)) {
                try {
                    const mediaMessage = JSON.parse(row.content);
                    const mediaType = Object.keys(mediaMessage)[0];
                    const mediaKey = mediaType.replace('Message', '');
                    await sock.sendMessage(from, { [mediaKey]: { url: row.file_path }, mimetype: mediaMessage[mediaType].mimetype, caption: mediaMessage[mediaType].caption || '' }, { quoted: msg });
                } catch (e) {
                    sock.logger.error({ e }, `Gagal mengirim media dari catatan #${noteName}`);
                    await sock.sendMessage(from, { text: "Gagal mengirim file catatan." });
                }
            }
        });
    }
};
