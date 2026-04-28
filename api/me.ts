import type { VercelRequest, VercelResponse } from '@vercel/node';
import { isAuthed } from './_lib/auth';
import { handle } from './_lib/handle';

export default handle((req: VercelRequest, res: VercelResponse) => {
  // If SESSION_SECRET is missing, isAuthed throws via getSecret(). We
  // surface that here so the frontend can show a useful message.
  if (!process.env.SESSION_SECRET || process.env.SESSION_SECRET.length < 16) {
    return res.status(200).json({ authed: false, configError: 'SESSION_SECRET missing or too short' });
  }
  return res.status(200).json({ authed: isAuthed(req) });
});
