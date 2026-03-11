export default defineEventHandler(async () => {
  // getPool() is auto-imported from server/utils
  const pool = getPool();
  const [rows] = await pool.query('SELECT * FROM videos ORDER BY id');

  return rows.reduce((acc, row) => {
    const normalizedAudioPath = row.audio_path ? row.audio_path.replace(/\\/g, '/') : '';
    acc[row.google_file_id] = {
      id: row.id,
      transcription_path: row.transcription_path,
      audio_path: normalizedAudioPath ? 'https://wweb.casitaapps.com/' + normalizedAudioPath : '',
      video_title: row.video_title,
      summary: row.summary,
    };
    return acc;
  }, {});
});