import type { VercelRequest, VercelResponse } from '@vercel/node';
import { sql } from '../_lib/db';
import { requireAuth } from '../_lib/auth';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (!requireAuth(req, res)) return;

  const id = typeof req.query.id === 'string' ? req.query.id : '';
  if (!id) return res.status(400).json({ error: 'missing id' });

  if (req.method === 'GET') {
    const sessionRows = await sql`
      SELECT id, form_id, status, started_at, ended_at, total_items, total_weight_lbs, user_label
      FROM sessions WHERE id = ${id}
    `;
    if (sessionRows.length === 0) return res.status(404).json({ error: 'not found' });
    const itemRows = await sql`
      SELECT * FROM items WHERE session_id = ${id} ORDER BY item_index ASC
    `;
    return res.status(200).json({ ...sessionRows[0], items: itemRows });
  }

  if (req.method === 'PATCH') {
    const body = (req.body ?? {}) as { status?: string; userLabel?: string };
    const allowedStatuses = ['active', 'finalized', 'abandoned'];

    if (body.status && !allowedStatuses.includes(body.status)) {
      return res.status(400).json({ error: 'invalid status' });
    }

    // Recompute totals on finalize so the summary reflects resolved/approved items
    if (body.status === 'finalized') {
      const totals = await sql`
        SELECT
          COALESCE(SUM(quantity), 0)::int AS total_items,
          COALESCE(SUM(weight_lbs * quantity), 0)::numeric(10,2) AS total_weight_lbs
        FROM items
        WHERE session_id = ${id} AND status IN ('resolved','approved')
      `;
      const t = totals[0] ?? { total_items: 0, total_weight_lbs: 0 };
      const rows = await sql`
        UPDATE sessions
        SET status = 'finalized',
            ended_at = now(),
            total_items = ${t.total_items},
            total_weight_lbs = ${t.total_weight_lbs}
        WHERE id = ${id}
        RETURNING *
      `;
      return res.status(200).json(rows[0]);
    }

    const rows = await sql`
      UPDATE sessions
      SET status = COALESCE(${body.status ?? null}, status),
          user_label = COALESCE(${body.userLabel ?? null}, user_label)
      WHERE id = ${id}
      RETURNING *
    `;
    if (rows.length === 0) return res.status(404).json({ error: 'not found' });
    return res.status(200).json(rows[0]);
  }

  res.setHeader('Allow', 'GET, PATCH');
  return res.status(405).json({ error: 'method not allowed' });
}
