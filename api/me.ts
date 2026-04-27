import type { VercelRequest, VercelResponse } from '@vercel/node';
import { isAuthed } from './_lib/auth';

export default function handler(req: VercelRequest, res: VercelResponse) {
  return res.status(200).json({ authed: isAuthed(req) });
}
