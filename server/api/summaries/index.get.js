export default defineEventHandler(async () => {
  const pool = getPool();
  const [rows] = await pool.query('SELECT * FROM videos ORDER BY id DESC');
  return rows;
});