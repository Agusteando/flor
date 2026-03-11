export default defineEventHandler(async (event) => {
  const id = getRouterParam(event, 'id');
  const pool = getPool();
  const [rows] = await pool.query('SELECT * FROM videos WHERE id = ?', [id]);
  
  if (!rows.length) {
    throw createError({ statusCode: 404, message: 'Summary not found' });
  }
  
  return rows[0];
});