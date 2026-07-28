import { getPool } from '../../../utils/db.js';

export default defineEventHandler(async () => {
  const pool = getPool();
  const [rows] = await pool.query(`
    SELECT
      id,
      video_title,
      CASE
        WHEN summary IS NOT NULL AND CHAR_LENGTH(TRIM(summary)) > 0 THEN 1
        ELSE 0
      END AS has_summary,
      CASE
        WHEN transcription_path IS NOT NULL
          AND CHAR_LENGTH(TRIM(transcription_path)) > 0 THEN 1
        ELSE 0
      END AS has_transcript
    FROM videos
    WHERE summary IS NULL
      OR CHAR_LENGTH(TRIM(summary)) = 0
      OR transcription_path IS NULL
      OR CHAR_LENGTH(TRIM(transcription_path)) = 0
    ORDER BY id DESC
  `);

  const conferences = rows.map((row) => {
    const availability = {
      summary: Number(row.has_summary) === 1,
      transcript: Number(row.has_transcript) === 1,
    };

    return {
      id: String(row.id),
      title: String(row.video_title || '').trim() || 'Sin título',
      availability,
      missing: Object.entries(availability)
        .filter(([, available]) => !available)
        .map(([contentType]) => contentType),
    };
  });

  return {
    count: conferences.length,
    conferences,
  };
});
