import { google } from 'googleapis';

export async function fetchFiles(folderId) {
  // Read from Nuxt runtime config instead of a local JSON file
  const config = useRuntimeConfig();
  
  const clientEmail = config.googleClientEmail;
  // Replace escaped newlines (\\n) that occur when setting env vars in Vercel/Docker
  const privateKey = config.googlePrivateKey ? config.googlePrivateKey.replace(/\\n/g, '\n') : '';

  if (!clientEmail || !privateKey) {
    throw new Error('Google Drive API credentials are not set in the environment variables.');
  }

  const jwtClient = new google.auth.JWT(
    clientEmail,
    null,
    privateKey,
    [
      'https://www.googleapis.com/auth/drive',
      'https://www.googleapis.com/auth/drive.file',
      'https://www.googleapis.com/auth/drive.readonly',
    ],
    'desarrollo.tecnologico@casitaiedis.edu.mx'
  );

  await jwtClient.authorize();

  const drive = google.drive({ version: 'v3', auth: jwtClient });

  const response = await drive.files.list({
    q: `'${folderId}' in parents`,
    includeItemsFromAllDrives: true,
    supportsAllDrives: true,
    corpora: 'allDrives',
    // Added 'createdTime' to the fields array
    fields: 'nextPageToken, files(id, name, thumbnailLink, createdTime)',
    spaces: 'drive',
  });

  return response.data.files;
}