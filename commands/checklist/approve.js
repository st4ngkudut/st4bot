const { isGroupAdmin } = require('../../utils/helpers');

module.exports = {
    name: 'approve',
    description: 'Menyetujui atau langsung menyelesaikan satu atau lebih tugas rak.',
    usage: 'approve <rak1>, <rak2>, ...',
    category: 'checklist',
    execute: async (sock, msg, args) => {
        const from = msg.key.remoteJid;
        const sender = msg.key.participant || from;
        const isGroup = from.endsWith('@g.us');

        if (!isGroup) return sock.sendMessage(from, { text: 'Perintah ini hanya untuk grup.' });

        const senderIsAdmin = await isGroupAdmin(sock, from, sender);
        if (!senderIsAdmin) return sock.sendMessage(from, { text: '❌ Perintah ini hanya untuk admin grup.' });

        const rakInput = args.join(' ');
        if (!rakInput) {
            return sock.sendMessage(from, { text: 'Sebutkan satu atau lebih nama rak yang akan disetujui, pisahkan dengan koma.\nContoh: `.approve rak dapur, rak kamar`' }, { quoted: msg });
        }

        const rakNames = rakInput.split(',').map(name => name.trim()).filter(Boolean);
        if (rakNames.length === 0) {
            return sock.sendMessage(from, { text: 'Tidak ada nama rak yang valid untuk diproses.' }, { quoted: msg });
        }

        await sock.sendMessage(from, { react: { text: '⚙️', key: msg.key } });

        let approvedRacks = [];
        let notFoundRacks = [];
        let alreadyDoneRacks = [];
        
        // Menggunakan Promise.all untuk memproses semua rak secara bersamaan
        await Promise.all(rakNames.map(async (rakName) => {
            return new Promise((resolve) => {
                sock.db.get('SELECT * FROM racks WHERE group_jid = ? AND rak_name = ?', [from, rakName], (err, row) => {
                    if (err) {
                        sock.logger.error({ err }, `Gagal mencari rak ${rakName}`);
                        resolve();
                        return;
                    }

                    if (!row) {
                        notFoundRacks.push(rakName);
                        resolve();
                        return;
                    }

                    if (row.status === 'SELESAI') {
                        alreadyDoneRacks.push(rakName);
                        resolve();
                        return;
                    }

                    // Jika sudah PENDING, gunakan user yang menyelesaikan. Jika BELUM, gunakan admin yang approve.
                    const completedBy = row.completed_by || sender;
                    const completedAt = Date.now().toString();

                    sock.db.run('UPDATE racks SET status = ?, completed_by = ?, completed_at = ? WHERE id = ?', ['SELESAI', completedBy, completedAt, row.id], (updateErr) => {
                        if (updateErr) {
                            sock.logger.error({ updateErr }, `Gagal update rak ${rakName}`);
                        } else {
                            approvedRacks.push(rakName);
                        }
                        resolve();
                    });
                });
            });
        }));

        // Membuat pesan laporan hasil
        let responseText = `📝 *Laporan Persetujuan Rak*\n`;
        let mentions = [sender];

        if (approvedRacks.length > 0) {
            responseText += `\n✅ *Berhasil Diselesaikan:*\n- ${approvedRacks.join('\n- ')}\n`;
        }
        if (alreadyDoneRacks.length > 0) {
            responseText += `\n👍 *Sudah Selesai Sebelumnya:*\n- ${alreadyDoneRacks.join('\n- ')}\n`;
        }
        if (notFoundRacks.length > 0) {
            responseText += `\n❌ *Tidak Ditemukan:*\n- ${notFoundRacks.join('\n- ')}\n`;
        }
        
        if (approvedRacks.length === 0 && notFoundRacks.length === 0 && alreadyDoneRacks.length === 0) {
            responseText = 'Tidak ada rak yang diproses. Mungkin terjadi kesalahan.';
        } else {
             responseText += `\n*Disetujui oleh:* @${sender.split('@')[0]}`;
        }
        
        await sock.sendMessage(from, { text: responseText.trim(), mentions: mentions });
    }
};
