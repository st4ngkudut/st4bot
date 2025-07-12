const fs = require('fs');
const { GoogleGenerativeAI } = require('@google/generative-ai');

// =================================================================
// KONSTANTA
// =================================================================
const OWNER_NAME = "ST4NGKUDUT";
const GITHUB_LINK = "https://github.com/st4ngkudut";
const DB_FILE_PATH = './bot_database.db';
const CONFIG_FILE_PATH = './config.json';
const MEDIA_DIR = './media_files';
const STICKER_TMP_DIR = './sticker_tmp';

// =================================================================
// INISIALISASI GLOBAL
// =================================================================
let geminiModel;
try {
    const config = JSON.parse(fs.readFileSync(CONFIG_FILE_PATH));
    if (config.gemini_api_key && config.gemini_api_key !== "MASUKKAN_API_KEY_ANDA_DI_SINI") {
        const genAI = new GoogleGenerativeAI(config.gemini_api_key);
        geminiModel = genAI.getGenerativeModel({ model: "gemini-2.5-pro" });
    }
} catch (e) {
    console.warn("Tidak dapat memuat API Key Gemini. Pastikan config.json ada dan benar.");
}

// =================================================================
// FUNGSI HELPER
// =================================================================

/**
 * Mengirimkan prompt ke Google Gemini AI dan mengembalikan hasilnya.
 * @param {string} prompt Teks pertanyaan untuk AI.
 * @returns {Promise<string>} Jawaban dari AI.
 */
async function askGemini(prompt) {
    if (!geminiModel) {
        return '❌ Fitur Gemini tidak aktif. API Key belum diatur oleh Owner di `config.json`.';
    }
    try {
        const result = await geminiModel.generateContent(prompt);
        const response = await result.response;
        return response.text();
    } catch (error) {
        console.error("Error pada Gemini API:", error);
        return 'Maaf, terjadi kesalahan saat menghubungi Gemini. Coba lagi nanti.';
    }
}

/**
 * Mendapatkan JID target dari pesan yang di-mention atau di-reply.
 * @param {object} msg Objek pesan dari Baileys.
 * @returns {string|null} JID target atau null jika tidak ada.
 */
function getTargetJid(msg) {
    const mentionedJids = msg.message?.extendedTextMessage?.contextInfo?.mentionedJid || [];
    if (mentionedJids.length > 0) return mentionedJids[0];
    if (msg.message?.extendedTextMessage?.contextInfo?.participant) return msg.message.extendedTextMessage.contextInfo.participant;
    return null;
}

/**
 * Memeriksa apakah seorang partisipan adalah admin di grup.
 * @param {object} sock Objek socket Baileys.
 * @param {string} jid JID grup.
 * @param {string} participant JID partisipan.
 * @returns {Promise<boolean>} True jika admin, false jika bukan.
 */
async function isGroupAdmin(sock, jid, participant) {
    try {
        const groupMetadata = await sock.groupMetadata(jid);
        const admin = groupMetadata.participants.find(p => p.id === participant && p.admin);
        return !!admin;
    } catch (e) {
        return false;
    }
}

/**
 * Memeriksa apakah seorang pengguna adalah admin bot (termasuk owner).
 * @param {object} sock Objek socket Baileys.
 * @param {string} userId JID pengguna.
 * @returns {Promise<boolean>} True jika admin bot, false jika bukan.
 */
async function isBotAdmin(sock, userId) {
    return new Promise((resolve) => {
        try {
            if (userId === sock.config.owner) return resolve(true);
            sock.db.get('SELECT jid FROM admins WHERE jid = ?', [userId], (err, row) => {
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

/**
 * Mengubah string waktu relatif (e.g., '10m', '1h') menjadi milidetik.
 * @param {string} timeString String waktu.
 * @returns {number|null} Milidetik atau null jika format salah.
 */
function parseRelativeTimeToMs(timeString) {
    if (!timeString) return null;
    const match = timeString.match(/^(\d+)([smhd])$/);
    if (!match) return null;
    const value = parseInt(match[1]);
    const unit = match[2];
    switch (unit) {
        case 's': return value * 1000;
        case 'm': return value * 60 * 1000;
        case 'h': return value * 60 * 60 * 1000;
        case 'd': return value * 24 * 60 * 60 * 1000;
        default: return null;
    }
}

/**
 * Menghitung waktu eksekusi berikutnya untuk jadwal berulang.
 * @param {object} schedule Objek jadwal.
 * @returns {number} Timestamp untuk eksekusi berikutnya.
 */
function calculateNextRun(schedule) {
    const now = new Date();
    const [hour, minute] = schedule.recurrence.time.split(':').map(Number);
    let nextRun = new Date();
    nextRun.setHours(hour, minute, 0, 0);

    const type = schedule.recurrence.type;

    if (type === 'daily') {
        if (nextRun <= now) {
            nextRun.setDate(nextRun.getDate() + 1);
        }
    } else if (type === 'weekly') {
        const targetDay = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'].indexOf(schedule.recurrence.dayOfWeek);
        while (nextRun.getDay() !== targetDay || nextRun <= now) {
            nextRun.setDate(nextRun.getDate() + 1);
        }
    }
    return nextRun.getTime();
}

/**
 * Mengubah string tanggal dan waktu kustom (e.g., '12-07-2025', '14:30') menjadi milidetik.
 * @param {string} dateString String tanggal (dd-mm-yyyy).
 * @param {string} timeString String waktu (hh:mm).
 * @returns {number|null} Milidetik atau null jika format salah.
 */
function parseCustomDateTimeToMs(dateString, timeString) {
    if (!dateString || !timeString) return null;
    const dateParts = dateString.split('-');
    const timeParts = timeString.split(':');
    if (dateParts.length !== 3 || timeParts.length !== 2) return null;

    const day = parseInt(dateParts[0]);
    const month = parseInt(dateParts[1]) - 1; // Bulan di JS 0-indexed
    const year = parseInt(dateParts[2]);
    const hour = parseInt(timeParts[0]);
    const minute = parseInt(timeParts[1]);

    if ([day, month, year, hour, minute].some(isNaN)) return null;

    const targetDate = new Date(year, month, day, hour, minute);
    return targetDate.getTime();
}

module.exports = {
    OWNER_NAME,
    GITHUB_LINK,
    DB_FILE_PATH,
    CONFIG_FILE_PATH,
    MEDIA_DIR,
    STICKER_TMP_DIR,
    askGemini,
    getTargetJid,
    isGroupAdmin,
    isBotAdmin,
    parseRelativeTimeToMs,
    calculateNextRun,
    parseCustomDateTimeToMs
};
