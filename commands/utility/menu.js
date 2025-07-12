const { OWNER_NAME, GITHUB_LINK } = require('../../utils/helpers'); // <-- PERBAIKAN DI SINI

module.exports = {
    name: 'menu',
    description: 'Menampilkan daftar lengkap perintah yang tersedia.',
    category: 'utility',
    execute: async (sock, msg, args) => {
        const from = msg.key.remoteJid;
        const senderName = msg.pushName || 'Kawan';
        const { commands } = sock;

        // Mengelompokkan perintah berdasarkan kategori
        const categories = {};
        commands.forEach(command => {
            if (command.category === 'internal') return;
            if (!categories[command.category]) {
                categories[command.category] = [];
            }
            categories[command.category].push(command.name);
        });

        const categoryOrder = ['ai', 'fun', 'checklist', 'group', 'utility', 'admin'];
        const categoryIcons = {
            ai: '✨',
            fun: '🎨',
            checklist: '✅',
            group: '🛡️',
            utility: '📝',
            admin: '👑'
        };

        let menuText = `
👋 Halo *${senderName}*!
Selamat datang di *${OWNER_NAME} Bot*.

Berikut adalah daftar lengkap perintah yang tersedia, dikelompokkan berdasarkan kategori.
`;

        for (const categoryName of categoryOrder) {
            if (categories[categoryName]) {
                const icon = categoryIcons[categoryName] || '⚙️';
                const formattedCategoryName = categoryName.charAt(0).toUpperCase() + categoryName.slice(1);
                const commandList = categories[categoryName].sort().map(cmd => `.${cmd}`).join(', ');

                menuText += `\n\n${icon} *${formattedCategoryName}*\n\`\`\`${commandList}\`\`\``;
            }
        }

        menuText += `\n\nKetik \`.help\` untuk melihat panduan lengkap dengan deskripsi setiap perintah.`;

        await sock.sendMessage(from, { 
            text: menuText.trim(),
            contextInfo: {
                externalAdReply: {
                    title: `${OWNER_NAME} Bot`,
                    body: "Asisten Digital Multifungsi",
                    thumbnail: Buffer.from(''),
                    sourceUrl: GITHUB_LINK, // Sekarang variabel ini sudah terdefinisi
                    mediaType: 1,
                    renderLargerThumbnail: true
                }
            }
        }, { quoted: msg });
    }
};
