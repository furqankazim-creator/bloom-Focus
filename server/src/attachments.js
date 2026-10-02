import path from 'node:path';
import { fileTypeFromBuffer } from 'file-type';
import jwt from 'jsonwebtoken';
import mongoose from 'mongoose';
import multer from 'multer';
import { HttpError } from './auth.js';
import { config } from './config.js';

export const MAX_FILES = 5;
export const MAX_FILE_BYTES = 15 * 1024 * 1024;
const LINK_TTL = '1h';

/** Files are buffered in memory (bounded by the limits) and then written to MongoDB GridFS. */
export const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: MAX_FILE_BYTES, files: MAX_FILES, fields: 10, fieldSize: 20_000 },
});

const bucket = () => new mongoose.mongo.GridFSBucket(mongoose.connection.db, { bucketName: 'attachments' });

// Allowed types, keyed by the type detected from the file's bytes (never trusted from the client).
const DETECTED = {
  'image/jpeg': 'image',
  'image/png': 'image',
  'image/gif': 'image',
  'image/webp': 'image',
  'image/heic': 'image',
  'image/heif': 'image',
  'audio/x-m4a': 'audio',
  'audio/mp4': 'audio',
  'audio/aac': 'audio',
  'audio/mpeg': 'audio',
  'audio/wav': 'audio',
  'audio/ogg': 'audio',
  'audio/webm': 'audio',
  'application/pdf': 'file',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document': 'file',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': 'file',
  'application/vnd.openxmlformats-officedocument.presentationml.presentation': 'file',
};
// Voice recorders write MP4/WebM containers that byte sniffing reports as video.
const AUDIO_CONTAINERS = { 'video/mp4': 'audio/mp4', 'video/webm': 'audio/webm', 'video/quicktime': 'audio/mp4' };

async function classify(file) {
  const detected = await fileTypeFromBuffer(file.buffer);
  if (detected && DETECTED[detected.mime]) return { kind: DETECTED[detected.mime], mimeType: detected.mime };
  if (detected && AUDIO_CONTAINERS[detected.mime] && file.mimetype.startsWith('audio/')) {
    return { kind: 'audio', mimeType: AUDIO_CONTAINERS[detected.mime] };
  }
  // Plain text has no signature: accept it only if it looks like text.
  if (!detected && file.mimetype === 'text/plain' && !file.buffer.includes(0)) {
    return { kind: 'file', mimeType: 'text/plain' };
  }
  throw new HttpError(415, 'Only photos, voice notes, PDFs, Office documents and text files can be attached');
}

function cleanName(name, fallback) {
  const base = path.basename(String(name ?? '')).replace(/[\u0000-\u001f\u007f"\\/]/g, '').trim();
  return (base || fallback).slice(0, 120);
}

/** Validates and stores one uploaded file; returns the attachment record kept on the message. */
export async function storeAttachment(file, meta, owner) {
  const { kind, mimeType } = await classify(file);
  const name = cleanName(file.originalname, kind === 'audio' ? 'Voice note' : kind === 'image' ? 'Photo' : 'File');
  const durationMs = Number.isFinite(meta?.durationMs) ? Math.min(Math.max(0, Math.round(meta.durationMs)), 3_600_000) : undefined;
  const id = new mongoose.Types.ObjectId();
  await new Promise((resolve, reject) => {
    bucket()
      .openUploadStreamWithId(id, name, { metadata: { ...owner, mimeType } })
      .on('error', reject)
      .on('finish', resolve)
      .end(file.buffer);
  });
  return { fileId: id, kind, mimeType, name, size: file.size, durationMs };
}

export async function deleteAttachment(fileId) {
  await bucket().delete(fileId).catch(() => {});
}

/** Short-lived download link, so <Image> and audio players can load files without auth headers. */
export function signedFileUrl(fileId) {
  const token = jwt.sign({ typ: 'file', fid: fileId.toString() }, config.jwtSecret, { expiresIn: LINK_TTL });
  return `/files/${fileId}?t=${token}`;
}

/** GET /files/:id?t=… — streams a file, with Range support (iOS audio playback needs it). */
export async function serveFile(req, res) {
  let payload;
  try {
    payload = jwt.verify(String(req.query.t ?? ''), config.jwtSecret);
  } catch {
    throw new HttpError(403, 'This link has expired. Reopen the conversation.');
  }
  if (payload.typ !== 'file' || payload.fid !== req.params.id || !mongoose.isValidObjectId(req.params.id)) {
    throw new HttpError(403, 'Invalid link');
  }
  const id = new mongoose.Types.ObjectId(req.params.id);
  const [file] = await bucket().find({ _id: id }).limit(1).toArray();
  if (!file) throw new HttpError(404, 'File not found');

  const mimeType = file.metadata?.mimeType ?? 'application/octet-stream';
  const inline = mimeType.startsWith('image/') || mimeType.startsWith('audio/');
  res.set({
    'Content-Type': mimeType,
    'Accept-Ranges': 'bytes',
    'Cache-Control': 'private, max-age=3600',
    'Content-Disposition': `${inline ? 'inline' : 'attachment'}; filename*=UTF-8''${encodeURIComponent(file.filename)}`,
    'Cross-Origin-Resource-Policy': 'cross-origin',
  });

  let start = 0;
  let end = file.length - 1;
  const range = /^bytes=(\d*)-(\d*)$/.exec(req.get('range') ?? '');
  if (range && file.length > 0) {
    start = range[1] ? Number(range[1]) : Math.max(0, file.length - Number(range[2]));
    end = range[1] && range[2] ? Math.min(Number(range[2]), file.length - 1) : file.length - 1;
    if (start > end || start >= file.length) {
      res.status(416).set('Content-Range', `bytes */${file.length}`).end();
      return;
    }
    res.status(206).set('Content-Range', `bytes ${start}-${end}/${file.length}`);
  }
  res.set('Content-Length', String(file.length === 0 ? 0 : end - start + 1));
  if (file.length === 0) return res.end();
  bucket()
    .openDownloadStream(id, { start, end: end + 1 })
    .on('error', () => res.destroy())
    .pipe(res);
}
