import type { VercelRequest, VercelResponse } from '@vercel/node';
import { timingSafeEqual } from 'node:crypto';
import { issueSessionCookie } from './_lib/auth';

export default function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ error: 'method not allowed' });
  }

  const expected = process.env.APP_PASSWORD;
  if (!expected) {
    return res.status(500).json({ error: 'APP_PASSWORD not configured' });
  }

  const body = (req.body ?? {}) as { password?: string };
  const provided = typeof body.password === 'string' ? body.password : '';

  // Constant-time compare with length check.
  if (provided.length !== expected.length) {
    return res.status(401).json({ error: 'invalid password' });
  }
  let ok = false;
  try {
    ok = timingSafeEqual(Buffer.from(provided), Buffer.from(expected));
  } catch {
    ok = false;
  }
  if (!ok) {
    return res.status(401).json({ error: 'invalid password' });
  }

  res.setHeader('Set-Cookie', issueSessionCookie());
  return res.status(200).json({ ok: true });
}
