import { timingSafeEqual } from 'node:crypto';
import { envValue } from './env.js';
import { hasText } from './content.js';

export function conferenceIdFromEvent(event) {
  const id = String(getRouterParam(event, 'id') || '').trim();

  if (!/^[1-9]\d*$/.test(id)) {
    throw createError({
      statusCode: 400,
      statusMessage: 'Invalid conference identifier',
    });
  }

  return id;
}

export function contentAvailability(summary, transcript) {
  return {
    summary: hasText(summary),
    transcript: hasText(transcript),
  };
}

export function requireContentWriteAccess(event) {
  const config = useRuntimeConfig(event);
  const expectedKey = envValue('CONTENT_API_WRITE_KEY', config.contentApiWriteKey);

  if (!expectedKey) {
    throw createError({
      statusCode: 503,
      statusMessage: 'Content write API is not configured',
    });
  }

  const authorization = String(getHeader(event, 'authorization') || '');
  const match = authorization.match(/^Bearer\s+(.+)$/i);
  const providedKey = match?.[1]?.trim() || '';
  const expected = Buffer.from(expectedKey);
  const provided = Buffer.from(providedKey);
  const authorized = expected.length === provided.length
    && expected.length > 0
    && timingSafeEqual(expected, provided);

  if (!authorized) {
    setHeader(event, 'WWW-Authenticate', 'Bearer');
    throw createError({
      statusCode: 401,
      statusMessage: 'Unauthorized',
    });
  }
}
