export default defineEventHandler(async () => {
  const pool = getPool();
  const [rows] = await pool.query('SELECT * FROM videos ORDER BY id DESC LIMIT 1');
  
  if (!rows.length) {
    return null;
  }
  
  return rows[0];
});