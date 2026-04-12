const { Client } = require('pg');

exports.handler = async (event, context) => {
    const client = new Client({
        connectionString: process.env.NEON_DATABASE_URL,
        ssl: { rejectUnauthorized: false }
    });

    try {
        await client.connect();
        const method = event.httpMethod;

        // 1. MENGAMBIL DATA (GET)
        if (method === 'GET') {
            const res = await client.query('SELECT * FROM transactions ORDER BY created_at DESC');
            return {
                statusCode: 200,
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(res.rows),
            };
        }

        // 2. INPUT TRANSAKSI BARU (POST)
        if (method === 'POST') {
            const data = JSON.parse(event.body);
            const query = `
                INSERT INTO transactions 
                (id, customer_name, contact, service_type, qty, description, total_price, created_by, status_laundry, status_payment) 
                VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10) 
                RETURNING *`;
            
            const values = [
                data.id, 
                data.customer_name, 
                data.contact, 
                data.service_type, 
                data.qty, 
                data.description, 
                data.total_price, 
                data.created_by,
                'Ditambahkan',
                'Belum Lunas'
            ];

            const res = await client.query(query, values);
            return {
                statusCode: 201,
                body: JSON.stringify(res.rows[0]),
            };
        }

        // 3. UPDATE STATUS & PEMBAYARAN (PUT)
        if (method === 'PUT') {
            const data = JSON.parse(event.body);
            let query = '';
            let values = [];

            // Jika ini update dari Pelanggan (Konfirmasi Bayar)
            if (data.action === 'confirm_payment') {
                query = `
                    UPDATE transactions 
                    SET status_payment = 'Menunggu Validasi', payment_method = $1, payment_sender = $2
                    WHERE id = $3 RETURNING *`;
                values = [data.method, data.sender, data.id];
            } 
            // Jika ini update dari Admin (Update Status Laundry atau Terima/Tolak Bayar)
            else {
                query = `
                    UPDATE transactions 
                    SET status_laundry = COALESCE($1, status_laundry), 
                        status_payment = COALESCE($2, status_payment)
                    WHERE id = $3 RETURNING *`;
                values = [data.status_laundry, data.status_payment, data.id];
            }

            const res = await client.query(query, values);
            return {
                statusCode: 200,
                body: JSON.stringify(res.rows[0]),
            };
        }

    } catch (error) {
        console.error("Database Error:", error);
        return { 
            statusCode: 500, 
            body: JSON.stringify({ error: error.message }) 
        };
    } finally {
        await client.end();
    }
};