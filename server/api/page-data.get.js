import { getPool } from '../utils/db.js';
import { fetchFiles } from '../utils/drive.js';
import { readStoredPlainText, toPublicLegacyAssetUrl } from '../utils/content.js';

export default defineEventHandler(async () => {
  try {
    const folderId = '1F4wnrmyzGyrFyLALvBQ39MgJt242woU5';

    const pool = getPool();
    const familyFiles = await fetchFiles(folderId);
    const [videoRows] = await pool.query('SELECT * FROM videos ORDER BY id');

    const videoDict = videoRows.reduce((acc, row) => {
      acc[row.google_file_id] = {
        id: row.id,
        transcription_path: row.transcription_path || '',
        audio_path: row.audio_path || '',
        video_title: row.video_title || '',
        summary: row.summary || '',
      };
      return acc;
    }, {});

    const dataPromises = familyFiles.map(async (file) => {
      const video = videoDict[file.id];
      if (!video) return null;

      let transcriptionContent = 'Transcripción no disponible.';
      if (video.transcription_path) {
        const storedText = await readStoredPlainText(video.transcription_path);
        if (storedText.trim()) transcriptionContent = storedText;
      }

      return {
        ...file,
        id: video.id,
        transcriptionContent,
        transcriptionPath: video.transcription_path,
        videoTitle: video.video_title,
        audioPath: toPublicLegacyAssetUrl(video.audio_path),
        summary: video.summary,
        order: parseInt(video.id, 10) || 0,
        thumbnailLink: file.thumbnailLink || '',
        embedUrl: `https://drive.google.com/file/d/${file.id}/preview`,
        googleFileId: file.id,
        createdTime: file.createdTime || new Date().toISOString(),
      };
    });

    const completedData = await Promise.all(dataPromises);
    const data = completedData
      .filter((item) => item && item.videoTitle)
      .sort((a, b) => b.order - a.order);

    return data;
  } catch (error) {
    console.error('Error in page-data compilation:', error);
    throw createError({ statusCode: 500, message: 'Internal Server Error' });
  }
});
