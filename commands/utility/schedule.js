const { parseRelativeTimeToMs, calculateNextRun, parseCustomDateTimeToMs } = require('../../utils/helpers');

module.exports = {
    name: 'schedule',
    aliases: ['remind'],
    description: 'Menjadwalkan pengiriman pesan dengan format waktu yang fleksibel.',
    usage: 'schedule <waktu> <pesan>\nContoh:\n.schedule 10m Rapat\n.schedule everyday 09:00 Laporan harian\n.schedule every monday 10:00 Rapat mingguan',
    category: 'utility',
    execute: async (sock, msg, args) => {
        const from = msg.key.remoteJid;
        const sender = msg.key.participant || from;

        if (args.length < 2) {
            return sock.sendMessage(from, { text: `Format perintah tidak lengkap.\n\nGunakan:\n*Waktu Relatif:*\n.schedule 10m Rapat\n\n*Jadwal Harian:*\n.schedule everyday 09:00 Absen pagi\n\n*Jadwal Mingguan:*\n.schedule every monday 10:00 Rapat tim` }, { quoted: msg });
        }

        const argsLower = args.map(arg => arg.toLowerCase());
        let newSchedule = { id: `sch-${Date.now()}`, jid: from, author: sender };
        let messageContent = '';
        let isRecurring = false;
        let recurrenceJson = null;

        // Cek format jadwal berulang
        if (argsLower[0] === 'everyday' && args.length >= 3) {
            isRecurring = true;
            newSchedule.recurrence = { type: 'daily', time: argsLower[1] };
            messageContent = args.slice(2).join(' ');
        } else if (argsLower[0] === 'every' && ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'].includes(argsLower[1]) && args.length >= 4) {
            isRecurring = true;
            newSchedule.recurrence = { type: 'weekly', dayOfWeek: argsLower[1], time: argsLower[2] };
            messageContent = args.slice(3).join(' ');
        }

        if (isRecurring) {
            newSchedule.message = messageContent;
            newSchedule.nextRun = calculateNextRun(newSchedule);
            recurrenceJson = JSON.stringify(newSchedule.recurrence);
        } else {
            // Cek format waktu relatif atau absolut
            const relativeTimeMs = parseRelativeTimeToMs(argsLower[0]);
            const customTimeMs = parseCustomDateTimeToMs(args[0], args[1]);

            if (relativeTimeMs && args.length >= 2) {
                newSchedule.nextRun = Date.now() + relativeTimeMs;
                newSchedule.message = args.slice(1).join(' ');
            } else if (customTimeMs && args.length >= 3) {
                newSchedule.nextRun = customTimeMs;
                newSchedule.message = args.slice(2).join(' ');
            }
        }

        if (!newSchedule.nextRun || !newSchedule.message) {
            return sock.sendMessage(from, { text: 'Format perintah tidak dikenali. Cek `.help schedule` untuk melihat contoh.' }, { quoted: msg });
        }
        if (newSchedule.nextRun <= Date.now()) {
            return sock.sendMessage(from, { text: '❌ Tidak dapat menjadwalkan tugas di waktu yang sudah berlalu.' }, { quoted: msg });
        }

        sock.db.run('INSERT INTO schedules (id, jid, author, message, next_run, recurrence_json) VALUES (?, ?, ?, ?, ?, ?)',
            [newSchedule.id, newSchedule.jid, newSchedule.author, newSchedule.message, newSchedule.nextRun, recurrenceJson],
            async function (err) {
                if (err) {
                    sock.logger.error({ err }, "Gagal menyimpan jadwal");
                    return sock.sendMessage(from, { text: '❌ Terjadi kesalahan saat menyimpan jadwal.' }, { quoted: msg });
                }
                const targetDate = new Date(newSchedule.nextRun).toLocaleString('id-ID', { timeZone: 'Asia/Jakarta', dateStyle: 'full', timeStyle: 'short' });
                await sock.sendMessage(from, { text: `✅ Tugas berhasil dijadwalkan!\n\n*ID:* \`${newSchedule.id}\`\n*Jadwal Berikutnya:* ${targetDate}` }, { quoted: msg });
            }
        );
    }
};
