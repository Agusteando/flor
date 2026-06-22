import { getPool } from '../utils/db.js';
import { hasText } from '../utils/content.js';

export default defineEventHandler(async () => {
  const pool = getPool();
  const [rows] = await pool.query(`
    SELECT id, google_file_id, transcription_path, video_title, summary
    FROM videos
    WHERE video_title IS NOT NULL AND TRIM(video_title) <> ''
    ORDER BY id DESC
  `);

  return rows.map((row) => ({
    id: row.id,
    googleFileId: row.google_file_id || '',
    videoTitle: row.video_title || 'Sin título',
    transcriptionPath: row.transcription_path || '',
    hasTranscript: hasText(row.transcription_path),
    hasSummary: hasText(row.summary),
    summaryPreview: hasText(row.summary) ? String(row.summary).replace(/\s+/g, ' ').slice(0, 220) : '',
  }));
});
