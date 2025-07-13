module.exports = {
    name: 'selesai',
    description: 'Menandai satu atau lebih tugas rak sebagai selesai (menunggu review).',
    usage: 'selesai <rak1>, <rak2>, ...',
    category: 'checklist',
    execute: async (sock, msg, args) => {
        const from = msg.key.remoteJid;
        const sender = msg.key.participant || from;
        const senderName = msg.pushName || sender.split('@')[0];
        const isGroup = from.endsWith('@g.us');

        if (!isGroup) return sock.sendMessage(from, { text: 'Perintah ini hanya untuk grup.' });

        const rakInput = args.join(' ');
        if (!rakInput) {
            return sock.sendMessage(from, { text: 'Sebutkan satu atau lebih nama rak yang telah Anda selesaikan, pisahkan dengan koma.\nContoh: `.selesai rak dapur, rak kamar`' }, { quoted: msg });
        }

        // Ini adalah baris kunci yang memisahkan input Anda
        const rakNames = rakInput.split(',').map(name => name.trim()).filter(Boolean);
        if (rakNames.length === 0) {
            return sock.sendMessage(from, { text: 'Tidak ada nama rak yang valid untuk diproses.' }, { quoted: msg });
        }

        await sock.sendMessage(from, { react: { text: '⚙️', key: msg.key } });

        let submittedRacks = [];
        let notFoundRacks = [];
        let notAssignedRacks = [];
        let alreadyProcessedRacks = [];

        await Promise.all(rakNames.map(async (rakName) => {
            return new Promise((resolve) => {
                const query = 'SELECT * FROM racks WHERE group_jid = ? AND rak_name = ? COLLATE NOCASE';
                sock.db.get(query, [from, rakName], (err, row) => {
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

                    if (row.assigned_to !== sender) {
                        notAssignedRacks.push(rakName);
                        resolve();
                        return;
                    }

                    if (row.status !== 'BELUM SELESAI') {
                        alreadyProcessedRacks.push(`'${row.rak_name}' (Status: ${row.status})`);
                        resolve();
                        return;
                    }

                    const completedAt = Date.now().toString();
                    sock.db.run('UPDATE racks SET status = ?, completed_by = ?, completed_at = ? WHERE id = ?', ['PENDING', sender, completedAt, row.id], (updateErr) => {
                        if (updateErr) {
                            sock.logger.error({ updateErr }, `Gagal update rak ${rakName}`);
                        } else {
                            submittedRacks.push(row.rak_name);
                        }
                        resolve();
                    });
                });
            });
        }));

        // Kirim laporan hasil ke pengguna
        let summaryText = `📝 *Laporan Penyelesaian Tugas*\n`;
        if (submittedRacks.length > 0) {
            summaryText += `\n✅ *Berhasil Dikirim untuk Review:*\n- ${submittedRacks.join('\n- ')}\n`;
        }
        if (notFoundRacks.length > 0) {
            summaryText += `\n❌ *Tidak Ditemukan:*\n- ${notFoundRacks.join('\n- ')}\n`;
        }
        if (notAssignedRacks.length > 0) {
            summaryText += `\n⚠️ *Bukan Tugas Anda:*\n- ${notAssignedRacks.join('\n- ')}\n`;
        }
        if (alreadyProcessedRacks.length > 0) {
            summaryText += `\n👍 *Sudah Diproses Sebelumnya:*\n- ${alreadyProcessedRacks.join('\n- ')}\n`;
        }
        
        if (submittedRacks.length === 0 && notFoundRacks.length === 0 && notAssignedRacks.length === 0 && alreadyProcessedRacks.length === 0) {
            summaryText = 'Tidak ada rak yang diproses. Mungkin terjadi kesalahan.';
        }

        await sock.sendMessage(from, { text: summaryText.trim() }, { quoted: msg });

        // Kirim satu notifikasi ringkasan ke admin jika ada tugas yang berhasil disubmit
        if (submittedRacks.length > 0) {
            const groupMetadata = await sock.groupMetadata(from);
            const groupAdmins = groupMetadata.participants.filter(p => p.admin).map(p => p.id);
            const adminMentions = groupAdmins.map(admin => `@${admin.split('@')[0]}`).join(' ');

            const notificationText = `
🔔 *LAPORAN SELESAI BARU*

Anggota *${senderName}* (@${sender.split('@')[0]}) telah menyelesaikan tugas berikut dan menunggu persetujuan:
- ${submittedRacks.join('\n- ')}

Mohon para admin (${adminMentions}) untuk me-review dan melakukan \`.approve\` atau \`.reject\`.
            `.trim();

            await sock.sendMessage(from, {
                text: notificationText,
                mentions: [...groupAdmins, sender]
            });
        }
    }
};
