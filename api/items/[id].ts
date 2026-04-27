import type { VercelRequest, VercelResponse } from '@vercel/node';
import { sql } from '../_lib/db';
import { requireAuth } from '../_lib/auth';

interface PatchItemBody {
  status?: string;
  description?: string;
  foodType?: string;
  soupKitchenCategory?: string;
  weightLbs?: number;
  weightSource?: string;
  quantity?: number;
  expirationDate?: string;
  estimatedValue?: number;
  pricePerUnit?: number;
  donorName?: string;
  donorCustom?: string;
}

const ALLOWED_STATUSES = ['processing', 'resolved', 'needs_review', 'approved', 'failed'];

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (!requireAuth(req, res)) return;

  const id = typeof req.query.id === 'string' ? req.query.id : '';
  if (!id) return res.status(400).json({ error: 'missing id' });

  if (req.method === 'GET') {
    const rows = await sql`
      SELECT i.*, COALESCE(json_agg(p.blob_url ORDER BY p.photo_index) FILTER (WHERE p.id IS NOT NULL), '[]') AS photo_urls
      FROM items i LEFT JOIN photos p ON p.item_id = i.id
      WHERE i.id = ${id}
      GROUP BY i.id
    `;
    if (rows.length === 0) return res.status(404).json({ error: 'not found' });
    return res.status(200).json(rows[0]);
  }

  if (req.method === 'PATCH') {
    const body = (req.body ?? {}) as PatchItemBody;
    if (body.status && !ALLOWED_STATUSES.includes(body.status)) {
      return res.status(400).json({ error: 'invalid status' });
    }

    const rows = await sql`
      UPDATE items SET
        status = COALESCE(${body.status ?? null}, status),
        description = COALESCE(${body.description ?? null}, description),
        food_type = COALESCE(${body.foodType ?? null}, food_type),
        soup_kitchen_category = COALESCE(${body.soupKitchenCategory ?? null}, soup_kitchen_category),
        weight_lbs = COALESCE(${body.weightLbs ?? null}, weight_lbs),
        weight_source = COALESCE(${body.weightSource ?? null}, weight_source),
        quantity = COALESCE(${body.quantity ?? null}, quantity),
        expiration_date = COALESCE(${body.expirationDate ?? null}, expiration_date),
        estimated_value = COALESCE(${body.estimatedValue ?? null}, estimated_value),
        price_per_unit = COALESCE(${body.pricePerUnit ?? null}, price_per_unit),
        donor_name = COALESCE(${body.donorName ?? null}, donor_name),
        donor_custom = COALESCE(${body.donorCustom ?? null}, donor_custom)
      WHERE id = ${id}
      RETURNING *
    `;
    if (rows.length === 0) return res.status(404).json({ error: 'not found' });
    return res.status(200).json(rows[0]);
  }

  if (req.method === 'DELETE') {
    const rows = await sql`DELETE FROM items WHERE id = ${id} RETURNING id`;
    if (rows.length === 0) return res.status(404).json({ error: 'not found' });
    return res.status(200).json({ ok: true });
  }

  res.setHeader('Allow', 'GET, PATCH, DELETE');
  return res.status(405).json({ error: 'method not allowed' });
}
