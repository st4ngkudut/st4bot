const { isBotAdmin, isGroupAdmin } = require('../../utils/helpers');

module.exports = {
    name: 'deletejob',
    aliases: ['deljob'],
    description: 'Menghapus pesan terjadwal.',
    usage: 'deletejob <ID Jadwal>',
    category: 'utility',
    execute: async (sock, msg, args) => {
        const from = msg.key.remoteJid;
        const sender = msg.key.participant || from;

        const senderIsBotAdmin = await isBotAdmin(sock, sender);
        const senderIsGroupAdmin = await isGroupAdmin(sock, from, sender);
        
        if (!senderIsBotAdmin && !senderIsGroupAdmin) return sock.sendMessage(from, { text: '❌ Anda harus menjadi admin bot atau admin grup.' }, { quoted: msg });

        if (args.length < 1) return sock.sendMessage(from, { text: '❌ Format salah! Gunakan: `.deletejob <ID>`' }, { quoted: msg });
        
        const jobId = args[0];
        sock.db.get('SELECT author FROM schedules WHERE id = ? AND jid = ?', [jobId, from], (err, row) => {
            if (err || !row) return sock.sendMessage(from, { text: `❌ Tugas dengan ID \`${jobId}\` tidak ditemukan.` }, { quoted: msg });
            
            // Izinkan admin menghapus job siapa pun, atau user menghapus job miliknya sendiri
            if (row.author !== sender && !senderIsBotAdmin && !senderIsGroupAdmin) {
                return sock.sendMessage(from, { text: '❌ Anda bukan pembuat tugas ini atau admin.' }, { quoted: msg });
            }

            sock.db.run('DELETE FROM schedules WHERE id = ?', [jobId], async (delErr) => {
                if (delErr) return sock.sendMessage(from, { text: 'Gagal menghapus tugas.' }, { quoted: msg });
                await sock.sendMessage(from, { text: `🗑️ Tugas dengan ID \`${jobId}\` berhasil dihapus.` }, { quoted: msg });
            });
        });
    }
};
