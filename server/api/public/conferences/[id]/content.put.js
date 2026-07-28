import { getPool } from '../../../../utils/db.js';
import { hasText } from '../../../../utils/content.js';
import {
  deleteDriveFile,
  writeDriveText,
} from '../../../../utils/drive.js';
import { envValue } from '../../../../utils/env.js';
import {
  conferenceIdFromEvent,
  contentAvailability,
  requireContentWriteAccess,
} from '../../../../utils/public-content-api.js';

const WRITABLE_FIELDS = new Set(['summary', 'transcript']);

function transcriptFileName(id) {
  return `conference-${id}-transcript.txt`;
}

export default defineEventHandler(async (event) => {
  requireContentWriteAccess(event);

  const id = conferenceIdFromEvent(event);
  const body = await readBody(event);
  const field = String(body?.field || '').trim().toLowerCase();
  const content = body?.content;

  if (!WRITABLE_FIELDS.has(field)) {
    throw createError({
      statusCode: 400,
      statusMessage: 'Field must be summary or transcript',
    });
  }

  if (typeof content !== 'string' || !content.trim()) {
    throw createError({
      statusCode: 400,
      statusMessage: 'Content must be a non-empty string',
    });
  }

  const pool = getPool();
  const [rows] = await pool.query(
    `SELECT id, video_title, summary, transcription_path
     FROM videos
     WHERE id = ?
     LIMIT 1`,
    [id]
  );

  if (!rows.length) {
    throw createError({
      statusCode: 404,
      statusMessage: 'Conference not found',
    });
  }

  const row = rows[0];
  let summary = row.summary;
  let transcriptionPath = row.transcription_path;

  if (field === 'summary') {
    await pool.query(
      'UPDATE videos SET summary = ? WHERE id = ?',
      [content, id]
    );
    summary = content;
  } else {
    const config = useRuntimeConfig(event);
    const folderId = envValue(
      'GOOGLE_TRANSCRIPTS_FOLDER_ID',
      config.googleTranscriptsFolderId
    );
    let writeResult;

    try {
      writeResult = await writeDriveText(transcriptionPath, content, {
        fileName: transcriptFileName(id),
        folderId,
      });

      if (writeResult.reference !== transcriptionPath) {
        try {
          await pool.query(
            'UPDATE videos SET transcription_path = ? WHERE id = ?',
            [writeResult.reference, id]
          );
        } catch (error) {
          if (writeResult.created) {
            try {
              await deleteDriveFile(writeResult.fileId);
            } catch (cleanupError) {
              console.error('Failed to remove orphan transcript file:', cleanupError);
            }
          }
          throw error;
        }
      }
    } catch (error) {
      console.error(`Transcript write failed for conference ${id}:`, error);
      throw createError({
        statusCode: 502,
        statusMessage: 'Transcript could not be written',
      });
    }

    transcriptionPath = writeResult.reference;
  }

  return {
    id: String(row.id),
    title: String(row.video_title || '').trim() || 'Sin título',
    updated: field,
    characters: content.length,
    availability: contentAvailability(summary, transcriptionPath),
  };
});
