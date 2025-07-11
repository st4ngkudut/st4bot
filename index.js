const { default: makeWASocket, useMultiFileAuthState, DisconnectReason, fetchLatestBaileysVersion, downloadContentFromMessage } = require('@whiskeysockets/baileys');
const { GoogleGenerativeAI } = require('@google/generative-ai');
const pino = require('pino');
const { Boom } = require('@hapi/boom');
const fs = require('fs');
const cron = require('node-cron');
const qrcode = require('qrcode-terminal');
const path = require('path');
const ffmpeg = require('fluent-ffmpeg');
const sqlite3 = require('sqlite3').verbose();

// =================================================================
// PENGATURAN TAMPILAN (SILAKAN EDIT DI SINI)
// =================================================================
const OWNER_NAME = "ST4NGKUDUT";
const GITHUB_LINK = "https://github.com/st4ngkudut";

// =================================================================
// PENGATURAN PATH DAN DIREKTORI
// =================================================================
const DB_FILE_PATH = './bot_database.db';
const CONFIG_FILE_PATH = './config.json';
const MEDIA_DIR = './media_files';
const STICKER_TMP_DIR = './sticker_tmp';

if (!fs.existsSync(MEDIA_DIR)) fs.mkdirSync(MEDIA_DIR);
if (!fs.existsSync(STICKER_TMP_DIR)) fs.mkdirSync(STICKER_TMP_DIR);

// =================================================================
// PENGATURAN COOLDOWN
// =================================================================
const COOLDOWN_SECONDS = 60;
const commandCooldowns = new Map();

// =================================================================
// INISIALISASI DATABASE SQLITE
// =================================================================
const db = new sqlite3.Database(DB_FILE_PATH, (err) => {
    if (err) {
        console.error('Gagal terhubung ke database SQLite', err.message);
        process.exit(1);
    } else {
        console.log('Terhubung ke database SQLite.');
    }
});

db.serialize(() => {
    db.run(`CREATE TABLE IF NOT EXISTS admins (jid TEXT PRIMARY KEY)`);
    db.run(`CREATE TABLE IF NOT EXISTS notes (id INTEGER PRIMARY KEY AUTOINCREMENT, jid TEXT NOT NULL, name TEXT NOT NULL, content_type TEXT NOT NULL, content TEXT NOT NULL, file_path TEXT, UNIQUE(jid, name))`);
    db.run(`CREATE TABLE IF NOT EXISTS filters (id INTEGER PRIMARY KEY AUTOINCREMENT, jid TEXT NOT NULL, keyword TEXT NOT NULL, content_type TEXT NOT NULL, content TEXT NOT NULL, file_path TEXT, UNIQUE(jid, keyword))`);
    db.run(`CREATE TABLE IF NOT EXISTS schedules (id TEXT PRIMARY KEY, jid TEXT NOT NULL, author TEXT NOT NULL, message TEXT NOT NULL, next_run INTEGER NOT NULL, recurrence_json TEXT)`);
    db.run(`CREATE TABLE IF NOT EXISTS group_settings (jid TEXT PRIMARY KEY, welcome_message TEXT, antilink BOOLEAN NOT NULL DEFAULT 0)`);
    db.run(`CREATE TABLE IF NOT EXISTS warnings (id INTEGER PRIMARY KEY AUTOINCREMENT, group_jid TEXT NOT NULL, user_jid TEXT NOT NULL, count INTEGER NOT NULL DEFAULT 1, UNIQUE(group_jid, user_jid))`);
    db.run(`CREATE TABLE IF NOT EXISTS badwords (id INTEGER PRIMARY KEY AUTOINCREMENT, jid TEXT NOT NULL, word TEXT NOT NULL, UNIQUE(jid, word))`);
});

// =================================================================
// FUNGSI HELPER
// =================================================================
function parseRelativeTimeToMs(timeString) { if (!timeString) return null; const match = timeString.match(/^(\d+)([smhd])$/); if (!match) return null; const value = parseInt(match[1]); const unit = match[2]; switch (unit) { case 's': return value * 1000; case 'm': return value * 60 * 1000; case 'h': return value * 60 * 60 * 1000; case 'd': return value * 24 * 60 * 60 * 1000; default: return null; } }
function parseCustomDateTimeToMs(dateString, timeString) { if (!dateString || !timeString) return null; const dateParts = dateString.split('-'); const timeParts = timeString.split(':'); if (dateParts.length !== 3 || timeParts.length !== 2) return null; const day = parseInt(dateParts[0]); const month = parseInt(dateParts[1]) - 1; const year = parseInt(dateParts[2]); const hour = parseInt(timeParts[0]); const minute = parseInt(timeParts[1]); if (isNaN(day) || isNaN(month) || isNaN(year) || isNaN(hour) || isNaN(minute)) return null; const targetDate = new Date(year, month, day, hour, minute); return targetDate.getTime(); }
function calculateNextRun(schedule) { const now = new Date(); const [hour, minute] = schedule.recurrence.time.split(':').map(Number); let nextRun = new Date(); nextRun.setHours(hour, minute, 0, 0); const type = schedule.recurrence.type; if (type === 'daily') { if (nextRun <= now) nextRun.setDate(nextRun.getDate() + 1); } else if (type === 'every_x_days') { while (nextRun <= now) nextRun.setDate(nextRun.getDate() + schedule.recurrence.interval); } else if (type === 'weekly') { const targetDay = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'].indexOf(schedule.recurrence.dayOfWeek); while (nextRun.getDay() !== targetDay || nextRun <= now) nextRun.setDate(nextRun.getDate() + 1); } return nextRun.getTime(); }

async function isAdmin(userId) {
    return new Promise((resolve) => {
        try {
            if (!fs.existsSync(CONFIG_FILE_PATH)) return resolve(false);
            const config = JSON.parse(fs.readFileSync(CONFIG_FILE_PATH));
            const cleanUserId = userId.split('@')[0];
            const cleanOwnerId = config.owner.split('@')[0];
            if (cleanUserId === cleanOwnerId) return resolve(true);

            db.get('SELECT jid FROM admins WHERE jid = ?', [userId], (err, row) => {
                if (err) {
                    console.error("Error query admin:", err);
                    return resolve(false);
                }
                resolve(!!row);
            });
        } catch (error) {
            console.error(`Gagal memeriksa admin:`, error);
            resolve(false);
        }
    });
}

async function askGemini(prompt) {
    try {
        if (!fs.existsSync(CONFIG_FILE_PATH)) return '❌ File `config.json` tidak ditemukan.';
        const config = JSON.parse(fs.readFileSync(CONFIG_FILE_PATH));
        if (!config.gemini_api_key || config.gemini_api_key === "MASUKKAN_API_KEY_ANDA_DI_SINI") {
            return '❌ API Key Gemini belum diatur di file `config.json`.';
        }
        const genAI = new GoogleGenerativeAI(config.gemini_api_key);
        const model = genAI.getGenerativeModel({ model: "gemini-2.5-pro" });

        const result = await model.generateContent(prompt);
        const response = await result.response;
        return response.text();
    } catch (error) {
        console.error("Error pada Gemini API:", error);
        return 'Maaf, terjadi kesalahan saat menghubungi Gemini. Coba lagi nanti.';
    }
}

// =================================================================
// FUNGSI UTAMA BOT
// =================================================================
async function main() {
    const { state, saveCreds } = await useMultiFileAuthState('auth_info_baileys');
    const { version } = await fetchLatestBaileysVersion();
    const sock = makeWASocket({ version, auth: state, logger: pino({ level: 'silent' }) });

    cron.schedule('* * * * *', () => {
        const now = Date.now();
        db.all('SELECT * FROM schedules WHERE next_run <= ?', [now], (err, rows) => {
            if (err) return console.error("Error mengambil jadwal:", err.message);

            rows.forEach(job => {
                console.log(`[Scheduler] Menjalankan tugas ID: ${job.id}`);
                sock.sendMessage(job.jid, { text: job.message }).catch(e => console.error(`[Scheduler] Gagal mengirim pesan untuk ID ${job.id}:`, e));

                if (job.recurrence_json) {
                    const recurrence = JSON.parse(job.recurrence_json);
                    const nextRun = calculateNextRun({ recurrence });
                    db.run('UPDATE schedules SET next_run = ? WHERE id = ?', [nextRun, job.id]);
                } else {
                    db.run('DELETE FROM schedules WHERE id = ?', [job.id]);
                }
            });
        });
    });

    sock.ev.on('connection.update', (update) => {
        const { connection, lastDisconnect, qr } = update;
        if (qr) {
            console.log("Pindai QR code ini untuk login:");
            qrcode.generate(qr, { small: true });
        }
        if (connection === 'close') {
            const shouldReconnect = (lastDisconnect.error instanceof Boom)?.output?.statusCode !== DisconnectReason.loggedOut;
            if (shouldReconnect) main();
        } else if (connection === 'open') {
            console.log('\n==================================================');
            console.log('           Bot Berhasil Terhubung! ✅');
            console.log('==================================================');
            console.log(`   Author: ${OWNER_NAME}`);
            console.log(`   GitHub: ${GITHUB_LINK}`);
            console.log('==================================================\n');

            try {
                const config = JSON.parse(fs.readFileSync(CONFIG_FILE_PATH));
                if (config.owner) {
                    const startupMessage = `*🤖 Bot Online!*\n\nBot telah berhasil terhubung dan siap digunakan.\n\n_Developed by ${OWNER_NAME}_`;
                    sock.sendMessage(config.owner, { text: startupMessage });
                }
            } catch (e) {
                console.error("Gagal mengirim pesan startup ke owner. Pastikan nomor owner di config.json sudah benar.", e);
            }
        }
    });

    sock.ev.on('creds.update', saveCreds);

    sock.ev.on('group-participants.update', async (event) => {
        const { id, participants, action } = event;
        if (action !== 'add') return;

        db.get('SELECT welcome_message FROM group_settings WHERE jid = ?', [id], async (err, row) => {
            if (err || !row || !row.welcome_message) return;
            
            for (const participant of participants) {
                const welcomeText = row.welcome_message.replace(/@user/g, `@${participant.split('@')[0]}`);
                await sock.sendMessage(id, { text: welcomeText, mentions: [participant] });
            }
        });
    });

    sock.ev.on('messages.upsert', async (m) => {
        const msg = m.messages[0];
        if (!msg.message || msg.key.fromMe) return;
        
        const from = msg.key.remoteJid;
        const sender = msg.key.participant || from;
        const text = (msg.message?.conversation || msg.message?.extendedTextMessage?.text || msg.message?.imageMessage?.caption || msg.message?.videoMessage?.caption || '').trim();
        
        const command = text.toLowerCase().split(' ')[0] || '';
        const args = text.split(' ');
        const isGroup = from.endsWith('@g.us');

        let isSenderGroupAdmin = false;
        if (isGroup) {
            try {
                const groupMetadata = await sock.groupMetadata(from);
                const groupAdmins = groupMetadata.participants.filter(p => p.admin).map(p => p.id);
                isSenderGroupAdmin = groupAdmins.includes(sender);
            } catch (e) {
                console.error("Gagal mendapatkan metadata grup:", e);
            }
        }

        if (!text.startsWith('.')) {
            if (isGroup && !isSenderGroupAdmin) {
                db.get('SELECT antilink FROM group_settings WHERE jid = ? AND antilink = 1', [from], (err, row) => {
                    if (err || !row) return;
                    if (/https?:\/\//.test(text)) {
                        sock.sendMessage(from, { delete: msg.key });
                        sock.sendMessage(from, { text: `Maaf @${sender.split('@')[0]}, link tidak diizinkan di grup ini.`, mentions: [sender] });
                    }
                });
                db.all('SELECT word FROM badwords WHERE jid = ?', [from], (err, rows) => {
                    if (err || rows.length === 0) return;
                    const foundBadword = rows.find(row => new RegExp(`\\b${row.word}\\b`, 'i').test(text));
                    if (foundBadword) {
                        sock.sendMessage(from, { delete: msg.key });
                    }
                });
            }
            db.all('SELECT keyword, content_type, content, file_path FROM filters WHERE jid = ?', [from], (err, rows) => {
                if (err) return console.error(err);
                for (const row of rows) {
                    const regex = new RegExp(`\\b${row.keyword}\\b`, 'i');
                    if (regex.test(text)) {
                        if (row.content_type === 'text') {
                            sock.sendMessage(from, { text: row.content }, { quoted: msg });
                        } else if (row.file_path && fs.existsSync(row.file_path)) {
                            const mediaMessage = JSON.parse(row.content);
                            const mediaType = Object.keys(mediaMessage)[0];
                            const mediaKey = mediaType.replace('Message', '');
                            sock.sendMessage(from, { [mediaKey]: { url: row.file_path }, mimetype: mediaMessage[mediaType].mimetype, caption: mediaMessage[mediaType].caption || '' }, { quoted: msg });
                        }
                        return;
                    }
                }
            });
            return;
        }
        
        if (command === '.menu') {
            const menuText = `*🤖 MENU PERINTAH BOT*

*✨ AI (GEMINI)*
• *.gemini <pertanyaan>*
  _Bisa juga balas pesan dengan .gemini_

*🎨 HIBURAN*
• *.sticker*
  _Balas gambar/video/gif untuk dijadikan stiker._

*📝 CATATAN & FILTER*
• *.save <nama> [teks]*
• *#<nama>*
• *.notes*
• *.delete <nama>* _(Admin Bot)_
• *.addfilter <keyword> [jawaban]* _(Admin Bot)_
• *.delfilter <keyword>* _(Admin Bot)_
• *.filters*

*⏰ PENJADWALAN*
• *.schedule <waktu> <pesan>*
• *.listjobs*
• *.deletejob <id>*

*🛡️ ADMIN GRUP*
• *.setwelcome <pesan>*
• *.antilink <on/off>*
• *.warn @user/reply*
• *.warnings @user/reply*
• *.resetwarn @user/reply*
• *.addbadword <kata>*
• *.delbadword <kata>*
• *.badwords*

*👑 ADMIN BOT*
• *.credit / .owner*
• *.addadmin @user/reply*
• *.deladmin @user/reply*
• *.listadmins*

-----------------------------------
_Bot by: ${OWNER_NAME}_
`;
            await sock.sendMessage(from, { text: menuText }, { quoted: msg });
        }

        else if (command === '.credit' || command === '.owner') {
            const creditText = `*🤖 Bot Credit 🤖*\n\nBot ini dikembangkan dengan penuh ❤️ oleh:\n*${OWNER_NAME}*\n\nGitHub: ${GITHUB_LINK}`;
            await sock.sendMessage(from, { text: creditText }, { quoted: msg });
        }
        
        else if (command === '.sticker' || command === '.gemini') {
            if (!await isAdmin(sender)) {
                const now = Date.now();
                if (!commandCooldowns.has(sender)) {
                    commandCooldowns.set(sender, new Map());
                }
                const userCooldowns = commandCooldowns.get(sender);
                const lastUsage = userCooldowns.get(command);
                if (lastUsage) {
                    const elapsed = now - lastUsage;
                    const cooldownMs = COOLDOWN_SECONDS * 1000;
                    if (elapsed < cooldownMs) {
                        const timeLeft = Math.ceil((cooldownMs - elapsed) / 1000);
                        await sock.sendMessage(from, { react: { text: '⏱️', key: msg.key } });
                        await sock.sendMessage(from, { text: `Harap tunggu *${timeLeft} detik* sebelum menggunakan perintah ini lagi.` }, { quoted: msg });
                        return;
                    }
                }
                userCooldowns.set(command, now);
            }

            if (command === '.sticker') {
                const quotedMsg = msg.message?.extendedTextMessage?.contextInfo?.quotedMessage;
                if (!quotedMsg) return sock.sendMessage(from, { text: 'Balas gambar atau video/GIF dengan perintah `.sticker`' }, { quoted: msg });
                const mediaType = Object.keys(quotedMsg)[0];
                if (mediaType === 'imageMessage' || mediaType === 'videoMessage') {
                    await sock.sendMessage(from, { react: { text: '⚙️', key: msg.key } });
                    try {
                        const stream = await downloadContentFromMessage(quotedMsg[mediaType], mediaType.replace('Message', ''));
                        let buffer = Buffer.from([]);
                        for await (const chunk of stream) { buffer = Buffer.concat([buffer, chunk]); }
                        if (mediaType === 'imageMessage') {
                            await sock.sendMessage(from, { sticker: buffer });
                            await sock.sendMessage(from, { react: { text: '✅', key: msg.key } });
                        } else if (mediaType === 'videoMessage') {
                            const timestamp = Date.now();
                            const inputFile = path.join(STICKER_TMP_DIR, `${timestamp}.mp4`);
                            const outputFile = path.join(STICKER_TMP_DIR, `${timestamp}.webp`);
                            fs.writeFileSync(inputFile, buffer);
                            ffmpeg(inputFile)
                                .outputOptions(['-vcodec', 'libwebp', '-vf', "scale=512:512:force_original_aspect_ratio=decrease,fps=15,pad=512:512:-1:-1:color=white@0.0", '-loop', '0', '-ss', '00:00:00.0', '-t', '00:00:06.0', '-preset', 'default', '-an', '-vsync', '0', '-q:v', '60'])
                                .toFormat('webp')
                                .save(outputFile)
                                .on('start', (commandLine) => console.log('FFmpeg command: ' + commandLine))
                                .on('end', async () => {
                                    await sock.sendMessage(from, { sticker: { url: outputFile } });
                                    await sock.sendMessage(from, { react: { text: '✅', key: msg.key } });
                                    fs.unlinkSync(inputFile);
                                    fs.unlinkSync(outputFile);
                                })
                                .on('error', async (err) => {
                                    console.error("Error FFMPEG:", err);
                                    await sock.sendMessage(from, { text: 'Gagal membuat stiker bergerak.' }, { quoted: msg });
                                    await sock.sendMessage(from, { react: { text: '❌', key: msg.key } });
                                    fs.unlinkSync(inputFile);
                                    if (fs.existsSync(outputFile)) fs.unlinkSync(outputFile);
                                });
                        }
                    } catch (error) {
                        console.error("Error membuat stiker:", error);
                        await sock.sendMessage(from, { text: 'Terjadi kesalahan saat mengunduh media.' }, { quoted: msg });
                        await sock.sendMessage(from, { react: { text: '❌', key: msg.key } });
                    }
                } else {
                    await sock.sendMessage(from, { text: 'Tipe media tidak didukung. Balas gambar atau video/GIF.' }, { quoted: msg });
                }
            } 
            else if (command === '.gemini') {
                const quotedMsg = msg.message?.extendedTextMessage?.contextInfo?.quotedMessage;
                const instruction = args.slice(1).join(' ');
                let prompt = '';
                if (quotedMsg) {
                    const repliedText = quotedMsg.conversation || quotedMsg.extendedTextMessage?.text || '';
                    if (instruction) { prompt = `${instruction}:\n\n"${repliedText}"`; } else { prompt = repliedText; }
                } else {
                    prompt = instruction;
                }
                if (!prompt) return sock.sendMessage(from, { text: 'Format salah. Gunakan `.gemini <pertanyaan>` atau balas pesan.' }, { quoted: msg });
                
                await sock.sendMessage(from, { react: { text: '🤔', key: msg.key } });
                const result = await askGemini(prompt);
                await sock.sendMessage(from, { text: result }, { quoted: msg });
                await sock.sendMessage(from, { react: { text: '✅', key: msg.key } });
            }
        }
        
        else if (command === '.save') {
            if (args.length < 2) return sock.sendMessage(from, { text: '❌ Format salah!\n\nGunakan: `.save <nama> [teks]`' }, { quoted: msg });
            
            const noteName = args[1].toLowerCase().trim();
            const quotedMsg = msg.message?.extendedTextMessage?.contextInfo?.quotedMessage;
            const textContent = args.slice(2).join(' ');

            if (quotedMsg) {
                const mediaType = Object.keys(quotedMsg)[0];
                if (['imageMessage', 'videoMessage', 'documentMessage', 'stickerMessage'].includes(mediaType)) {
                    try {
                        const stream = await downloadContentFromMessage(quotedMsg[mediaType], mediaType.replace('Message', ''));
                        const filePath = path.join(MEDIA_DIR, `${noteName}_${Date.now()}`);
                        let buffer = [];
                        for await (const chunk of stream) { buffer.push(chunk); }
                        fs.writeFileSync(filePath, Buffer.concat(buffer));
                        
                        const contentJson = JSON.stringify(quotedMsg);
                        db.run(`INSERT INTO notes (jid, name, content_type, content, file_path) VALUES (?, ?, ?, ?, ?) ON CONFLICT(jid, name) DO UPDATE SET content_type='media', content=?, file_path=?`,
                            [from, noteName, 'media', contentJson, filePath, contentJson, filePath],
                            async (err) => {
                                if (err) {
                                    console.error("Gagal menyimpan catatan media:", err.message);
                                    return sock.sendMessage(from, { text: '❌ Gagal menyimpan catatan ke database.' }, { quoted: msg });
                                }
                                await sock.sendMessage(from, { text: `✅ Catatan media *${noteName}* berhasil disimpan!` }, { quoted: msg });
                            });
                        return;
                    } catch (e) {
                        console.error("Gagal download media untuk .save:", e);
                        return sock.sendMessage(from, { text: '❌ Gagal mengunduh media yang dibalas.' }, { quoted: msg });
                    }
                }
            }
            
            if (!textContent) return sock.sendMessage(from, { text: '❌ Tidak ada teks atau media yang dibalas untuk disimpan.' }, { quoted: msg });
            
            db.run(`INSERT INTO notes (jid, name, content_type, content, file_path) VALUES (?, ?, ?, ?, NULL) ON CONFLICT(jid, name) DO UPDATE SET content_type='text', content=?, file_path=NULL`,
                [from, noteName, 'text', textContent, textContent],
                async (err) => {
                    if (err) {
                        console.error("Gagal menyimpan catatan teks:", err.message);
                        return sock.sendMessage(from, { text: '❌ Gagal menyimpan catatan ke database.' }, { quoted: msg });
                    }
                    await sock.sendMessage(from, { text: `✅ Catatan *${noteName}* berhasil disimpan!` }, { quoted: msg });
                });
        }

        else if (text.startsWith('#')) {
            const noteName = text.substring(1).toLowerCase().trim();
            db.get('SELECT content_type, content, file_path FROM notes WHERE jid = ? AND name = ?', [from, noteName], async (err, row) => {
                if (err || !row) return;
                if (row.content_type === 'text') {
                    await sock.sendMessage(from, { text: row.content });
                } else if (row.file_path && fs.existsSync(row.file_path)) {
                    try {
                        const mediaMessage = JSON.parse(row.content);
                        const mediaType = Object.keys(mediaMessage)[0];
                        const mediaKey = mediaType.replace('Message', '');
                        await sock.sendMessage(from, { [mediaKey]: { url: row.file_path }, mimetype: mediaMessage[mediaType].mimetype, caption: mediaMessage[mediaType].caption || '' }, { quoted: msg });
                    } catch (e) {
                        await sock.sendMessage(from, { text: "Gagal mengirim file catatan." });
                    }
                }
            });
        }

        else if (command === '.notes') {
            db.all('SELECT name FROM notes WHERE jid = ?', [from], async (err, rows) => {
                if (err) return console.error(err);
                if (rows.length === 0) return sock.sendMessage(from, { text: 'Belum ada catatan yang tersimpan di chat ini.' }, { quoted: msg });
                let responseText = '📋 *Daftar Catatan Tersimpan:*\n\n';
                rows.forEach(row => { responseText += `- #${row.name}\n`; });
                responseText += '\nKetik `#<nama>` untuk melihat isinya.';
                await sock.sendMessage(from, { text: responseText }, { quoted: msg });
            });
        }
        
        else if (command === '.delete') {
            if (!await isAdmin(sender)) return sock.sendMessage(from, { text: '❌ Perintah ini hanya untuk admin bot.' }, { quoted: msg });
            if (args.length < 2) return sock.sendMessage(from, { text: '❌ Format salah! Gunakan: `.delete <nama>`' }, { quoted: msg });
            
            const noteName = args[1].toLowerCase().trim();
            db.get('SELECT file_path FROM notes WHERE jid = ? AND name = ?', [from, noteName], (err, row) => {
                if (err || !row) return sock.sendMessage(from, { text: `❌ Catatan *${noteName}* tidak ditemukan.` }, { quoted: msg });
                if (row.file_path && fs.existsSync(row.file_path)) {
                    fs.unlinkSync(row.file_path);
                }
                db.run('DELETE FROM notes WHERE jid = ? AND name = ?', [from, noteName], async (delErr) => {
                    if (delErr) return sock.sendMessage(from, { text: 'Gagal menghapus catatan dari database.' }, { quoted: msg });
                    await sock.sendMessage(from, { text: `🗑️ Catatan *${noteName}* berhasil dihapus.` }, { quoted: msg });
                });
            });
        }
        
        else if (command === '.addfilter') {
            if (!await isAdmin(sender)) return sock.sendMessage(from, { text: '❌ Perintah ini hanya untuk admin bot.' }, { quoted: msg });
            if (args.length < 2) return sock.sendMessage(from, { text: '❌ Format salah!\n\nGunakan: `.addfilter <keyword> [jawaban]`' }, { quoted: msg });
            
            const keyword = args[1].toLowerCase().trim();
            const quotedMsg = msg.message?.extendedTextMessage?.contextInfo?.quotedMessage;
            const textContent = args.slice(2).join(' ');

            if (quotedMsg) {
                const mediaType = Object.keys(quotedMsg)[0];
                if (['imageMessage', 'videoMessage', 'documentMessage', 'stickerMessage'].includes(mediaType)) {
                    const stream = await downloadContentFromMessage(quotedMsg[mediaType], mediaType.replace('Message', ''));
                    const filePath = path.join(MEDIA_DIR, `${keyword}_${Date.now()}`);
                    let buffer = [];
                    for await (const chunk of stream) { buffer.push(chunk); }
                    fs.writeFileSync(filePath, Buffer.concat(buffer));
                    
                    const contentJson = JSON.stringify(quotedMsg);
                    db.run(`INSERT INTO filters (jid, keyword, content_type, content, file_path) VALUES (?, ?, ?, ?, ?) ON CONFLICT(jid, keyword) DO UPDATE SET content_type='media', content=?, file_path=?`,
                        [from, keyword, 'media', contentJson, filePath, contentJson, filePath],
                        async (err) => {
                            if (err) return sock.sendMessage(from, { text: '❌ Gagal menyimpan filter ke database.' }, { quoted: msg });
                            await sock.sendMessage(from, { text: `✅ Filter media untuk keyword *'${keyword}'* berhasil ditambahkan.` }, { quoted: msg });
                        });
                    return;
                }
            }

            if (!textContent) return sock.sendMessage(from, { text: '❌ Tidak ada teks atau media yang dibalas untuk dijadikan filter.' }, { quoted: msg });
            
            db.run(`INSERT INTO filters (jid, keyword, content_type, content, file_path) VALUES (?, ?, ?, ?, NULL) ON CONFLICT(jid, keyword) DO UPDATE SET content_type='text', content=?, file_path=NULL`,
                [from, keyword, 'text', textContent, textContent],
                async (err) => {
                    if (err) return sock.sendMessage(from, { text: '❌ Gagal menyimpan filter ke database.' }, { quoted: msg });
                    await sock.sendMessage(from, { text: `✅ Filter untuk keyword *'${keyword}'* berhasil ditambahkan.` }, { quoted: msg });
                });
        }
        
        else if (command === '.delfilter') {
            if (!await isAdmin(sender)) return sock.sendMessage(from, { text: '❌ Perintah ini hanya untuk admin bot.' }, { quoted: msg });
            if (args.length < 2) return sock.sendMessage(from, { text: '❌ Format salah!\n\nGunakan: `.delfilter <keyword>`' }, { quoted: msg });
            
            const keyword = args[1].toLowerCase().trim();
            db.get('SELECT file_path FROM filters WHERE jid = ? AND keyword = ?', [from, keyword], (err, row) => {
                if (err || !row) return sock.sendMessage(from, { text: `❌ Filter untuk keyword *'${keyword}'* tidak ditemukan.` }, { quoted: msg });
                if (row.file_path && fs.existsSync(row.file_path)) {
                    fs.unlinkSync(row.file_path);
                }
                db.run('DELETE FROM filters WHERE jid = ? AND keyword = ?', [from, keyword], async (delErr) => {
                    if (delErr) return sock.sendMessage(from, { text: 'Gagal menghapus filter dari database.' }, { quoted: msg });
                    await sock.sendMessage(from, { text: `🗑️ Filter untuk keyword *'${keyword}'* berhasil dihapus.` }, { quoted: msg });
                });
            });
        }
        
        else if (command === '.filters') {
            db.all('SELECT keyword FROM filters WHERE jid = ?', [from], async (err, rows) => {
                if (err) return console.error(err);
                if (rows.length === 0) return sock.sendMessage(from, { text: 'Tidak ada filter yang aktif di chat ini.' }, { quoted: msg });
                let responseText = '💬 *Daftar Filter Aktif:*\n\n';
                rows.forEach(row => { responseText += `• \`${row.keyword}\`\n`; });
                await sock.sendMessage(from, { text: responseText }, { quoted: msg });
            });
        }
        
        else if (command === '.schedule') {
            let newSchedule = { id: `sch-${Date.now()}`, jid: from, author: sender };
            let messageContent = '';
            let isRecurring = false;
            let recurrenceJson = null;

            if (argsLower[1] === 'everyday' && args.length >= 4) { isRecurring = true; newSchedule.recurrence = { type: 'daily', time: argsLower[2] }; messageContent = args.slice(3).join(' '); }
            else if (argsLower[1] === 'every' && argsLower[3] === 'days' && args.length >= 6) { isRecurring = true; newSchedule.recurrence = { type: 'every_x_days', interval: parseInt(argsLower[2]), time: argsLower[4] }; messageContent = args.slice(5).join(' '); }
            else if (argsLower[1] === 'every' && ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'].includes(argsLower[2]) && args.length >= 5) { isRecurring = true; newSchedule.recurrence = { type: 'weekly', dayOfWeek: argsLower[2], time: argsLower[3] }; messageContent = args.slice(4).join(' '); }
            
            if (isRecurring) { newSchedule.message = messageContent; newSchedule.nextRun = calculateNextRun(newSchedule); recurrenceJson = JSON.stringify(newSchedule.recurrence); }
            else { const relativeTimeMs = parseRelativeTimeToMs(argsLower[1]); if (relativeTimeMs && args.length >= 3) { newSchedule.nextRun = Date.now() + relativeTimeMs; newSchedule.message = args.slice(2).join(' '); } else if (args.length >= 4) { const customTimeMs = parseCustomDateTimeToMs(args[1], args[2]); if (customTimeMs) { newSchedule.nextRun = customTimeMs; newSchedule.message = args.slice(3).join(' '); } } }
            
            if (!newSchedule.nextRun || !newSchedule.message) return sock.sendMessage(from, { text: 'Format perintah tidak dikenali. Ketik *.menu* untuk melihat bantuan.' }, { quoted: msg });
            if (newSchedule.nextRun <= Date.now()) return sock.sendMessage(from, { text: '❌ Tidak dapat menjadwalkan tugas di waktu yang sudah berlalu.' }, { quoted: msg });
            
            db.run('INSERT INTO schedules (id, jid, author, message, next_run, recurrence_json) VALUES (?, ?, ?, ?, ?, ?)',
                [newSchedule.id, newSchedule.jid, newSchedule.author, newSchedule.message, newSchedule.nextRun, recurrenceJson],
                async function(err) {
                    if (err) {
                        console.error("Gagal menyimpan jadwal ke DB:", err.message);
                        return sock.sendMessage(from, { text: '❌ Terjadi kesalahan saat menyimpan jadwal.' }, { quoted: msg });
                    }
                    const targetDate = new Date(newSchedule.nextRun).toLocaleString('id-ID', { timeZone: 'Asia/Jakarta', dateStyle: 'full', timeStyle: 'short' });
                    await sock.sendMessage(from, { text: `✅ Tugas berhasil dijadwalkan!\n\n*ID:* \`${newSchedule.id}\`\n*Jadwal Berikutnya:* ${targetDate}` }, { quoted: msg });
                }
            );
        }

        else if (command === '.listjobs') {
            db.all('SELECT * FROM schedules WHERE jid = ?', [from], async (err, rows) => {
                if (err) return console.error(err);
                if (rows.length === 0) return sock.sendMessage(from, { text: 'Tidak ada pesan yang dijadwalkan di chat ini.' }, { quoted: msg });
                let responseText = '🗓️ *Daftar Tugas Terjadwal:*\n\n';
                rows.forEach(job => { const jobDate = new Date(job.next_run).toLocaleString('id-ID', { timeZone: 'Asia/Jakarta', day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' }); const recurrenceInfo = job.recurrence_json ? ` (Berulang)` : ''; responseText += `*ID:* \`${job.id}\`${recurrenceInfo}\n*Berikutnya:* ${jobDate}\n*Pesan:* "${job.message.substring(0, 30)}..."\n\n`; });
                await sock.sendMessage(from, { text: responseText }, { quoted: msg });
            });
        }
        
        else if (command === '.deletejob') {
            if (!await isAdmin(sender) && !isSenderGroupAdmin) return sock.sendMessage(from, { text: '❌ Anda harus menjadi admin bot atau admin grup.' }, { quoted: msg });
            if (args.length < 2) return sock.sendMessage(from, { text: '❌ Format salah! Gunakan: `.deletejob <ID>`' }, { quoted: msg });
            const jobId = args[1];
            
            db.get('SELECT author FROM schedules WHERE id = ? AND jid = ?', [jobId, from], async (err, row) => {
                if (err || !row) return sock.sendMessage(from, { text: `❌ Tugas dengan ID \`${jobId}\` tidak ditemukan.` }, { quoted: msg });
                if (row.author !== sender && !await isAdmin(sender) && !isSenderGroupAdmin) return sock.sendMessage(from, { text: '❌ Anda bukan pembuat tugas ini atau admin.' }, { quoted: msg });
                
                db.run('DELETE FROM schedules WHERE id = ?', [jobId], async (delErr) => {
                    if (delErr) return sock.sendMessage(from, { text: 'Gagal menghapus tugas.' }, { quoted: msg });
                    await sock.sendMessage(from, { text: `🗑️ Tugas dengan ID \`${jobId}\` berhasil dihapus.` }, { quoted: msg });
                });
            });
        }

        else if (command === '.addadmin') {
            if (sender !== config.owner) return sock.sendMessage(from, { text: '❌ Perintah ini hanya untuk owner bot.' }, { quoted: msg });
            let targetJid;
            const mentionedJids = msg.message?.extendedTextMessage?.contextInfo?.mentionedJid || [];
            if (mentionedJids.length > 0) {
                targetJid = mentionedJids[0];
            } else if (msg.message?.extendedTextMessage?.contextInfo?.participant) {
                targetJid = msg.message.extendedTextMessage.contextInfo.participant;
            }
            if (!targetJid) return sock.sendMessage(from, { text: 'Tag pengguna atau balas pesannya untuk dijadikan admin.' }, { quoted: msg });
            if (await isAdmin(targetJid)) return sock.sendMessage(from, { text: 'Pengguna tersebut sudah menjadi admin.' }, { quoted: msg });
            
            db.run('INSERT OR IGNORE INTO admins (jid) VALUES (?)', [targetJid], async (err) => {
                if (err) return sock.sendMessage(from, { text: 'Gagal menambahkan admin.'}, { quoted: msg });
                await sock.sendMessage(from, { text: `✅ @${targetJid.split('@')[0]} berhasil ditambahkan sebagai admin bot.`, mentions: [targetJid] }, { quoted: msg });
            });
        }

        else if (command === '.deladmin') {
            if (sender !== config.owner) return sock.sendMessage(from, { text: '❌ Perintah ini hanya untuk owner bot.' }, { quoted: msg });
            let targetJid;
            const mentionedJids = msg.message?.extendedTextMessage?.contextInfo?.mentionedJid || [];
            if (mentionedJids.length > 0) {
                targetJid = mentionedJids[0];
            } else if (msg.message?.extendedTextMessage?.contextInfo?.participant) {
                targetJid = msg.message.extendedTextMessage.contextInfo.participant;
            }
            if (!targetJid) return sock.sendMessage(from, { text: 'Tag admin atau balas pesannya untuk dihapus.' }, { quoted: msg });
            if (targetJid.split('@')[0] === config.owner.split('@')[0]) return sock.sendMessage(from, { text: '❌ Owner tidak bisa dihapus.' }, { quoted: msg });
            
            db.run('DELETE FROM admins WHERE jid = ?', [targetJid], async function(err) {
                if (err) return sock.sendMessage(from, { text: 'Gagal menghapus admin.' }, { quoted: msg });
                if (this.changes === 0) return sock.sendMessage(from, { text: 'Pengguna tersebut bukan admin.' }, { quoted: msg });
                await sock.sendMessage(from, { text: `✅ @${targetJid.split('@')[0]} berhasil dihapus dari daftar admin.`, mentions: [targetJid] }, { quoted: msg });
            });
        }

        else if (command === '.listadmins') {
            db.all('SELECT jid FROM admins', [], async (err, rows) => {
                if (err) return console.error(err);
                const config = JSON.parse(fs.readFileSync(CONFIG_FILE_PATH));
                let responseText = `👑 *DAFTAR ADMIN BOT*\n\n*Owner:*\n• @${config.owner.split('@')[0]}\n\n`;
                let mentions = [config.owner];
                if (rows.length > 0) {
                    responseText += `*Admin:*\n`;
                    rows.forEach(row => { responseText += `• @${row.jid.split('@')[0]}\n`; mentions.push(row.jid); });
                } else {
                    responseText += `*Admin:*\nTidak ada.`;
                }
                await sock.sendMessage(from, { text: responseText, mentions: mentions }, { quoted: msg });
            });
        }
        
        else if (['.setwelcome', '.antilink', '.warn', '.warnings', '.resetwarn', '.addbadword', '.delbadword', '.badwords'].includes(command)) {
            if (!isGroup) return sock.sendMessage(from, { text: 'Perintah ini hanya bisa digunakan di dalam grup.' }, { quoted: msg });
            if (!isSenderGroupAdmin) return sock.sendMessage(from, { text: '❌ Perintah ini hanya untuk admin grup.' }, { quoted: msg });

            if (command === '.setwelcome') {
                const message = args.slice(1).join(' ');
                if (!message) return sock.sendMessage(from, { text: 'Format salah. Gunakan `.setwelcome <pesan>`\nContoh: `.setwelcome Selamat datang @user di grup kami!`' }, { quoted: msg });
                db.run(`INSERT INTO group_settings (jid, welcome_message) VALUES (?, ?) ON CONFLICT(jid) DO UPDATE SET welcome_message = ?`, [from, message, message], async (err) => {
                    if (err) return sock.sendMessage(from, { text: 'Gagal mengatur pesan selamat datang.' }, { quoted: msg });
                    await sock.sendMessage(from, { text: '✅ Pesan selamat datang berhasil diatur.' }, { quoted: msg });
                });
            }
            else if (command === '.antilink') {
                const option = args[1]?.toLowerCase();
                if (option !== 'on' && option !== 'off') return sock.sendMessage(from, { text: 'Format salah. Gunakan `.antilink <on/off>`' }, { quoted: msg });
                const antilinkStatus = option === 'on' ? 1 : 0;
                db.run(`INSERT INTO group_settings (jid, antilink) VALUES (?, ?) ON CONFLICT(jid) DO UPDATE SET antilink = ?`, [from, antilinkStatus, antilinkStatus], async (err) => {
                    if (err) return sock.sendMessage(from, { text: 'Gagal mengubah pengaturan anti-link.' }, { quoted: msg });
                    await sock.sendMessage(from, { text: `✅ Fitur anti-link telah diatur ke *${option}*.` }, { quoted: msg });
                });
            }
            else if (command === '.warn') {
                let targetJid;
                const mentionedJids = msg.message?.extendedTextMessage?.contextInfo?.mentionedJid || [];
                if (mentionedJids.length > 0) { targetJid = mentionedJids[0]; }
                else if (msg.message?.extendedTextMessage?.contextInfo?.participant) { targetJid = msg.message.extendedTextMessage.contextInfo.participant; }
                if (!targetJid) return sock.sendMessage(from, { text: 'Tag pengguna atau balas pesannya untuk diberi peringatan.' }, { quoted: msg });
                
                db.run(`INSERT INTO warnings (group_jid, user_jid, count) VALUES (?, ?, 1) ON CONFLICT(group_jid, user_jid) DO UPDATE SET count = count + 1`, [from, targetJid], function(err) {
                    if (err) return sock.sendMessage(from, { text: 'Gagal memberi peringatan.' }, { quoted: msg });
                    db.get(`SELECT count FROM warnings WHERE group_jid = ? AND user_jid = ?`, [from, targetJid], async (getErr, row) => {
                        if (getErr) return;
                        await sock.sendMessage(from, { text: `⚠️ @${targetJid.split('@')[0]} telah diberi peringatan.\nTotal peringatan: ${row.count}/3`, mentions: [targetJid] });
                        if (row.count >= 3) {
                            await sock.groupParticipantsUpdate(from, [targetJid], 'remove');
                            await sock.sendMessage(from, { text: `Karena telah mencapai 3 peringatan, @${targetJid.split('@')[0]} dikeluarkan dari grup.`, mentions: [targetJid] });
                            db.run(`DELETE FROM warnings WHERE group_jid = ? AND user_jid = ?`, [from, targetJid]);
                        }
                    });
                });
            }
            else if (command === '.warnings') {
                let targetJid;
                const mentionedJids = msg.message?.extendedTextMessage?.contextInfo?.mentionedJid || [];
                if (mentionedJids.length > 0) { targetJid = mentionedJids[0]; }
                else if (msg.message?.extendedTextMessage?.contextInfo?.participant) { targetJid = msg.message.extendedTextMessage.contextInfo.participant; }
                if (!targetJid) return sock.sendMessage(from, { text: 'Tag pengguna atau balas pesannya untuk dicek.' }, { quoted: msg });
                
                db.get(`SELECT count FROM warnings WHERE group_jid = ? AND user_jid = ?`, [from, targetJid], async (err, row) => {
                    const warnCount = row ? row.count : 0;
                    await sock.sendMessage(from, { text: `Jumlah peringatan untuk @${targetJid.split('@')[0]}: *${warnCount}/3*`, mentions: [targetJid] });
                });
            }
            else if (command === '.resetwarn') {
                let targetJid;
                const mentionedJids = msg.message?.extendedTextMessage?.contextInfo?.mentionedJid || [];
                if (mentionedJids.length > 0) { targetJid = mentionedJids[0]; }
                else if (msg.message?.extendedTextMessage?.contextInfo?.participant) { targetJid = msg.message.extendedTextMessage.contextInfo.participant; }
                if (!targetJid) return sock.sendMessage(from, { text: 'Tag pengguna atau balas pesannya untuk direset.' }, { quoted: msg });

                db.run(`DELETE FROM warnings WHERE group_jid = ? AND user_jid = ?`, [from, targetJid], async (err) => {
                    if (err) return sock.sendMessage(from, { text: 'Gagal mereset peringatan.' }, { quoted: msg });
                    await sock.sendMessage(from, { text: `✅ Peringatan untuk @${targetJid.split('@')[0]} telah direset.`, mentions: [targetJid] });
                });
            }
            else if (command === '.addbadword') {
                const word = args[1]?.toLowerCase();
                if (!word) return sock.sendMessage(from, { text: 'Format salah. Gunakan `.addbadword <kata>`' }, { quoted: msg });

                db.run(`INSERT OR IGNORE INTO badwords (jid, word) VALUES (?, ?)`, [from, word], async (err) => {
                    if (err) return sock.sendMessage(from, { text: 'Gagal menambahkan kata.' }, { quoted: msg });
                    await sock.sendMessage(from, { text: `✅ Kata *'${word}'* telah ditambahkan ke daftar terlarang.` }, { quoted: msg });
                });
            }
            else if (command === '.delbadword') {
                const word = args[1]?.toLowerCase();
                if (!word) return sock.sendMessage(from, { text: 'Format salah. Gunakan `.delbadword <kata>`' }, { quoted: msg });

                db.run(`DELETE FROM badwords WHERE jid = ? AND word = ?`, [from, word], async function(err) {
                    if (err) return sock.sendMessage(from, { text: 'Gagal menghapus kata.' }, { quoted: msg });
                    if (this.changes === 0) return sock.sendMessage(from, { text: `Kata *'${word}'* tidak ditemukan.` }, { quoted: msg });
                    await sock.sendMessage(from, { text: `✅ Kata *'${word}'* telah dihapus dari daftar terlarang.` }, { quoted: msg });
                });
            }
            else if (command === '.badwords') {
                db.all('SELECT word FROM badwords WHERE jid = ?', [from], async (err, rows) => {
                    if (err) return console.error(err);
                    if (rows.length === 0) return sock.sendMessage(from, { text: 'Tidak ada kata terlarang yang diatur di grup ini.' }, { quoted: msg });
                    let responseText = '🚫 *Daftar Kata Terlarang:*\n\n';
                    rows.forEach(row => { responseText += `• ${row.word}\n`; });
                    await sock.sendMessage(from, { text: responseText }, { quoted: msg });
                });
            }
        }
    });
}

main();
