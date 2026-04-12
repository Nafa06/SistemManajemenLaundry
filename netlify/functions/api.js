const { Client } = require('pg');

exports.handler = async (event) => {
    const client = new Client({
        connectionString: process.env.NEON_DATABASE_URL,
        ssl: { rejectUnauthorized: false }
    });

    try {
        await client.connect();
        const method = event.httpMethod;
        const qp = event.queryStringParameters;

        // 1. GET: Ambil Data Transaksi ATAU Data Log
        if (method === 'GET') {
            if (qp && qp.log_id) {
                const res = await client.query('SELECT * FROM transaction_logs WHERE transaction_id = $1 ORDER BY created_at DESC', [qp.log_id]);
                return { statusCode: 200, body: JSON.stringify(res.rows) };
            } else {
                const res = await client.query('SELECT * FROM transactions ORDER BY created_at DESC');
                return { statusCode: 200, body: JSON.stringify(res.rows) };
            }
        }

        // 2. POST: Buat Pesanan Baru
        if (method === 'POST') {
            const data = JSON.parse(event.body);
            
            // Insert ke tabel transactions
            const qTrx = `INSERT INTO transactions (id, customer_name, contact, service_type, qty, description, total_price, created_by, status_laundry, status_payment) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10) RETURNING *`;
            const valTrx = [data.id, data.customer_name, data.contact, data.service_type, data.qty, data.description, data.total_price, data.created_by, 'Ditambahkan', 'Belum Lunas'];
            const res = await client.query(qTrx, valTrx);

            // Insert ke tabel Logs
            await client.query(
                `INSERT INTO transaction_logs (transaction_id, action, description, created_by) VALUES ($1, $2, $3, $4)`,
                [data.id, 'BUAT PESANAN', 'Pesanan baru dibuat oleh pelanggan', data.created_by]
            );

            return { statusCode: 201, body: JSON.stringify(res.rows[0]) };
        }

        // 3. PUT: Update Status / Pembayaran
        if (method === 'PUT') {
            const data = JSON.parse(event.body);
            
            if (data.action === 'confirm_payment') {
                await client.query(
                    `UPDATE transactions SET status_payment = 'Menunggu Validasi', payment_method = $1, payment_sender = $2, payment_submitted_at = CURRENT_TIMESTAMP WHERE id = $3`,
                    [data.method, data.sender, data.id]
                );
                await client.query(`INSERT INTO transaction_logs (transaction_id, action, description, created_by) VALUES ($1, $2, $3, $4)`, [data.id, 'BAYAR', `Bukti bayar dikirim via ${data.method} (A.N ${data.sender})`, data.sender]);
            } 
            else if (data.action === 'admin_update') {
                let qUpdate = `UPDATE transactions SET status_laundry = COALESCE($1, status_laundry), status_payment = COALESCE($2, status_payment)`;
                if(data.status_payment === 'Lunas') qUpdate += `, payment_verified_at = CURRENT_TIMESTAMP`;
                qUpdate += ` WHERE id = $3 RETURNING *`;
                
                await client.query(qUpdate, [data.status_laundry, data.status_payment, data.id]);
                await client.query(`INSERT INTO transaction_logs (transaction_id, action, description, created_by) VALUES ($1, $2, $3, $4)`, [data.id, 'UPDATE ADMIN', `Admin mengubah status pesanan/pembayaran`, 'Admin']);
            }
            return { statusCode: 200, body: JSON.stringify({ success: true }) };
        }

        // 4. DELETE: Hapus Pesanan
        if (method === 'DELETE') {
            const data = JSON.parse(event.body);
            await client.query('DELETE FROM transaction_logs WHERE transaction_id = $1', [data.id]); // Hapus log dulu
            await client.query('DELETE FROM transactions WHERE id = $1', [data.id]); // Hapus transaksi
            return { statusCode: 200, body: JSON.stringify({ success: true }) };
        }

    } catch (error) {
        return { statusCode: 500, body: JSON.stringify({ error: error.message }) };
    } finally {
        await client.end();
    }
};