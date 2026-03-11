import axios from 'axios';

export default defineEventHandler(async () => {
  try {
    const folderId = '1F4wnrmyzGyrFyLALvBQ39MgJt242woU5';
    const rootTranscriptionPath = 'https://wweb.casitaapps.com';

    // getPool() and fetchFiles() are auto-imported
    const pool = getPool();
    const familyFiles = await fetchFiles(folderId);
    const [videoRows] = await pool.query('SELECT * FROM videos ORDER BY id');

    const videoDict = videoRows.reduce((acc, row) => {
      const normalizedAudioPath = row.audio_path ? row.audio_path.replace(/\\/g, '/') : '';
      acc[row.google_file_id] = {
        id: row.id,
        transcription_path: row.transcription_path,
        audio_path: normalizedAudioPath ? rootTranscriptionPath + '/' + normalizedAudioPath : '',
        video_title: row.video_title,
        summary: row.summary,
      };
      return acc;
    }, {});

    const dataPromises = familyFiles.map(async (file) => {
      const video = videoDict[file.id];
      if (video) {
        const embedUrl = `https://drive.google.com/file/d/${file.id}/preview`;
        let transcriptionContent = 'Transcripción no disponible.';
        
        if (video.transcription_path) {
          try {
            const transcriptionResponse = await axios.get(`${rootTranscriptionPath}/${video.transcription_path}`);
            transcriptionContent = transcriptionResponse.data;
          } catch (error) {
            transcriptionContent = 'Transcripción no disponible.';
          }
        }

        return {
          ...file,
          id: video.id,
          transcriptionContent,
          transcriptionPath: video.transcription_path || '',
          videoTitle: video.video_title || '',
          audioPath: video.audio_path || '',
          summary: video.summary || '',
          order: parseInt(video.id) || 0,
          thumbnailLink: file.thumbnailLink || '',
          embedUrl: embedUrl,
          googleFileId: file.id,
        };
      }
      return null;
    });

    const completedData = await Promise.all(dataPromises);
    let data = completedData.filter((item) => item && item.videoTitle);
    data.sort((a, b) => b.order - a.order);

    return data;
  } catch (error) {
    console.error('Error in page-data compilation:', error);
    throw createError({ statusCode: 500, message: 'Internal Server Error' });
  }
});