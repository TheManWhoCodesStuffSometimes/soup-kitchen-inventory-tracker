import { createHmac, timingSafeEqual } from 'node:crypto';
import type { VercelRequest, VercelResponse } from '@vercel/node';

const COOKIE_NAME = 'sk_session';
const COOKIE_MAX_AGE_DAYS = 30;

function getSecret(): string {
  const s = process.env.SESSION_SECRET;
  if (!s || s.length < 16) {
    throw new Error('SESSION_SECRET is missing or too short (need 16+ chars)');
  }
  return s;
}

function sign(payload: string): string {
  return createHmac('sha256', getSecret()).update(payload).digest('base64url');
}

export function issueSessionCookie(): string {
  const exp = Date.now() + COOKIE_MAX_AGE_DAYS * 24 * 60 * 60 * 1000;
  const payload = `${exp}`;
  const signature = sign(payload);
  const value = `${payload}.${signature}`;
  const maxAgeSec = COOKIE_MAX_AGE_DAYS * 24 * 60 * 60;
  return `${COOKIE_NAME}=${value}; Path=/; Max-Age=${maxAgeSec}; HttpOnly; Secure; SameSite=Lax`;
}

export function clearSessionCookie(): string {
  return `${COOKIE_NAME}=; Path=/; Max-Age=0; HttpOnly; Secure; SameSite=Lax`;
}

function parseCookies(header: string | undefined): Record<string, string> {
  if (!header) return {};
  const out: Record<string, string> = {};
  for (const part of header.split(';')) {
    const idx = part.indexOf('=');
    if (idx === -1) continue;
    const k = part.slice(0, idx).trim();
    const v = part.slice(idx + 1).trim();
    if (k) out[k] = decodeURIComponent(v);
  }
  return out;
}

export function isAuthed(req: VercelRequest): boolean {
  const cookies = parseCookies(req.headers.cookie);
  const raw = cookies[COOKIE_NAME];
  if (!raw) return false;
  const dot = raw.indexOf('.');
  if (dot === -1) return false;
  const payload = raw.slice(0, dot);
  const provided = raw.slice(dot + 1);
  const expected = sign(payload);
  if (provided.length !== expected.length) return false;
  try {
    if (!timingSafeEqual(Buffer.from(provided), Buffer.from(expected))) return false;
  } catch {
    return false;
  }
  const exp = Number(payload);
  if (!Number.isFinite(exp) || exp < Date.now()) return false;
  return true;
}

export function requireAuth(req: VercelRequest, res: VercelResponse): boolean {
  if (isAuthed(req)) return true;
  res.status(401).json({ error: 'unauthorized' });
  return false;
}

// Verify the shared secret used for n8n -> Vercel callbacks.
// Separate from the user session cookie because n8n is server-to-server.
export function requireWebhookSecret(req: VercelRequest, res: VercelResponse): boolean {
  const expected = process.env.N8N_CASCADE_WEBHOOK_SECRET;
  if (!expected) {
    res.status(500).json({ error: 'webhook secret not configured' });
    return false;
  }
  const provided = req.headers['x-webhook-secret'];
  const value = Array.isArray(provided) ? provided[0] : provided;
  if (!value || value.length !== expected.length) {
    res.status(401).json({ error: 'unauthorized' });
    return false;
  }
  try {
    if (!timingSafeEqual(Buffer.from(value), Buffer.from(expected))) {
      res.status(401).json({ error: 'unauthorized' });
      return false;
    }
  } catch {
    res.status(401).json({ error: 'unauthorized' });
    return false;
  }
  return true;
}
