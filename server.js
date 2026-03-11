// server.js

const express = require('express');
const axios = require('axios');
const path = require('path');
const app = express();
const port = 2345; // Updated port to 2345

// Include required modules
const mysql2 = require('mysql2/promise');
const OpenAI = require('openai');
const { google } = require('googleapis'); // Included googleapis dependency
const fs = require('fs').promises;

// Load environment variables (you can use dotenv or set them in your environment)
require('dotenv').config();

// Database configuration
const dbConfig = {
  host: 'localhost',
  user: 'root',
  password: 'Nicole10*', // Use environment variable or placeholder
  database: 'casitaiedis',
  supportBigNumbers: true,
  bigNumberStrings: true,
};

const casitaiedis = mysql2.createPool(dbConfig);

// OpenAI configuration
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY, // Ensure you set your API key in an environment variable
});

// Set EJS as templating engine
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));

// Parse JSON and URL-encoded data
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Serve static files from /public
app.use(express.static(path.join(__dirname, 'public')));

// Routes

// Fetch videos endpoint
app.get('/videos', async (req, res) => {
  try {
    // Connect to the database and execute the query
    const [rows] = await casitaiedis.query('SELECT * FROM videos ORDER BY id');

    // Transform the data into the desired format
    const transformedData = rows.reduce((acc, row) => {
      // Normalize the audio_path by replacing all backslashes with forward slashes
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

    // Send the transformed data as a response
    res.json(transformedData);
  } catch (error) {
    console.error('Error fetching videos:', error);
    res.status(500).send('Internal Server Error');
  }
});

// Fetch videos list endpoint (renamed from /family to /videos-list)
app.get('/videos-list/:folderId?', async (req, res) => {
  const folderId = req.params.folderId || '1h3znz6TMa8hNskIyoBIzHFgYOS1X76bZ';

  try {
    const files = await fetchFiles(folderId);
    res.json({ files });
  } catch (error) {
    console.error('Error fetching files:', error);
    res.status(500).send('Internal Server Error');
  }
});

async function fetchFiles(folderId) {
  const content = await fs.readFile('credentials.json', 'utf8');
  const auth = JSON.parse(content);

  const jwtClient = new google.auth.JWT(
    auth.client_email,
    null,
    auth.private_key,
    [
      'https://www.googleapis.com/auth/drive',
      'https://www.googleapis.com/auth/drive.file',
      'https://www.googleapis.com/auth/drive.readonly',
    ],
    'desarrollo.tecnologico@casitaiedis.edu.mx'
  );

  await jwtClient.authorize();

  const drive = google.drive({
    version: 'v3',
    auth: jwtClient,
  });

  const response = await drive.files.list({
    q: `'${folderId}' in parents`,
    includeItemsFromAllDrives: true,
    supportsAllDrives: true,
    corpora: 'allDrives',
    fields: 'nextPageToken, files(id, name, thumbnailLink)',
    spaces: 'drive',
  });

  return response.data.files;
}

// Endpoint to regenerate summary using GPT
app.post('/regenerate-summary', async (req, res) => {
  const { videoId, prompt } = req.body;

  try {
    // Fetch the transcription content for the video
    const [videoRows] = await casitaiedis.query('SELECT * FROM videos WHERE id = ?', [videoId]);
    if (videoRows.length === 0) {
      return res.status(404).send('Video not found.');
    }
    const video = videoRows[0];

    // Fetch the transcription content
    let transcriptionContent = '';
    if (video.transcription_path) {
      const transcriptionResponse = await axios.get(`https://wweb.casitaapps.com/${video.transcription_path}`);
      transcriptionContent = transcriptionResponse.data;
    } else {
      transcriptionContent = 'Transcripción no disponible.';
    }

    // Generate summary using OpenAI GPT
    const gptResponse = await askGPT(`${prompt}\n\n${transcriptionContent}`);

    // Update the summary in the database
    await casitaiedis.query('UPDATE videos SET summary = ? WHERE id = ?', [gptResponse, videoId]);

    // Send the new summary back to the client
    res.json({ summary: gptResponse });
  } catch (error) {
    console.error('Error regenerating summary:', error);
    res.status(500).send('Internal Server Error');
  }
});

// Function to interact with OpenAI GPT
async function askGPT(prompt, model = 'gpt-4o', options = {}) {
  // Merging additional options into the request
  const requestOptions = {
    model: model,
    messages: [{ role: 'user', content: prompt }],
    ...options, // Spread operator to merge options into the request
  };

  try {
    const response = await openai.chat.completions.create(requestOptions);

    if (response.choices && response.choices.length > 0) {
      return response.choices[0].message.content.trim();
    } else {
      throw new Error('No response from OpenAI API.');
    }
  } catch (error) {
    console.error('Error interacting with OpenAI API:', error);
    throw error;
  }
}

// Main route to render the page
app.get('/', async (req, res) => {
  try {
    const folderId = '1F4wnrmyzGyrFyLALvBQ39MgJt242woU5';
    const rootTranscriptionPath = 'https://wweb.casitaapps.com';

    // Fetch data from local endpoints
    const [filesResponse, videoDataResponse] = await Promise.all([
      axios.get(`http://localhost:${port}/videos-list/${folderId}`),
      axios.get(`http://localhost:${port}/videos`),
    ]);

    const familyFiles = filesResponse.data.files;
    const videoDict = videoDataResponse.data;

    // Prepare data
    const dataPromises = familyFiles.map(async (file) => {
      const video = videoDict[file.id]; // Corresponding video data
      if (video) {
        // Construct the embeddable URL for the video
        const fileId = file.id;
        const embedUrl = `https://drive.google.com/file/d/${fileId}/preview`;

        // Fetch the transcription content if available
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
      } else {
        return null;
      }
    });

    const completedData = await Promise.all(dataPromises);

    // Filter and sort data
    let data = completedData.filter((item) => item && item.videoTitle);
    data.sort((a, b) => b.order - a.order);

    // Set meta tags
    let meta = {
      title: 'Programa de Formación Casita del Saber',
      description: 'Descripción del último resumen',
      image: '/img/IECS-FULL.png',
    };

    if (data.length > 0) {
      const lastItem = data[0];
      meta.title = lastItem.videoTitle;
      meta.description = lastItem.summary;
      meta.image = lastItem.thumbnailLink;
    }

    res.render('index', {
      data: data,
      meta: meta,
    });
  } catch (error) {
    console.error('Error rendering page:', error);
    res.status(500).send('Internal Server Error');
  }
});

app.listen(port, () => {
  console.log(`Server is running at http://localhost:${port}`);
});
