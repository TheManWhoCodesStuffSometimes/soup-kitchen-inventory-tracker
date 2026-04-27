import type { VercelRequest, VercelResponse } from '@vercel/node';
import { sql } from '../_lib/db';
import { requireAuth } from '../_lib/auth';

function generateFormId(): string {
  return `SK${new Date().toISOString().replace(/[-:.]/g, '')}`;
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (!requireAuth(req, res)) return;

  if (req.method === 'POST') {
    const body = (req.body ?? {}) as { userLabel?: string };
    const formId = generateFormId();
    const rows = await sql`
      INSERT INTO sessions (form_id, user_label)
      VALUES (${formId}, ${body.userLabel ?? null})
      RETURNING id, form_id, status, started_at, ended_at, total_items, total_weight_lbs, user_label
    `;
    return res.status(201).json(rows[0]);
  }

  if (req.method === 'GET') {
    const limit = Math.min(Number(req.query.limit) || 50, 200);
    const status = typeof req.query.status === 'string' ? req.query.status : null;
    const rows = status
      ? await sql`
          SELECT id, form_id, status, started_at, ended_at, total_items, total_weight_lbs, user_label
          FROM sessions WHERE status = ${status}
          ORDER BY started_at DESC LIMIT ${limit}
        `
      : await sql`
          SELECT id, form_id, status, started_at, ended_at, total_items, total_weight_lbs, user_label
          FROM sessions
          ORDER BY started_at DESC LIMIT ${limit}
        `;
    return res.status(200).json(rows);
  }

  res.setHeader('Allow', 'GET, POST');
  return res.status(405).json({ error: 'method not allowed' });
}
