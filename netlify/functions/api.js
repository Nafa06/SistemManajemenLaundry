// netlify/functions/api.js
const { Client } = require('pg');

exports.handler = async (event, context) => {
    // Kredensial ini disimpan dengan aman di setting Environment Variables Netlify
    const client = new Client({
        connectionString: process.env.NEON_DATABASE_URL,
        ssl: { rejectUnauthorized: false }
    });

    try {
        await client.connect();

        if (event.httpMethod === 'GET') {
            // Contoh: Mengambil semua transaksi
            const res = await client.query('SELECT * FROM transactions ORDER BY created_at DESC');
            return {
                statusCode: 200,
                body: JSON.stringify(res.rows),
            };
        }

        if (event.httpMethod === 'POST') {
            // Contoh: Menyimpan transaksi baru
            const data = JSON.parse(event.body);
            const query = 'INSERT INTO transactions (service, qty, total, status) VALUES ($1, $2, $3, $4) RETURNING *';
            const values = [data.service, data.qty, data.total, data.status];
            
            const res = await client.query(query, values);
            return {
                statusCode: 201,
                body: JSON.stringify(res.rows[0]),
            };
        }

    } catch (error) {
        return { statusCode: 500, body: JSON.stringify({ error: error.message }) };
    } finally {
        await client.end();
    }
};