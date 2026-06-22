import { extractDriveFileId, readDriveText } from './drive.js';
import axios from 'axios';

const LEGACY_TEXT_ROOT = 'https://wweb.casitaapps.com';

export function hasText(value) {
  return String(value || '').trim().length > 0;
}

export function toPublicLegacyAssetUrl(value) {
  const raw = String(value || '').trim();
  if (!raw) return '';
  if (/^https?:\/\//i.test(raw)) return raw;
  if (raw.startsWith('drive://')) return '';
  return `${LEGACY_TEXT_ROOT}/${raw.replace(/\\/g, '/').replace(/^\/+/, '')}`;
}

export async function readStoredPlainText(value) {
  const raw = String(value || '').trim();
  if (!raw) return '';

  if (raw.startsWith('drive://') || extractDriveFileId(raw)) {
    try {
      return await readDriveText(raw);
    } catch (error) {
      console.error(`Drive text read failed for ${raw}:`, error.message);
      return '';
    }
  }

  const url = /^https?:\/\//i.test(raw)
    ? raw
    : `${LEGACY_TEXT_ROOT}/${raw.replace(/\\/g, '/').replace(/^\/+/, '')}`;

  try {
    const response = await axios.get(url, { responseType: 'text' });
    return String(response.data || '');
  } catch (error) {
    console.error(`Legacy text read failed for ${url}:`, error.message);
    return '';
  }
}
