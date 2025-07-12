const fs = require('fs');
const path = require('path');
const { Collection } = require('@discordjs/collection');

/**
 * Memuat semua file perintah dari direktori /commands secara rekursif.
 * @returns {Collection<string, object>} Sebuah koleksi (Map) dari semua perintah.
 */
async function loadCommands() {
    const commands = new Collection();
    const commandsPath = path.join(__dirname, '../commands');
    
    // Pastikan folder commands ada
    if (!fs.existsSync(commandsPath)) {
        console.error("Direktori '/commands' tidak ditemukan. Harap buat folder tersebut.");
        return commands;
    }

    const commandFolders = fs.readdirSync(commandsPath);

    for (const folder of commandFolders) {
        const folderPath = path.join(commandsPath, folder);
        if (fs.statSync(folderPath).isDirectory()) {
            const commandFiles = fs.readdirSync(folderPath).filter(file => file.endsWith('.js'));
            for (const file of commandFiles) {
                try {
                    const filePath = path.join(folderPath, file);
                    const command = require(filePath);
                    
                    if (command.name && command.execute) {
                        commands.set(command.name, command);
                    } else {
                        console.warn(`[PERINGATAN] Perintah di ${filePath} kehilangan properti 'name' atau 'execute'.`);
                    }
                } catch (error) {
                    console.error(`[ERROR] Gagal memuat perintah di ${file}:`, error);
                }
            }
        }
    }

    console.log(`Berhasil memuat ${commands.size} perintah.`);
    return commands;
}

module.exports = loadCommands;
