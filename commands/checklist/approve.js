const { isGroupAdmin } = require('../../utils/helpers');

module.exports = {
    name: 'approve',
    description: 'Menyetujui atau langsung menyelesaikan tugas rak. Bisa dengan membalas pesan laporan atau mengetik nama rak.',
    usage: 'approve <rak1>, <rak2>, ... atau .approve (sambil membalas pesan)',
    category: 'checklist',
    execute: async (sock, msg, args) => {
        const from = msg.key.remoteJid;
        const sender = msg.key.participant || from;
        const isGroup = from.endsWith('@g.us');
        const quotedMsg = msg.message?.extendedTextMessage?.contextInfo?.quotedMessage;

        if (!isGroup) return sock.sendMessage(from, { text: 'Perintah ini hanya untuk grup.' });

        const senderIsAdmin = await isGroupAdmin(sock, from, sender);
        if (!senderIsAdmin) return sock.sendMessage(from, { text: '❌ Perintah ini hanya untuk admin grup.' });

        let rakNames = [];
        const rakInput = args.join(' ');

        // --- LOGIKA BARU: CEK JIKA ADA BALASAN PESAN ---
        if (quotedMsg) {
            const repliedText = quotedMsg.conversation || quotedMsg.extendedTextMessage?.text || '';
            // Ekstrak nama rak dari pesan notifikasi ".selesai"
            const match = repliedText.match(/Tugas \*([^*]+)\*/);
            
            if (match && match[1]) {
                rakNames.push(match[1]); // Proses rak yang ditemukan dari balasan
            } else {
                // Jika membalas pesan tapi formatnya salah
                return sock.sendMessage(from, { text: 'Balasan tidak valid. Pastikan Anda membalas pesan laporan `.selesai` yang benar.' }, { quoted: msg });
            }
        } 
        // --- LOGIKA LAMA: JIKA TIDAK ADA BALASAN, PROSES DARI TEKS ---
        else if (rakInput) {
            rakNames = rakInput.split(',').map(name => name.trim()).filter(Boolean);
        } 
        // --- JIKA TIDAK ADA INPUT SAMA SEKALI ---
        else {
            return sock.sendMessage(from, { text: 'Sebutkan nama rak, atau balas pesan laporan `.selesai` dengan perintah ini.' }, { quoted: msg });
        }

        if (rakNames.length === 0) {
            return sock.sendMessage(from, { text: 'Tidak ada nama rak yang valid untuk diproses.' }, { quoted: msg });
        }

        await sock.sendMessage(from, { react: { text: '⚙️', key: msg.key } });

        let approvedRacks = [];
        let notFoundRacks = [];
        let alreadyDoneRacks = [];
        
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

                    if (row.status === 'SELESAI') {
                        alreadyDoneRacks.push(row.rak_name);
                        resolve();
                        return;
                    }

                    const completedBy = row.completed_by || sender;
                    const completedAt = Date.now().toString();

                    sock.db.run('UPDATE racks SET status = ?, completed_by = ?, completed_at = ? WHERE id = ?', ['SELESAI', completedBy, completedAt, row.id], (updateErr) => {
                        if (updateErr) {
                            sock.logger.error({ updateErr }, `Gagal update rak ${rakName}`);
                        } else {
                            approvedRacks.push(row.rak_name);
                        }
                        resolve();
                    });
                });
            });
        }));

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
