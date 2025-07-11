const fs = require('fs');
const sqlite3 = require('sqlite3').verbose();

const JSON_DB_PATH = './database.json';
const SQLITE_DB_PATH = './bot_database.db';

console.log('Memulai proses migrasi data...');

// 1. Periksa apakah kedua file database ada
if (!fs.existsSync(JSON_DB_PATH)) {
    console.error('❌ Error: File database lama (database.json) tidak ditemukan.');
    process.exit(1);
}
if (!fs.existsSync(SQLITE_DB_PATH)) {
    console.error('❌ Error: File database baru (bot_database.db) tidak ditemukan. Jalankan bot utama setidaknya sekali untuk membuatnya.');
    process.exit(1);
}

// 2. Baca data dari database JSON lama
const oldData = JSON.parse(fs.readFileSync(JSON_DB_PATH, 'utf-8'));
console.log('✅ Berhasil membaca database.json.');

// 3. Hubungkan ke database SQLite baru
const db = new sqlite3.Database(SQLITE_DB_PATH, (err) => {
    if (err) {
        console.error('❌ Gagal terhubung ke SQLite:', err.message);
        process.exit(1);
    }
    console.log('✅ Berhasil terhubung ke bot_database.db.');
});

// 4. Mulai proses migrasi data
db.serialize(() => {
    // Migrasi Admins
    if (oldData.admins && oldData.admins.length > 0) {
        console.log(`Migrasi ${oldData.admins.length} admin...`);
        const stmt = db.prepare('INSERT OR IGNORE INTO admins (jid) VALUES (?)');
        oldData.admins.forEach(admin => stmt.run(admin));
        stmt.finalize();
    }

    // Migrasi Notes
    if (oldData.notes) {
        console.log('Migrasi notes...');
        const stmt = db.prepare(`INSERT OR IGNORE INTO notes (jid, name, content_type, content, file_path) VALUES (?, ?, ?, ?, ?)`);
        for (const jid in oldData.notes) {
            console.log(`  -> Memproses notes untuk chat: ${jid}`);
            for (const name in oldData.notes[jid]) {
                const note = oldData.notes[jid][name];
                if (note.message) { // Note Teks
                    stmt.run(jid, name, 'text', note.message, null);
                } else if (note.mediaMessage) { // Note Media
                    const contentJson = JSON.stringify(note.mediaMessage);
                    stmt.run(jid, name, 'media', contentJson, note.mediaPath);
                }
            }
        }
        stmt.finalize();
    }

    // Migrasi Filters
    if (oldData.filters) {
        console.log('Migrasi filters...');
        const stmt = db.prepare(`INSERT OR IGNORE INTO filters (jid, keyword, content_type, content, file_path) VALUES (?, ?, ?, ?, ?)`);
        for (const jid in oldData.filters) {
            console.log(`  -> Memproses filters untuk chat: ${jid}`);
            for (const keyword in oldData.filters[jid]) {
                const filter = oldData.filters[jid][keyword];
                if (filter.message) { // Filter Teks
                    stmt.run(jid, keyword, 'text', filter.message, null);
                } else if (filter.mediaMessage) { // Filter Media
                    const contentJson = JSON.stringify(filter.mediaMessage);
                    stmt.run(jid, keyword, 'media', contentJson, filter.mediaPath);
                }
            }
        }
        stmt.finalize();
    }

    // Migrasi Schedules
    if (oldData.schedules && oldData.schedules.length > 0) {
        console.log(`Migrasi ${oldData.schedules.length} jadwal...`);
        const stmt = db.prepare('INSERT OR IGNORE INTO schedules (id, jid, author, message, next_run, recurrence_json) VALUES (?, ?, ?, ?, ?, ?)');
        oldData.schedules.forEach(job => {
            const recurrenceJson = job.recurrence ? JSON.stringify(job.recurrence) : null;
            stmt.run(job.id, job.jid, job.author, job.message, job.nextRun, recurrenceJson);
        });
        stmt.finalize();
    }

    console.log('\n✅ Migrasi data selesai!');
});

// 5. Tutup koneksi database
db.close((err) => {
    if (err) {
        return console.error('❌ Error saat menutup database:', err.message);
    }
    console.log('Koneksi database ditutup.');
});
