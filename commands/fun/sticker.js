const { downloadContentFromMessage } = require('@whiskeysockets/baileys');
const ffmpeg = require('fluent-ffmpeg');
const fs = require('fs');
const path = require('path');
const { STICKER_TMP_DIR } = require('../../utils/helpers');

module.exports = {
    name: 'sticker',
    aliases: ['s', 'stiker'],
    description: 'Mengubah gambar atau video menjadi stiker.',
    usage: 'sticker (sambil mereply gambar/video/gif)',
    category: 'fun',
    execute: async (sock, msg, args) => {
        const from = msg.key.remoteJid;
        const quotedMsg = msg.message?.extendedTextMessage?.contextInfo?.quotedMessage;
        
        if (!quotedMsg) {
            return sock.sendMessage(from, { text: 'Balas gambar atau video/GIF dengan perintah ini.' }, { quoted: msg });
        }

        const mediaType = Object.keys(quotedMsg)[0];
        
        if (mediaType !== 'imageMessage' && mediaType !== 'videoMessage') {
            return sock.sendMessage(from, { text: 'Tipe media tidak didukung. Balas gambar atau video/GIF.' }, { quoted: msg });
        }

        await sock.sendMessage(from, { react: { text: '⚙️', key: msg.key } });

        try {
            const stream = await downloadContentFromMessage(quotedMsg[mediaType], mediaType.replace('Message', ''));
            let buffer = Buffer.from([]);
            for await (const chunk of stream) {
                buffer = Buffer.concat([buffer, chunk]);
            }
            
            if (mediaType === 'imageMessage') {
                await sock.sendMessage(from, { sticker: buffer });
            } else { // videoMessage
                const timestamp = Date.now();
                const inputFile = path.join(STICKER_TMP_DIR, `${timestamp}.mp4`);
                const outputFile = path.join(STICKER_TMP_DIR, `${timestamp}.webp`);
                fs.writeFileSync(inputFile, buffer);

                ffmpeg(inputFile)
                    .outputOptions([
                        '-vcodec', 'libwebp',
                        '-vf', "scale=512:512:force_original_aspect_ratio=decrease,fps=15,pad=512:512:-1:-1:color=white@0.0",
                        '-loop', '0',
                        '-ss', '00:00:00.0',
                        '-t', '00:00:06.0', // Batasi durasi hingga 6 detik
                        '-preset', 'default',
                        '-an',
                        '-vsync', '0',
                        '-q:v', '50' // Kualitas stiker (0-100, lebih rendah = kualitas lebih baik & ukuran lebih besar)
                    ])
                    .toFormat('webp')
                    .save(outputFile)
                    .on('end', async () => {
                        await sock.sendMessage(from, { sticker: { url: outputFile } });
                        fs.unlinkSync(inputFile);
                        fs.unlinkSync(outputFile);
                    })
                    .on('error', async (err) => {
                        sock.logger.error({ err }, "Error FFMPEG");
                        await sock.sendMessage(from, { text: 'Gagal membuat stiker bergerak. Pastikan ffmpeg terinstall di server.' }, { quoted: msg });
                        fs.unlinkSync(inputFile);
                        if (fs.existsSync(outputFile)) fs.unlinkSync(outputFile);
                    });
            }
        } catch (error) {
            sock.logger.error({ error }, "Error membuat stiker");
            await sock.sendMessage(from, { text: 'Terjadi kesalahan saat mengunduh atau memproses media.' }, { quoted: msg });
            await sock.sendMessage(from, { react: { text: '❌', key: msg.key } });
        }
    }
};
