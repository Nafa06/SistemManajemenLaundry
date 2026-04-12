const { Client } = require('pg');

exports.handler = async (event) => {
    // Tangkal request selain POST agar tidak crash
    if (event.httpMethod !== 'POST') {
        return { statusCode: 405, body: JSON.stringify({ error: 'Method Not Allowed' }) };
    }

    const client = new Client({
        connectionString: process.env.NEON_DATABASE_URL,
        ssl: { rejectUnauthorized: false }
    });

    try {
        // Pindahkan connect dan parse ke dalam TRY agar kalau gagal tidak 502
        await client.connect(); 
        const data = JSON.parse(event.body);

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
            return { statusCode: 401, body: JSON.stringify({ error: 'Username atau Password salah!' }) };
        }

        if (data.action === 'change_username') {
            const checkUser = await client.query('SELECT * FROM users WHERE username = $1 AND password = $2', [data.oldUsername, data.password]);
            if (checkUser.rows.length === 0) return { statusCode: 401, body: JSON.stringify({ error: 'Password saat ini salah!' }) };

            const checkNew = await client.query('SELECT * FROM users WHERE username = $1', [data.newUsername]);
            if (checkNew.rows.length > 0) return { statusCode: 400, body: JSON.stringify({ error: 'Username ini sudah dipakai. Pilih yang lain.' }) };

            await client.query('BEGIN'); 
            await client.query('UPDATE transactions SET created_by = $1 WHERE created_by = $2', [data.newUsername, data.oldUsername]);
            await client.query('UPDATE transaction_logs SET created_by = $1 WHERE created_by = $2', [data.newUsername, data.oldUsername]);
            const updateRes = await client.query('UPDATE users SET username = $1 WHERE username = $2 RETURNING *', [data.newUsername, data.oldUsername]);
            await client.query('COMMIT'); 

            return { statusCode: 200, body: JSON.stringify(updateRes.rows[0]) };
        }

        // LOGIKA BARU: SIMPAN FOTO PROFIL PERMANEN
        if (data.action === 'update_photo') {
            const updateRes = await client.query(
                'UPDATE users SET photo_url = $1 WHERE username = $2 RETURNING *',
                [data.photo_url, data.username]
            );
            return { statusCode: 200, body: JSON.stringify(updateRes.rows[0]) };
        }

        return { statusCode: 400, body: JSON.stringify({ error: 'Aksi tidak valid' }) };

    } catch (e) {
        console.error("Auth Database Error:", e);
        // Kalau gagal connect atau query, return 500 JSON, bukan 502 Crash
        return { statusCode: 500, body: JSON.stringify({ error: "Server Error: " + e.message }) };
    } finally {
        await client.end();
    }
};