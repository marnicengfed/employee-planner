const { neon } = require('@netlify/neon');

// Initialize the Neon client. When run on Netlify with the @netlify/neon package
// installed, calling neon() with no arguments will automatically pick up the
// Netlify-provisioned database connection string from the environment.
const sql = neon();

// Ensure the employees table exists before handling any requests. This helper
// runs a CREATE TABLE IF NOT EXISTS statement on every invocation. Because
// Postgres automatically skips creation if the table exists, this is safe to
// call repeatedly without side effects.
async function ensureTables() {
  await sql(`CREATE TABLE IF NOT EXISTS employees (
    id SERIAL PRIMARY KEY,
    shop TEXT NOT NULL,
    name TEXT NOT NULL,
    start_date DATE NOT NULL,
    end_date DATE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
  )`);
}

exports.handler = async function (event, context) {
  // Enable CORS to allow the frontend to call this function
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Allow-Methods': 'GET,POST,PUT,DELETE,OPTIONS',
    'Content-Type': 'application/json'
  };
  // Handle preflight requests
  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 200, headers, body: '' };
  }
  try {
    // Ensure tables exist
    await ensureTables();
    const method = event.httpMethod;
    if (method === 'GET') {
      // If a specific shop is requested, filter by it
      const shop = event.queryStringParameters && event.queryStringParameters.shop;
      let rows;
      if (shop) {
        rows = await sql('SELECT * FROM employees WHERE shop = $1 ORDER BY start_date ASC', [shop]);
      } else {
        rows = await sql('SELECT * FROM employees ORDER BY shop ASC, start_date ASC');
      }
      return { statusCode: 200, headers, body: JSON.stringify(rows) };
    }
    if (method === 'POST') {
      const body = JSON.parse(event.body || '{}');
      const { name, shop, start_date, end_date } = body;
      if (!name || !shop || !start_date) {
        return { statusCode: 400, headers, body: JSON.stringify({ error: 'Missing required fields' }) };
      }
      await sql('INSERT INTO employees (name, shop, start_date, end_date) VALUES ($1,$2,$3,$4)', [name, shop, start_date, end_date || null]);
      return { statusCode: 200, headers, body: JSON.stringify({ success: true }) };
    }
    if (method === 'PUT') {
      const body = JSON.parse(event.body || '{}');
      const { id, name, shop, start_date, end_date } = body;
      if (!id || !name || !shop || !start_date) {
      return { statusCode: 400, headers, body: JSON.stringify({ error: 'Missing required fields' }) };
      }
      await sql('UPDATE employees SET name=$1, shop=$2, start_date=$3, end_date=$4, updated_at=NOW() WHERE id=$5', [name, shop, start_date, end_date || null, id]);
      return { statusCode: 200, headers, body: JSON.stringify({ success: true }) };
    }
    if (method === 'DELETE') {
      const id = event.queryStringParameters && event.queryStringParameters.id;
      if (!id) {
        return { statusCode: 400, headers, body: JSON.stringify({ error: 'Missing id parameter' }) };
      }
      await sql('DELETE FROM employees WHERE id = $1', [id]);
      return { statusCode: 200, headers, body: JSON.stringify({ success: true }) };
    }
    // Method not allowed
    return { statusCode: 405, headers, body: JSON.stringify({ error: 'Method Not Allowed' }) };
  } catch (error) {
    console.error('Function error:', error);
    return { statusCode: 500, headers, body: JSON.stringify({ error: error.message }) };
  }
};
