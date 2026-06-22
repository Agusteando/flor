import { getPool } from '../utils/db.js';
import { hasText, readStoredPlainText } from '../utils/content.js';

function normalizeIds(ids) {
  return Array.from(new Set((Array.isArray(ids) ? ids : [])
    .map((id) => Number(id))
    .filter((id) => Number.isFinite(id) && id > 0)));
}

function buildSectionTitle(row) {
  const id = row.id ? `#${row.id}` : '';
  const title = row.video_title || 'Sin título';
  return [id, title].filter(Boolean).join(' · ');
}

export default defineEventHandler(async (event) => {
  const body = await readBody(event);
  const ids = normalizeIds(body?.ids);
  const mode = body?.mode === 'transcript' ? 'transcript' : 'summary';
  const includeTitles = body?.includeTitles !== false;

  if (!ids.length) {
    return { mode, count: 0, text: '', items: [] };
  }

  const pool = getPool();
  const [rows] = await pool.query(
    `SELECT id, video_title, transcription_path, summary
     FROM videos
     WHERE id IN (?)`,
    [ids]
  );

  const rowsById = new Map(rows.map((row) => [Number(row.id), row]));
  const orderedRows = ids.map((id) => rowsById.get(id)).filter(Boolean);
  const separator = `\n\n${'='.repeat(80)}\n\n`;

  const items = [];
  for (const row of orderedRows) {
    const title = buildSectionTitle(row);
    let content = '';
    let status = 'ok';

    if (mode === 'summary') {
      content = hasText(row.summary) ? String(row.summary).trim() : '';
      if (!content) status = 'missing_summary';
    } else {
      content = await readStoredPlainText(row.transcription_path);
      content = content.trim();
      if (!content) status = 'missing_transcript';
    }

    const sectionText = includeTitles
      ? `${title}\n\n${content || (mode === 'summary' ? 'Sin resumen disponible.' : 'Sin transcripción disponible.')}`
      : (content || '');

    items.push({
      id: row.id,
      title,
      status,
      characters: sectionText.length,
      text: sectionText,
    });
  }

  return {
    mode,
    count: items.length,
    text: items.map((item) => item.text).join(separator),
    items: items.map(({ text, ...rest }) => rest),
  };
});
