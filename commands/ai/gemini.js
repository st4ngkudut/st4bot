const { askGemini, isBotAdmin } = require('../../utils/helpers');

module.exports = {
    name: 'gemini',
    aliases: ['ai'],
    description: 'Mengajukan pertanyaan ke Google Gemini AI.',
    usage: 'gemini <pertanyaan>',
    category: 'ai',
    execute: async (sock, msg, args) => {
        const from = msg.key.remoteJid;
        const sender = msg.key.participant || from;
        const quotedMsg = msg.message?.extendedTextMessage?.contextInfo?.quotedMessage;

        // Cooldown logic
        // Anda bisa menambahkan logika cooldown di sini jika diperlukan,
        // mirip dengan kode lama, tapi lebih baik dikelola secara terpusat jika memungkinkan.

        const instruction = args.join(' ');
        let prompt = '';

        if (quotedMsg) {
            const repliedText = quotedMsg.conversation || quotedMsg.extendedTextMessage?.text || '';
            prompt = instruction ? `${instruction}:\n\n"${repliedText}"` : repliedText;
        } else {
            prompt = instruction;
        }

        if (!prompt) {
            return sock.sendMessage(from, { text: `Silakan berikan pertanyaan.\nContoh: \`${sock.prefix}gemini apa itu node.js\`` }, { quoted: msg });
        }

        await sock.sendMessage(from, { react: { text: '🤔', key: msg.key } });
        try {
            const result = await askGemini(prompt);
            await sock.sendMessage(from, { text: result }, { quoted: msg });
            await sock.sendMessage(from, { react: { text: '✅', key: msg.key } });
        } catch (error) {
            sock.logger.error({ error }, "Error asking Gemini");
            await sock.sendMessage(from, { text: 'Terjadi kesalahan saat berkomunikasi dengan AI.' }, { quoted: msg });
            await sock.sendMessage(from, { react: { text: '❌', key: msg.key } });
        }
    }
};
