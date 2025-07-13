const { default: makeWASocket, useMultiFileAuthState, DisconnectReason, fetchLatestBaileysVersion } = require('@whiskeysockets/baileys');
const pino = require('pino');
const { Boom } = require('@hapi/boom');
const fs = require('fs');
const path = require('path');
const cron = require('node-cron');
const qrcode = require('qrcode-terminal');
const sqlite3 = require('sqlite3').verbose();
const { Collection } = require('@discordjs/collection');
const axios = require('axios');
const loadCommands = require('./utils/command-handler');
const { OWNER_NAME, DB_FILE_PATH, CONFIG_FILE_PATH, MEDIA_DIR, STICKER_TMP_DIR, calculateNextRun } = require('./utils/helpers');
const handleNonCommand = require('./utils/non-command-handler');

// Pastikan direktori ada
if (!fs.existsSync(MEDIA_DIR)) fs.mkdirSync(MEDIA_DIR);
if (!fs.existsSync(STICKER_TMP_DIR)) fs.mkdirSync(STICKER_TMP_DIR);

// Muat Konfigurasi
let config = {};
try {
    if (!fs.existsSync(CONFIG_FILE_PATH)) {
        console.log("Membuat file config.json contoh...");
        fs.writeFileSync(CONFIG_FILE_PATH, JSON.stringify({
            owner: "628xxxxxxxxxx@s.whatsapp.net",
            gemini_api_key: "MASUKKAN_API_KEY_ANDA_DI_SINI"
        }, null, 2));
        console.log("File config.json telah dibuat. Harap isi nomor Owner dan API key Gemini Anda.");
        process.exit(1);
    }
    config = JSON.parse(fs.readFileSync(CONFIG_FILE_PATH));
} catch (e) {
    console.error("Gagal memuat atau membuat config.json:", e);
    process.exit(1);
}

// Inisialisasi Database
const db = new sqlite3.Database(DB_FILE_PATH, (err) => {
    if (err) {
        console.error('Gagal terhubung ke database SQLite:', err.message);
        process.exit(1);
    } else {
        console.log('Terhubung ke database SQLite.');
    }
});

// Membuat Tabel Database Jika Belum Ada
db.serialize(() => {
    console.log('Memeriksa dan membuat tabel database jika diperlukan...');
    db.run(`CREATE TABLE IF NOT EXISTS admins (jid TEXT PRIMARY KEY)`);
    db.run(`CREATE TABLE IF NOT EXISTS notes (id INTEGER PRIMARY KEY AUTOINCREMENT, jid TEXT NOT NULL, name TEXT NOT NULL, content_type TEXT NOT NULL, content TEXT NOT NULL, file_path TEXT, UNIQUE(jid, name))`);
    db.run(`CREATE TABLE IF NOT EXISTS filters (id INTEGER PRIMARY KEY AUTOINCREMENT, jid TEXT NOT NULL, keyword TEXT NOT NULL, content_type TEXT NOT NULL, content TEXT NOT NULL, file_path TEXT, UNIQUE(jid, keyword))`);
    db.run(`CREATE TABLE IF NOT EXISTS schedules (id TEXT PRIMARY KEY, jid TEXT NOT NULL, author TEXT NOT NULL, message TEXT NOT NULL, next_run INTEGER NOT NULL, recurrence_json TEXT)`);
    db.run(`CREATE TABLE IF NOT EXISTS group_settings (jid TEXT PRIMARY KEY, welcome_message TEXT, antilink BOOLEAN NOT NULL DEFAULT 0)`);
    db.run(`CREATE TABLE IF NOT EXISTS warnings (id INTEGER PRIMARY KEY AUTOINCREMENT, group_jid TEXT NOT NULL, user_jid TEXT NOT NULL, count INTEGER NOT NULL DEFAULT 1, UNIQUE(group_jid, user_jid))`);
    db.run(`CREATE TABLE IF NOT EXISTS badwords (id INTEGER PRIMARY KEY AUTOINCREMENT, jid TEXT NOT NULL, word TEXT NOT NULL, UNIQUE(jid, word))`);
    db.run(`CREATE TABLE IF NOT EXISTS racks (id INTEGER PRIMARY KEY AUTOINCREMENT, group_jid TEXT NOT NULL, rak_name TEXT NOT NULL, assigned_to TEXT NOT NULL, status TEXT NOT NULL DEFAULT 'BELUM SELESAI', completed_by TEXT, completed_at TEXT, UNIQUE(group_jid, rak_name))`);
    db.run(`CREATE TABLE IF NOT EXISTS prayer_reminders (group_jid TEXT PRIMARY KEY, city_id TEXT NOT NULL, city_name TEXT NOT NULL, is_active BOOLEAN NOT NULL DEFAULT 1)`);
    console.log('Pemeriksaan tabel selesai.');
});


// Cache In-Memory
const filtersCache = new Map();
const badwordsCache = new Map();
const pendingConfirmation = new Map();
const prayerTimeCache = new Map();
const reminderSent = new Map();

async function main() {
    const { state, saveCreds } = await useMultiFileAuthState('auth_info_baileys');
    const { version } = await fetchLatestBaileysVersion();

    const sock = makeWASocket({
        version,
        auth: state,
        logger: pino({
            level: 'info',
            transport: {
                target: 'pino-pretty',
                options: {
                    colorize: true,
                    translateTime: 'SYS:dd-mm-yyyy HH:MM:ss',
                    ignore: 'pid,hostname'
                }
            }
        }),
    });

    // Pasang properti penting ke objek 'sock' agar bisa diakses di semua perintah
    sock.commands = await loadCommands();
    sock.db = db;
    sock.config = config;
    sock.filtersCache = filtersCache;
    sock.badwordsCache = badwordsCache;
    sock.pendingConfirmation = pendingConfirmation;

    // =================================================================
    // BAGIAN PENJADWAL (CRON JOBS)
    // =================================================================

    // Cron job untuk pengingat sholat (berjalan setiap menit)
    cron.schedule('* * * * *', async () => {
        const now = new Date();
        const todayKey = now.toISOString().split('T')[0];
        const currentTime = now.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit', hour12: false, timeZone: 'Asia/Jakarta' });

        if (currentTime === '00:01') {
            reminderSent.clear();
            prayerTimeCache.clear();
            sock.logger.info('Resetting prayer reminders and cache for the new day.');
        }

        db.all('SELECT * FROM prayer_reminders WHERE is_active = 1', async (err, groups) => {
            if (err) return sock.logger.error({ err }, "Gagal mengambil data pengingat sholat");

            for (const group of groups) {
                try {
                    let timings = prayerTimeCache.get(group.city_name);
                    if (!timings) {
                        const url = `http://api.aladhan.com/v1/timingsByCity?city=${encodeURIComponent(group.city_name)}&country=Indonesia&method=11`;
                        const response = await axios.get(url);
                        if (response.data.code === 200) {
                            timings = response.data.data.timings;
                            prayerTimeCache.set(group.city_name, timings);
                            sock.logger.info(`Prayer schedule cached for city: ${group.city_name}`);
                        } else continue;
                    }

                    for (const [prayer, time] of Object.entries(timings)) {
                        if (['Sunrise'].includes(prayer)) continue;
                        
                        const reminderKey = `${todayKey}_${group.group_jid}_${prayer}`;
                        if (time === currentTime && !reminderSent.has(reminderKey)) {
                            const prayerNameMap = { Fajr: 'Subuh', Dhuhr: 'Dzuhur', Asr: 'Ashar', Maghrib: 'Maghrib', Isha: 'Isya', Imsak: 'Imsak' };
                            const prayerName = prayerNameMap[prayer] || prayer;

                            const message = prayer.toLowerCase() === 'imsak' 
                                ? `🔔 Waktu *Imsak* untuk wilayah *${group.city_name}* dan sekitarnya. Selamat menunaikan ibadah puasa.`
                                : `🕌 Waktu Sholat *${prayerName}* untuk wilayah *${group.city_name}* dan sekitarnya telah tiba.`;
                            
                            await sock.sendMessage(group.group_jid, { text: message });
                            reminderSent.set(reminderKey, true);
                            sock.logger.info(`Prayer reminder sent for ${prayerName} to group ${group.group_jid}`);
                        }
                    }
                } catch (e) {
                    sock.logger.error({ err: e, group: group.group_jid }, "Error on prayer reminder process (Aladhan API)");
                }
            }
        });
    });

    // Cron job untuk pesan terjadwal
    cron.schedule('* * * * *', () => {
        const now = Date.now();
        db.all('SELECT * FROM schedules WHERE next_run <= ?', [now], (err, rows) => {
            if (err) return sock.logger.error({ err }, "Gagal mengambil jadwal");
            rows.forEach(job => {
                sock.logger.info(`[Scheduler] Menjalankan tugas ID: ${job.id}`);
                sock.sendMessage(job.jid, { text: job.message })
                    .catch(e => sock.logger.error({ e }, `[Scheduler] Gagal mengirim pesan untuk ID ${job.id}`));

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
    // =================================================================
    
    // Handler Koneksi
    sock.ev.on('connection.update', (update) => {
        const { connection, lastDisconnect, qr } = update;
        if(qr) {
            console.log("------------------------------------------------");
            console.log(" KODE QR DITERIMA, SILAKAN PINDAI SEGERA!");
            console.log("------------------------------------------------");
            qrcode.generate(qr, { small: true });
        }
        if (connection === 'close') {
            const shouldReconnect = (lastDisconnect.error instanceof Boom)?.output?.statusCode !== DisconnectReason.loggedOut;
            sock.logger.info('Koneksi terputus:', lastDisconnect.error, ', menyambungkan kembali:', shouldReconnect);
            if (shouldReconnect) main();
        } else if (connection === 'open') {
            sock.logger.info('Koneksi berhasil tersambung!');
            if (config.owner) {
                sock.sendMessage(config.owner, { text: `*🤖 Bot Online!*\n\nBot telah berhasil terhubung dan siap digunakan.\n\n_Developer: ${OWNER_NAME}_` });
            }
        }
    });

    // Simpan kredensial
    sock.ev.on('creds.update', saveCreds);

    // Handler anggota grup baru
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

    // Handler Pesan Utama
    sock.ev.on('messages.upsert', async (m) => {
        const msg = m.messages[0];
        if (!msg.message || msg.key.fromMe) return;

        const prefix = ".";
        const text = (msg.message?.conversation || msg.message?.extendedTextMessage?.text || msg.message?.imageMessage?.caption || msg.message?.videoMessage?.caption || '').trim();

        if (!text.startsWith(prefix) && !text.startsWith('#')) {
            return handleNonCommand(sock, msg);
        }

        const args = text.slice(prefix.length).trim().split(/ +/);
        const commandName = args.shift().toLowerCase();
        const command = sock.commands.get(commandName) || sock.commands.find(cmd => cmd.aliases && cmd.aliases.includes(commandName));
        
        const sender = msg.key.participant || msg.key.remoteJid;
        
        const confirmKey = `${msg.key.remoteJid}:${sender}`;
        if (pendingConfirmation.has(confirmKey)) {
            const confirmData = pendingConfirmation.get(confirmKey);
            if (commandName === confirmData.command.slice(1)) { 
                pendingConfirmation.delete(confirmKey);
                await confirmData.action();
                return;
            }
        }

        if (!command) {
            if (text.startsWith('#')) {
                const noteName = text.substring(1).toLowerCase().trim();
                const noteCommand = sock.commands.get('getnote');
                if (noteCommand) await noteCommand.execute(sock, msg, [noteName]);
            }
            return;
        }

        sock.logger.info({ user: sender, command: commandName, args }, 'Executing command');

        try {
            await command.execute(sock, msg, args);
        } catch (error) {
            sock.logger.error({ err: error, command: commandName }, 'Error executing command');
            await sock.sendMessage(msg.key.remoteJid, { text: 'Maaf, terjadi kesalahan saat menjalankan perintah tersebut.' }, { quoted: msg });
        }
    });
}

main();
