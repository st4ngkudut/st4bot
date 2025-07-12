const { downloadContentFromMessage } = require('@whiskeysockets/baileys');
const { isBotAdmin, MEDIA_DIR } = require('../../utils/helpers');
const path = require('path');
const fs = require('fs');

module.exports = {
    name: 'addfilter',
    description: 'Menambahkan filter auto-reply untuk sebuah keyword.',
    usage: 'addfilter <keyword> <jawaban>',
    category: 'utility',
    execute: async (sock, msg, args) => {
        const from = msg.key.remoteJid;
        const sender = msg.key.participant || from;
        const quotedMsg = msg.message?.extendedTextMessage?.contextInfo?.quotedMessage;

        const senderIsBotAdmin = await isBotAdmin(sock, sender);
        if (!senderIsBotAdmin) return sock.sendMessage(from, { text: '❌ Perintah ini hanya untuk admin bot.' }, { quoted: msg });
        
        if (args.length < 1) return sock.sendMessage(from, { text: '❌ Format salah!\n\nGunakan: `.addfilter <keyword> [jawaban]`' }, { quoted: msg });

        const keyword = args[0].toLowerCase().trim();
        const textContent = args.slice(1).join(' ');

        if (quotedMsg) {
            // Logika untuk menyimpan filter media...
        }

        if (!textContent) return sock.sendMessage(from, { text: '❌ Tidak ada teks atau media untuk dijadikan jawaban filter.' }, { quoted: msg });

        sock.db.run(`INSERT INTO filters (jid, keyword, content_type, content) VALUES (?, ?, 'text', ?) ON CONFLICT(jid, keyword) DO UPDATE SET content=?`,
            [from, keyword, textContent, textContent], async (err) => {
            if (err) return sock.sendMessage(from, { text: '❌ Gagal menyimpan filter ke database.' }, { quoted: msg });

            sock.filtersCache.delete(from); // Invalidate cache
            await sock.sendMessage(from, { text: `✅ Filter untuk keyword *'${keyword}'* berhasil ditambahkan.` }, { quoted: msg });
        });
    }
};
