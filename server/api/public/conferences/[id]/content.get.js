import { getPool } from '../../../../utils/db.js';
import { hasText, readStoredPlainText } from '../../../../utils/content.js';
import {
  conferenceIdFromEvent,
  contentAvailability,
} from '../../../../utils/public-content-api.js';

export default defineEventHandler(async (event) => {
  const id = conferenceIdFromEvent(event);
  const pool = getPool();
  const [rows] = await pool.query(
    `SELECT id, video_title, summary, transcription_path
     FROM videos
     WHERE id = ?
     LIMIT 1`,
    [id]
  );

  if (!rows.length) {
    throw createError({
      statusCode: 404,
      statusMessage: 'Conference not found',
    });
  }

  const row = rows[0];
  const summary = hasText(row.summary) ? String(row.summary) : null;
  const storedTranscript = hasText(row.transcription_path)
    ? await readStoredPlainText(row.transcription_path)
    : '';
  const transcript = hasText(storedTranscript) ? storedTranscript : null;

  return {
    id: String(row.id),
    title: String(row.video_title || '').trim() || 'Sin título',
    availability: contentAvailability(summary, transcript),
    summary,
    transcript,
  };
});
