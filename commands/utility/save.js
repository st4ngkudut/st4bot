const { downloadContentFromMessage } = require('@whiskeysockets/baileys');
const path = require('path');
const fs = require('fs');
const { MEDIA_DIR } = require('../../utils/helpers');

module.exports = {
    name: 'save',
    description: 'Menyimpan catatan teks atau media.',
    usage: 'save <nama> (sambil reply media atau dengan teks)',
    category: 'utility',
    execute: async (sock, msg, args) => {
        const from = msg.key.remoteJid;
        const quotedMsg = msg.message?.extendedTextMessage?.contextInfo?.quotedMessage;
        
        if (args.length < 1) return sock.sendMessage(from, { text: '❌ Format salah!\n\nGunakan: `.save <nama> [teks]`' }, { quoted: msg });
        
        const noteName = args[0].toLowerCase().trim();
        const textContent = args.slice(1).join(' ');

        if (quotedMsg) {
            const mediaType = Object.keys(quotedMsg)[0];
            if (['imageMessage', 'videoMessage', 'documentMessage', 'stickerMessage', 'audioMessage'].includes(mediaType)) {
                try {
                    const stream = await downloadContentFromMessage(quotedMsg[mediaType], mediaType.replace('Message', ''));
                    const extension = quotedMsg[mediaType].mimetype.split('/')[1].split(';')[0];
                    const filePath = path.join(MEDIA_DIR, `note_${noteName}_${Date.now()}.${extension}`);
                    
                    let buffer = [];
                    for await (const chunk of stream) { buffer.push(chunk); }
                    fs.writeFileSync(filePath, Buffer.concat(buffer));
                    
                    const mediaContent = JSON.parse(JSON.stringify(quotedMsg));
                    if (textContent) mediaContent[mediaType].caption = textContent;

                    const contentJson = JSON.stringify(mediaContent);
                    sock.db.run(`INSERT INTO notes (jid, name, content_type, content, file_path) VALUES (?, ?, ?, ?, ?) ON CONFLICT(jid, name) DO UPDATE SET content_type='media', content=?, file_path=?`,
                        [from, noteName, 'media', contentJson, filePath, contentJson, filePath],
                        async (err) => {
                            if (err) return sock.sendMessage(from, { text: '❌ Gagal menyimpan catatan media ke database.' }, { quoted: msg });
                            await sock.sendMessage(from, { text: `✅ Catatan media *${noteName}* berhasil disimpan!\nGunakan #${noteName} untuk memanggilnya.` }, { quoted: msg });
                        });
                    return;
                } catch (e) {
                    sock.logger.error({ e }, "Gagal download media untuk .save");
                    return sock.sendMessage(from, { text: '❌ Gagal mengunduh media yang dibalas.' }, { quoted: msg });
                }
            }
        }
        
        if (!textContent) return sock.sendMessage(from, { text: '❌ Tidak ada teks atau media yang valid untuk disimpan.' }, { quoted: msg });
        
        sock.db.run(`INSERT INTO notes (jid, name, content_type, content, file_path) VALUES (?, ?, ?, ?, NULL) ON CONFLICT(jid, name) DO UPDATE SET content_type='text', content=?, file_path=NULL`,
            [from, noteName, 'text', textContent, textContent],
            async (err) => {
                if (err) return sock.sendMessage(from, { text: '❌ Gagal menyimpan catatan teks ke database.' }, { quoted: msg });
                await sock.sendMessage(from, { text: `✅ Catatan *${noteName}* berhasil disimpan!\nGunakan #${noteName} untuk memanggilnya.` }, { quoted: msg });
            });
    }
};
