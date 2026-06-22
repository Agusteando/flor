import { google } from 'googleapis';
import { envValue } from './env.js';

const DRIVE_READONLY_SCOPES = ['https://www.googleapis.com/auth/drive.readonly'];

let driveClient;

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

  const { clientEmail, privateKey } = getServiceAccountCredentials();
  const auth = new google.auth.JWT({
    email: clientEmail,
    key: privateKey,
    scopes: DRIVE_READONLY_SCOPES,
  });

  driveClient = google.drive({ version: 'v3', auth });
  return driveClient;
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
