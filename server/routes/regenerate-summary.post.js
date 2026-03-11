import axios from 'axios';

export default defineEventHandler(async (event) => {
  const body = await readBody(event);
  const { videoId, prompt } = body;

  try {
    // getPool() and askGPT() are auto-imported from server/utils
    const pool = getPool();
    const [videoRows] = await pool.query('SELECT * FROM videos WHERE id = ?', [videoId]);
    if (videoRows.length === 0) {
      throw createError({ statusCode: 404, message: 'Video not found.' });
    }
    const video = videoRows[0];

    let transcriptionContent = 'Transcripción no disponible.';
    if (video.transcription_path) {
      try {
        const transcriptionResponse = await axios.get(`https://wweb.casitaapps.com/${video.transcription_path}`);
        transcriptionContent = transcriptionResponse.data;
      } catch(e) {
        // Fallback already handled
      }
    }

    const gptResponse = await askGPT(`${prompt}\n\n${transcriptionContent}`);
    await pool.query('UPDATE videos SET summary = ? WHERE id = ?', [gptResponse, videoId]);

    return { summary: gptResponse };
  } catch (error) {
    console.error('Error regenerating summary:', error);
    throw createError({ statusCode: 500, message: 'Internal Server Error' });
  }
});