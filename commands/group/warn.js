const { getTargetJid, isGroupAdmin } = require('../../utils/helpers');

module.exports = {
    name: 'warn',
    description: 'Memberi peringatan kepada anggota. 3 kali peringatan akan dikeluarkan.',
    usage: 'warn @user/reply',
    category: 'group',
    execute: async (sock, msg, args) => {
        const from = msg.key.remoteJid;
        const sender = msg.key.participant || from;
        const isGroup = from.endsWith('@g.us');

        if (!isGroup) return sock.sendMessage(from, { text: 'Perintah ini hanya untuk grup.' });

        const senderIsAdmin = await isGroupAdmin(sock, from, sender);
        if (!senderIsAdmin) return sock.sendMessage(from, { text: '❌ Perintah ini hanya untuk admin grup.' });

        const targetJid = getTargetJid(msg);
        if (!targetJid) return sock.sendMessage(from, { text: 'Tag pengguna atau balas pesannya untuk diberi peringatan.' }, { quoted: msg });
        
        const targetIsAdmin = await isGroupAdmin(sock, from, targetJid);
        if (targetIsAdmin) return sock.sendMessage(from, { text: '❌ Tidak dapat memberi peringatan kepada sesama admin.' }, { quoted: msg });

        sock.db.run(`INSERT INTO warnings (group_jid, user_jid, count) VALUES (?, ?, 1) ON CONFLICT(group_jid, user_jid) DO UPDATE SET count = count + 1`, [from, targetJid], function(err) {
            if (err) return sock.sendMessage(from, { text: 'Gagal memberi peringatan.' }, { quoted: msg });
            
            sock.db.get(`SELECT count FROM warnings WHERE group_jid = ? AND user_jid = ?`, [from, targetJid], async (getErr, row) => {
                if (getErr || !row) return;
                
                await sock.sendMessage(from, { text: `⚠️ Peringatan untuk @${targetJid.split('@')[0]}.\nTotal peringatan: ${row.count}/3`, mentions: [targetJid] });
                
                if (row.count >= 3) {
                    await sock.sendMessage(from, { text: `Karena telah mencapai 3 peringatan, @${targetJid.split('@')[0]} dikeluarkan dari grup.`, mentions: [targetJid] });
                    await sock.groupParticipantsUpdate(from, [targetJid], 'remove');
                    sock.db.run(`DELETE FROM warnings WHERE group_jid = ? AND user_jid = ?`, [from, targetJid]);
                }
            });
        });
    }
};
