module.exports = {
    name: 'selesai',
    description: 'Menandai sebuah tugas rak sebagai selesai (menunggu review).',
    usage: 'selesai <nama rak>',
    category: 'checklist',
    execute: async (sock, msg, args) => {
        const from = msg.key.remoteJid;
        const sender = msg.key.participant || from;
        const isGroup = from.endsWith('@g.us');

        if (!isGroup) return sock.sendMessage(from, { text: 'Perintah ini hanya untuk grup.' });

        const rakName = args.join(' ');
        if (!rakName) return sock.sendMessage(from, { text: 'Sebutkan nama rak yang telah Anda selesaikan.\nContoh: `.selesai rak dapur`' }, { quoted: msg });

        sock.db.get('SELECT * FROM racks WHERE group_jid = ? AND rak_name = ?', [from, rakName], async (err, row) => {
            if (err) return sock.sendMessage(from, { text: 'Gagal query DB.' });
            if (!row) return sock.sendMessage(from, { text: `Rak "${rakName}" tidak ditemukan.` });
            if (row.assigned_to !== sender) return sock.sendMessage(from, { text: `❌ Anda tidak bisa menyelesaikan tugas orang lain. Tugas ini untuk @${row.assigned_to.split('@')[0]}.`, mentions: [row.assigned_to] });
            if (row.status !== 'BELUM SELESAI') return sock.sendMessage(from, { text: `Status rak ini bukan "BELUM SELESAI" (Status saat ini: ${row.status}).` });
        
            const groupMetadata = await sock.groupMetadata(from);
            const groupAdmins = groupMetadata.participants.filter(p => p.admin).map(p => p.id);
            
            sock.db.run('UPDATE racks SET status = ?, completed_by = ?, completed_at = ? WHERE id = ?', ['PENDING', sender, Date.now().toString(), row.id], async (updateErr) => {
                if (updateErr) return sock.sendMessage(from, { text: 'Gagal memperbarui status rak.' });
                
                const adminMentions = groupAdmins.map(admin => `@${admin.split('@')[0]}`).join(' ');
                await sock.sendMessage(from, { 
                    text: `🔔 *LAPORAN SELESAI*\n\nTugas *${rakName}* telah diselesaikan oleh @${sender.split('@')[0]} dan menunggu persetujuan.\n\nMohon para admin untuk me-review dan melakukan \`.approve\` atau \`.reject\`.`,
                    mentions: [...groupAdmins, sender]
                });
            });
        });
    }
};
