import type { VercelRequest, VercelResponse } from '@vercel/node';
import { put } from '@vercel/blob';
import { requireAuth } from './_lib/auth';

// Disable Vercel's automatic body parsing so we receive the raw image bytes.
export const config = { api: { bodyParser: false } };

const ALLOWED_TYPES = new Set([
  'image/jpeg',
  'image/jpg',
  'image/png',
  'image/webp',
  'image/heic',
  'image/heif',
]);

const MAX_BYTES = 6 * 1024 * 1024; // 6MB safety cap; phone photos rarely exceed this

function readRawBody(req: VercelRequest): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    let total = 0;
    req.on('data', (chunk: Buffer) => {
      total += chunk.length;
      if (total > MAX_BYTES) {
        reject(new Error('payload too large'));
        return;
      }
      chunks.push(chunk);
    });
    req.on('end', () => resolve(Buffer.concat(chunks)));
    req.on('error', reject);
  });
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ error: 'method not allowed' });
  }
  if (!requireAuth(req, res)) return;

  const contentType = String(req.headers['content-type'] || '').toLowerCase();
  const baseType = contentType.split(';')[0].trim();
  if (!ALLOWED_TYPES.has(baseType)) {
    return res.status(415).json({ error: 'unsupported content type', got: baseType });
  }

  let body: Buffer;
  try {
    body = await readRawBody(req);
  } catch (err: any) {
    return res.status(413).json({ error: err?.message || 'failed to read body' });
  }

  if (body.length === 0) {
    return res.status(400).json({ error: 'empty body' });
  }

  const ext = baseType.split('/')[1] || 'bin';
  const sessionId = typeof req.query.sessionId === 'string' ? req.query.sessionId : 'unknown';
  const safeSession = sessionId.replace(/[^a-zA-Z0-9_-]/g, '');
  const filename = `sessions/${safeSession}/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;

  try {
    const blob = await put(filename, body, {
      access: 'public',
      contentType: baseType,
      addRandomSuffix: false,
    });
    return res.status(200).json({ url: blob.url, pathname: blob.pathname });
  } catch (err: any) {
    return res.status(500).json({ error: 'blob upload failed', detail: err?.message });
  }
}
