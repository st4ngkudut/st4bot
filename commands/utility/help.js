const { Collection } = require('@discordjs/collection');
const { OWNER_NAME } = require('../../utils/helpers');

module.exports = {
    name: 'help',
    aliases: ['h', 'panduan'],
    description: 'Menampilkan panduan lengkap bot dengan semua detail perintah.',
    category: 'utility',
    execute: async (sock, msg, args) => {
        const { commands } = sock;
        const prefix = ".";

        // Bagian Pengenalan Bot (Kegunaan Bot)
        let responseText = `
*Selamat Datang di Bantuan ${OWNER_NAME} Bot!* ✨

Saya adalah asisten digital yang dirancang untuk membantu Anda dengan berbagai tugas, mulai dari automasi, manajemen grup, hingga hiburan.

*Apa yang bisa saya lakukan?*
- 🤖 Menjawab pertanyaan Anda dengan AI canggih.
- 🧹 Mengelola tugas kebersihan grup dengan sistem ceklis interaktif.
- ⏰ Menjadwalkan pengingat agar Anda tidak lupa.
- 🛡️ Menjaga ketertiban grup dengan fitur anti-link, warning, dan badword.
- 📝 Menyimpan catatan penting, baik teks maupun media.
- ...dan masih banyak lagi!

---
*📖 PANDUAN PERINTAH LENGKAP*
`;

        // Mengelompokkan perintah berdasarkan kategori
        const categories = new Collection();
        commands.forEach(command => {
            if (command.category === 'internal') return; // Jangan tampilkan perintah internal
            const category = categories.get(command.category);
            if (category) {
                category.push(command);
            } else {
                categories.set(command.category, [command]);
            }
        });

        // Mengurutkan kategori berdasarkan abjad
        const sortedCategories = new Collection([...categories.entries()].sort());

        // Membuat daftar detail untuk setiap perintah dalam setiap kategori
        for (const [category, commandList] of sortedCategories.entries()) {
            // Mengurutkan perintah dalam kategori berdasarkan abjad
            const sortedCommandList = commandList.sort((a, b) => a.name.localeCompare(b.name));

            responseText += `\n\n*━━━ ${category.charAt(0).toUpperCase() + category.slice(1)} ━━━*\n`;
            for (const command of sortedCommandList) {
                responseText += `\n*${prefix}${command.name}*\n`;
                responseText += `*Fungsi:* ${command.description || 'Tidak ada deskripsi.'}\n`;
                if (command.usage) {
                    responseText += `*Cara Pakai:* \`${prefix}${command.usage}\`\n`;
                }
                if (command.aliases && command.aliases.length > 0) {
                    responseText += `*Alias:* \`${command.aliases.join(', ')}\`\n`;
                }
            }
        }
        
        responseText += `\n\n_Dibuat oleh ${OWNER_NAME}_`;

        await sock.sendMessage(msg.key.remoteJid, { text: responseText.trim() });
    }
};
