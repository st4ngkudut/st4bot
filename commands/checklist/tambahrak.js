const { getTargetJid, isGroupAdmin } = require('../../utils/helpers');

module.exports = {
    name: 'tambahrak',
    description: 'Menambahkan tugas rak baru untuk seorang anggota.',
    usage: 'tambahrak @user <rak1>, <rak2>, ...',
    category: 'checklist',
    execute: async (sock, msg, args) => {
        const from = msg.key.remoteJid;
        const sender = msg.key.participant || from;
        const isGroup = from.endsWith('@g.us');

        if (!isGroup) return sock.sendMessage(from, { text: 'Perintah ini hanya untuk grup.' });

        const senderIsAdmin = await isGroupAdmin(sock, from, sender);
        if (!senderIsAdmin) return sock.sendMessage(from, { text: '❌ Perintah ini hanya untuk admin grup.' });

        const targetJid = getTargetJid(msg);
        if (!targetJid) return sock.sendMessage(from, { text: 'Tag pengguna yang akan diberi tugas.\nContoh: `.tambahrak @user rak dapur, rak kamar`' }, { quoted: msg });

        // Mengambil nama rak dari argumen setelah mention
        const rakText = msg.message?.extendedTextMessage?.text.split(targetJid.split('@')[0])[1] || args.join(' ');
        const rakNames = rakText.split(',').map(name => name.trim()).filter(name => name !== '');
        
        if (rakNames.length === 0) return sock.sendMessage(from, { text: 'Sebutkan nama rak yang akan ditambahkan.\nContoh: `.tambahrak @user rak dapur, rak kamar`' }, { quoted: msg });

        let addedCount = 0;
        const stmt = sock.db.prepare(`INSERT OR IGNORE INTO racks (group_jid, rak_name, assigned_to) VALUES (?, ?, ?)`);
        for (const name of rakNames) {
            stmt.run(from, name, targetJid, function(err) {
                if (err) sock.logger.error({ err }, `Gagal menambah rak ${name}`);
                else if (this.changes > 0) addedCount++;
            });
        }
        stmt.finalize(async (err) => {
            if (err) return sock.sendMessage(from, { text: 'Terjadi kesalahan saat finalisasi database.' });
            if (addedCount > 0) {
                await sock.sendMessage(from, { text: `✅ Berhasil menambahkan ${addedCount} rak baru untuk @${targetJid.split('@')[0]}.`, mentions: [targetJid] });
            } else {
                await sock.sendMessage(from, { text: `Tidak ada rak baru yang ditambahkan (mungkin sudah ada).` });
            }
        });
    }
};
