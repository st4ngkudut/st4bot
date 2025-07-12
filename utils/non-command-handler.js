const { isGroupAdmin } = require("./helpers");

/**
 * Menangani pesan yang bukan merupakan perintah.
 * Ini mencakup fitur seperti antilink, badwords, dan filter.
 * @param {object} sock Objek socket Baileys.
 * @param {object} msg Objek pesan dari Baileys.
 */
async function handleNonCommand(sock, msg) {
    const from = msg.key.remoteJid;
    const sender = msg.key.participant || from;
    const text = (msg.message?.conversation || msg.message?.extendedTextMessage?.text || '').trim();
    const isGroup = from.endsWith('@g.us');

    if (!isGroup) return; // Fitur ini hanya untuk grup

    const senderIsAdmin = await isGroupAdmin(sock, from, sender);
    if (senderIsAdmin) return; // Admin bebas dari filter ini

    // 1. Fitur Anti-Link
    sock.db.get('SELECT antilink FROM group_settings WHERE jid = ? AND antilink = 1', [from], (err, row) => {
        if (err || !row) return;
        if (/https?:\/\//.test(text)) {
            sock.sendMessage(from, { delete: msg.key });
            sock.sendMessage(from, { text: `Maaf @${sender.split('@')[0]}, link tidak diizinkan di grup ini.`, mentions: [sender] });
        }
    });

    // 2. Fitur Badwords dengan Cache
    handleCachedFeature(sock, msg, {
        cache: sock.badwordsCache,
        dbQuery: 'SELECT word FROM badwords WHERE jid = ?',
        onMatch: (found) => {
            sock.sendMessage(from, { delete: msg.key });
        },
        buildRegex: (rows) => {
            if (rows.length === 0) return null;
            // Membuat satu regex besar dari semua badwords
            const pattern = rows.map(row => `\\b${row.word}\\b`).join('|');
            return new RegExp(pattern, 'i');
        }
    });

    // 3. Fitur Filters (Auto-reply) dengan Cache
    handleCachedFeature(sock, msg, {
        cache: sock.filtersCache,
        dbQuery: 'SELECT keyword, content_type, content, file_path FROM filters WHERE jid = ?',
        onMatch: (found) => {
            if (found.content_type === 'text') {
                sock.sendMessage(from, { text: found.content }, { quoted: msg });
            } else if (found.file_path && require('fs').existsSync(found.file_path)) {
                try {
                    const mediaMessage = JSON.parse(found.content);
                    const mediaType = Object.keys(mediaMessage)[0];
                    const mediaKey = mediaType.replace('Message', '');
                    sock.sendMessage(from, { [mediaKey]: { url: found.file_path }, mimetype: mediaMessage[mediaType].mimetype, caption: mediaMessage[mediaType].caption || '' }, { quoted: msg });
                } catch (e) {
                    sock.logger.error({ e }, "Gagal mengirim media dari filter");
                }
            }
        },
        buildRegex: (rows) => rows // untuk filter, kita tidak membuat satu regex, kita loop satu per satu
    });
}

/**
 * Fungsi generik untuk menangani fitur yang menggunakan cache.
 * @param {object} sock - Objek socket
 * @param {object} msg - Objek pesan
 * @param {object} options - Opsi konfigurasi
 * @param {Map} options.cache - Cache Map yang digunakan
 * @param {string} options.dbQuery - Query SQL untuk mengambil data
 * @param {function} options.onMatch - Fungsi yang dieksekusi jika ada kecocokan
 * @param {function} options.buildRegex - Fungsi untuk membangun data yang akan dicocokkan
 */
async function handleCachedFeature(sock, msg, { cache, dbQuery, onMatch, buildRegex }) {
    const from = msg.key.remoteJid;
    const text = (msg.message?.conversation || msg.message?.extendedTextMessage?.text || '').trim();

    const processData = (data) => {
        if (!data) return;

        if (Array.isArray(data)) { // Untuk filter, kita iterasi
            for (const row of data) {
                const regex = new RegExp(`\\b${row.keyword}\\b`, 'i');
                if (regex.test(text)) {
                    onMatch(row);
                    break; // Hentikan setelah match pertama
                }
            }
        } else { // Untuk badword, kita tes satu regex besar
            if (data.test(text)) {
                onMatch(true);
            }
        }
    };

    if (cache.has(from)) {
        processData(cache.get(from));
    } else {
        sock.db.all(dbQuery, [from], (err, rows) => {
            if (err) return sock.logger.error({ err }, "DB error in cached feature");
            
            const dataToCache = buildRegex(rows);
            cache.set(from, dataToCache);
            processData(dataToCache);
        });
    }
}


module.exports = handleNonCommand;
