const { OWNER_NAME, GITHUB_LINK } = require('../../utils/helpers');

module.exports = {
    name: 'credit',
    aliases: ['owner'],
    description: 'Menampilkan informasi pembuat bot.',
    category: 'utility',
    execute: async (sock, msg, args) => {
        const creditText = `*🤖 Bot Credit 🤖*\n\nBot ini dikembangkan dengan penuh ❤️ oleh:\n*${OWNER_NAME}*\n\nGitHub: ${GITHUB_LINK}`;
        await sock.sendMessage(msg.key.remoteJid, { text: creditText }, { quoted: msg });
    }
};
