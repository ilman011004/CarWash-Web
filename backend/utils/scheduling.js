// Pengecekan jadwal bentrok pegawai.
// Slot waktu disimpan sebagai teks, misalnya "08:00 - 10:00".

// Status pesanan yang masih "memakan" waktu pegawai.
export const BUSY_STATUSES = ['assigned', 'on_the_way', 'in_progress'];

// "08:00 - 10:00" -> { start: 480, end: 600 } (menit sejak 00:00). Null jika formatnya tidak dikenal.
export function parseSlot(slot) {
    const m = String(slot || '').match(/(\d{1,2}):(\d{2})\s*[-–]\s*(\d{1,2}):(\d{2})/);
    if (!m) return null;
    const start = Number(m[1]) * 60 + Number(m[2]);
    const end = Number(m[3]) * 60 + Number(m[4]);
    return end > start ? { start, end } : null;
}

// Dua slot bentrok jika rentangnya saling tumpang tindih.
// Slot yang bersambung (selesai 15:00, mulai 15:00) TIDAK dianggap bentrok.
export function slotsOverlap(slotA, slotB) {
    const a = parseSlot(slotA);
    const b = parseSlot(slotB);
    if (!a || !b) return String(slotA ?? '').trim() === String(slotB ?? '').trim(); // format tak dikenal: bandingkan teks
    return a.start < b.end && b.start < a.end;
}

// Cari pegawai (store_employees.id) yang sudah punya tugas lain pada tanggal & jam pesanan ini.
// Bentrok dicek per akun (user_id), karena satu akun bisa terdaftar di beberapa toko.
// Penugasan yang ditolak pegawai tidak dihitung. `db` boleh pool atau client transaksi.
// Hasil: { [employeeId]: { employee_name, order_id, order_code, time_slot, order_status, store_name } }
export async function findEmployeeConflicts(db, { orderId, employeeIds }) {
    if (!employeeIds || employeeIds.length === 0) return {};

    const { rows: target } = await db.query('SELECT time_slot FROM orders WHERE id = $1', [orderId]);
    if (!target[0]) return {};

    const { rows } = await db.query(
        `SELECT req.id AS employee_id, u.name AS employee_name,
            o.id AS order_id, o.order_code, o.time_slot, o.order_status, st.name AS store_name
     FROM store_employees req
     JOIN users u ON u.id = req.user_id
     JOIN store_employees se ON se.user_id = req.user_id
     JOIN order_assignments oa ON oa.employee_id = se.id
     JOIN orders o ON o.id = oa.order_id
     JOIN stores st ON st.id = o.store_id
     WHERE req.id = ANY($1::int[])
       AND o.id <> $2
       AND o.booking_date = (SELECT booking_date FROM orders WHERE id = $2)
       AND oa.response_status <> 'declined'
       AND o.order_status IN ('assigned', 'on_the_way', 'in_progress')
     ORDER BY o.time_slot`,
        [employeeIds, orderId]
    );

    const conflicts = {};
    for (const r of rows) {
        if (conflicts[r.employee_id]) continue; // cukup satu bentrokan pertama per pegawai
        if (slotsOverlap(target[0].time_slot, r.time_slot)) {
            conflicts[r.employee_id] = {
                employee_name: r.employee_name,
                order_id: r.order_id,
                order_code: r.order_code,
                time_slot: r.time_slot,
                order_status: r.order_status,
                store_name: r.store_name,
            };
        }
    }
    return conflicts;
}