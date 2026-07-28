import { google } from 'googleapis';
import { envValue } from './env.js';

const DRIVE_SCOPES = [
  'https://www.googleapis.com/auth/drive',
  'https://www.googleapis.com/auth/documents',
];

let googleAuth;
let driveClient;
let docsClient;

function normalizePrivateKey(raw) {
  const value = String(raw || '').trim();
  if (!value) return '';
  return value.includes('\\n') ? value.replace(/\\n/g, '\n') : value;
}

function getServiceAccountCredentials() {
  const clientEmail = envValue('GOOGLE_CLIENT_EMAIL') || envValue('GOOGLE_SERVICE_ACCOUNT_EMAIL');
  const privateKeyBase64 = envValue('GOOGLE_PRIVATE_KEY_BASE64');
  const privateKeyRaw = privateKeyBase64
    ? Buffer.from(privateKeyBase64, 'base64').toString('utf8')
    : envValue('GOOGLE_PRIVATE_KEY');
  const privateKey = normalizePrivateKey(privateKeyRaw);

  if (!clientEmail || !privateKey) {
    throw new Error(
      'Google Drive credentials are missing. Set GOOGLE_CLIENT_EMAIL and GOOGLE_PRIVATE_KEY_BASE64 in .env.'
    );
  }

  return { clientEmail, privateKey };
}

export function extractDriveFileId(value) {
  const raw = String(value || '').trim();
  if (!raw) return '';

  if (raw.startsWith('drive://')) {
    return raw.replace(/^drive:\/\//, '').split('/')[0] || '';
  }

  const drivePathMatch = raw.match(/\/file\/d\/([^/?#]+)/);
  if (drivePathMatch?.[1]) return drivePathMatch[1];

  const idQueryMatch = raw.match(/[?&]id=([^&#]+)/);
  if (idQueryMatch?.[1]) return idQueryMatch[1];

  if (/^[a-zA-Z0-9_-]{20,}$/.test(raw)) return raw;

  return '';
}

function streamToString(stream) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    stream.on('data', (chunk) => chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk)));
    stream.on('error', reject);
    stream.on('end', () => resolve(Buffer.concat(chunks).toString('utf8')));
  });
}

export async function getDriveClient() {
  if (driveClient) return driveClient;

  const auth = getGoogleAuth();

  driveClient = google.drive({ version: 'v3', auth });
  return driveClient;
}

function getGoogleAuth() {
  if (googleAuth) return googleAuth;

  const { clientEmail, privateKey } = getServiceAccountCredentials();
  googleAuth = new google.auth.JWT({
    email: clientEmail,
    key: privateKey,
    scopes: DRIVE_SCOPES,
  });

  return googleAuth;
}

function getDocsClient() {
  if (docsClient) return docsClient;
  docsClient = google.docs({ version: 'v1', auth: getGoogleAuth() });
  return docsClient;
}

export async function fetchFiles(folderId) {
  const drive = await getDriveClient();
  const files = [];
  let pageToken;

  do {
    const response = await drive.files.list({
      q: `'${folderId}' in parents and trashed = false`,
      includeItemsFromAllDrives: true,
      supportsAllDrives: true,
      corpora: 'allDrives',
      fields: 'nextPageToken, files(id, name, thumbnailLink, createdTime, mimeType)',
      spaces: 'drive',
      pageToken,
      pageSize: 1000,
    });

    files.push(...(response.data.files || []));
    pageToken = response.data.nextPageToken;
  } while (pageToken);

  return files;
}

export async function readDriveText(value) {
  const fileId = extractDriveFileId(value);
  if (!fileId) return '';

  const drive = await getDriveClient();
  const metadata = await drive.files.get({
    fileId,
    fields: 'id, name, mimeType',
    supportsAllDrives: true,
  });

  const mimeType = metadata.data.mimeType || '';
  const response = mimeType.startsWith('application/vnd.google-apps')
    ? await drive.files.export({ fileId, mimeType: 'text/plain' }, { responseType: 'stream' })
    : await drive.files.get({ fileId, alt: 'media', supportsAllDrives: true }, { responseType: 'stream' });

  return streamToString(response.data);
}

async function replaceGoogleDocumentText(fileId, content) {
  const docs = getDocsClient();
  const document = await docs.documents.get({ documentId: fileId });
  const bodyContent = document.data.body?.content || [];
  const endIndex = bodyContent.reduce(
    (maximum, element) => Math.max(maximum, Number(element.endIndex) || 0),
    0
  );
  const requests = [];

  if (endIndex > 2) {
    requests.push({
      deleteContentRange: {
        range: {
          startIndex: 1,
          endIndex: endIndex - 1,
        },
      },
    });
  }

  requests.push({
    insertText: {
      location: { index: 1 },
      text: content,
    },
  });

  await docs.documents.batchUpdate({
    documentId: fileId,
    requestBody: { requests },
  });
}

export async function writeDriveText(value, content, { fileName, folderId } = {}) {
  const existingFileId = extractDriveFileId(value);
  const drive = await getDriveClient();

  if (existingFileId) {
    const metadata = await drive.files.get({
      fileId: existingFileId,
      fields: 'id, mimeType',
      supportsAllDrives: true,
    });
    const mimeType = metadata.data.mimeType || '';

    if (mimeType === 'application/vnd.google-apps.document') {
      await replaceGoogleDocumentText(existingFileId, content);
    } else {
      if (mimeType.startsWith('application/vnd.google-apps')) {
        throw new Error(`Unsupported Google Drive transcript type: ${mimeType}`);
      }

      await drive.files.update({
        fileId: existingFileId,
        media: {
          mimeType: 'text/plain',
          body: content,
        },
        supportsAllDrives: true,
        fields: 'id',
      });
    }

    return {
      created: false,
      fileId: existingFileId,
      reference: String(value || '').trim() || `drive://${existingFileId}`,
    };
  }

  const destinationFolderId = String(folderId || '').trim();
  if (!destinationFolderId) {
    throw new Error('GOOGLE_TRANSCRIPTS_FOLDER_ID is required to create a transcript.');
  }

  const response = await drive.files.create({
    requestBody: {
      name: fileName || 'conference-transcript.txt',
      mimeType: 'text/plain',
      parents: [destinationFolderId],
    },
    media: {
      mimeType: 'text/plain',
      body: content,
    },
    supportsAllDrives: true,
    fields: 'id',
  });
  const fileId = response.data.id;

  if (!fileId) {
    throw new Error('Google Drive did not return a transcript file identifier.');
  }

  return {
    created: true,
    fileId,
    reference: `drive://${fileId}`,
  };
}

export async function deleteDriveFile(fileId) {
  if (!fileId) return;
  const drive = await getDriveClient();
  await drive.files.delete({
    fileId,
    supportsAllDrives: true,
  });
}
