const { downloadContentFromMessage } = require('@whiskeysockets/baileys');
const { exec } = require('child_process'); // Menggunakan modul bawaan Node.js
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

                // Perintah FFMPEG yang lebih kuat dan dieksekusi langsung
                const ffmpegCommand = `ffmpeg -i ${inputFile} -vcodec libwebp -vf "scale=512:512:force_original_aspect_ratio=decrease,fps=15,pad=512:512:-1:-1:color=white@0.0" -loop 0 -ss 00:00:00.0 -t 00:00:05.9 -preset default -an -vsync 0 -q:v 70 ${outputFile}`;

                exec(ffmpegCommand, async (error, stdout, stderr) => {
                    // Hapus file input setelah selesai atau gagal
                    fs.unlinkSync(inputFile);

                    if (error) {
                        sock.logger.error({ error: error.message, stderr }, "Error FFMPEG saat eksekusi langsung");
                        await sock.sendMessage(from, { text: 'Gagal total membuat stiker bergerak. Kemungkinan besar instalasi FFmpeg di server bermasalah atau tidak mendukung libwebp. Hubungi admin server.' }, { quoted: msg });
                        return;
                    }

                    // Jika berhasil, kirim stiker lalu hapus file output
                    await sock.sendMessage(from, { sticker: { url: outputFile } });
                    fs.unlinkSync(outputFile);
                });
            }
        } catch (error) {
            sock.logger.error({ error }, "Error membuat stiker");
            await sock.sendMessage(from, { text: 'Terjadi kesalahan saat mengunduh atau memproses media.' }, { quoted: msg });
            await sock.sendMessage(from, { react: { text: '❌', key: msg.key } });
        }
    }
};

