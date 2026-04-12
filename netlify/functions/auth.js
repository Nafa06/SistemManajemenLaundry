const { Client } = require('pg');

exports.handler = async (event) => {
    const client = new Client({ connectionString: process.env.NEON_DATABASE_URL, ssl: { rejectUnauthorized: false } });
    await client.connect();
    const data = JSON.parse(event.body);

    try {
        if (data.action === 'register') {
            const res = await client.query(
                'INSERT INTO users (username, password, name, phone, role) VALUES ($1, $2, $3, $4, $5) RETURNING *',
                [data.username, data.password, data.name, data.phone, data.role]
            );
            return { statusCode: 201, body: JSON.stringify(res.rows[0]) };
        }
        
        if (data.action === 'login') {
            const res = await client.query(
                'SELECT * FROM users WHERE username = $1 AND password = $2 AND role = $3',
                [data.username, data.password, data.role]
            );
            if (res.rows.length > 0) return { statusCode: 200, body: JSON.stringify(res.rows[0]) };
            return { statusCode: 401, body: JSON.stringify({ error: 'Unauthorized' }) };
        }
        if (data.action === 'change_username') {
            // 1. Verifikasi Password Saat Ini
            const checkUser = await client.query('SELECT * FROM users WHERE username = $1 AND password = $2', [data.oldUsername, data.password]);
            if (checkUser.rows.length === 0) {
                return { statusCode: 401, body: JSON.stringify({ error: 'Password saat ini salah!' }) };
            }

            // 2. Cek apakah username baru sudah dipakai orang lain
            const checkNew = await client.query('SELECT * FROM users WHERE username = $1', [data.newUsername]);
            if (checkNew.rows.length > 0) {
                return { statusCode: 400, body: JSON.stringify({ error: 'Username ini sudah dipakai. Pilih yang lain.' }) };
            }

            // 3. Update Database (Ganti Username & Pindahkan Semua Riwayat Cucian)
            await client.query('BEGIN'); // Mulai transaksi aman
            await client.query('UPDATE transactions SET created_by = $1 WHERE created_by = $2', [data.newUsername, data.oldUsername]);
            await client.query('UPDATE transaction_logs SET created_by = $1 WHERE created_by = $2', [data.newUsername, data.oldUsername]);
            const updateRes = await client.query('UPDATE users SET username = $1 WHERE username = $2 RETURNING *', [data.newUsername, data.oldUsername]);
            await client.query('COMMIT'); // Simpan perubahan permanen

            return { statusCode: 200, body: JSON.stringify(updateRes.rows[0]) };
        }
    } catch (e) {
        return { statusCode: 500, body: JSON.stringify({ error: e.message }) };
    } finally {
        await client.end();
    }
};