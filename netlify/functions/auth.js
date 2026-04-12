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
    } catch (e) {
        return { statusCode: 500, body: JSON.stringify({ error: e.message }) };
    } finally {
        await client.end();
    }
};