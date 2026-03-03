const { neon } = require('@netlify/neon');

// Initialize database client. On Netlify, the @netlify/neon package automatically
// picks up the connection details from environment variables.
const sql = neon();

// Ensure the shops table exists. We run this on every invocation to guarantee
// the table is created before use. Using CREATE TABLE IF NOT EXISTS means
// repeated calls are harmless.
async function ensureTable() {
  await sql(`CREATE TABLE IF NOT EXISTS shops (
    id SERIAL PRIMARY KEY,
    name TEXT UNIQUE NOT NULL
  )`);
}

exports.handler = async function (event, context) {
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Allow-Methods': 'GET,POST,DELETE,OPTIONS',
    'Content-Type': 'application/json'
  };
  // Handle CORS preflight
  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 200, headers, body: '' };
  }
  try {
    await ensureTable();
    const method = event.httpMethod;
    if (method === 'GET') {
      const rows = await sql('SELECT * FROM shops ORDER BY name ASC');
      return { statusCode: 200, headers, body: JSON.stringify(rows) };
    }
    if (method === 'POST') {
      const body = JSON.parse(event.body || '{}');
      const { name } = body;
      if (!name) {
        return { statusCode: 400, headers, body: JSON.stringify({ error: 'Missing name' }) };
      }
      // Insert shop if it does not already exist
      await sql('INSERT INTO shops (name) VALUES ($1) ON CONFLICT (name) DO NOTHING', [name]);
      return { statusCode: 200, headers, body: JSON.stringify({ success: true }) };
    }
    if (method === 'DELETE') {
      const nameParam = event.queryStringParameters && event.queryStringParameters.name;
      const idParam = event.queryStringParameters && event.queryStringParameters.id;
      if (!nameParam && !idParam) {
        return { statusCode: 400, headers, body: JSON.stringify({ error: 'Missing name or id' }) };
      }
      if (nameParam) {
        await sql('DELETE FROM shops WHERE name = $1', [nameParam]);
      } else {
        await sql('DELETE FROM shops WHERE id = $1', [idParam]);
      }
      return { statusCode: 200, headers, body: JSON.stringify({ success: true }) };
    }
    return { statusCode: 405, headers, body: JSON.stringify({ error: 'Method Not Allowed' }) };
  } catch (error) {
    console.error('Shops function error:', error);
    return { statusCode: 500, headers, body: JSON.stringify({ error: error.message }) };
  }
};
