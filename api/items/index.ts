import type { VercelRequest, VercelResponse } from '@vercel/node';
import { sql } from '../_lib/db';
import { requireAuth } from '../_lib/auth';

interface CreateItemBody {
  sessionId: string;
  donorName?: string;
  donorCustom?: string;
  photoUrls?: string[];
  // Optional manual-entry fields if user bypassed the cascade
  description?: string;
  foodType?: string;
  soupKitchenCategory?: string;
  weightLbs?: number;
  weightSource?: string;
  quantity?: number;
  expirationDate?: string;
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (!requireAuth(req, res)) return;

  if (req.method === 'POST') {
    const body = (req.body ?? {}) as CreateItemBody;
    if (!body.sessionId) return res.status(400).json({ error: 'sessionId required' });

    // Look up the session to confirm it exists + grab form_id and next item_index
    const sessionRows = await sql`
      SELECT id, form_id, status FROM sessions WHERE id = ${body.sessionId}
    `;
    if (sessionRows.length === 0) return res.status(404).json({ error: 'session not found' });
    const session = sessionRows[0];
    if (session.status !== 'active') {
      return res.status(409).json({ error: 'session is not active' });
    }

    const indexRows = await sql`
      SELECT COALESCE(MAX(item_index), -1) + 1 AS next_index
      FROM items WHERE session_id = ${body.sessionId}
    `;
    const itemIndex = indexRows[0].next_index;

    // If manual fields were supplied, mark resolved immediately. Otherwise processing.
    const hasManualData = !!(body.description || body.foodType || body.weightLbs);
    const initialStatus = hasManualData ? 'resolved' : 'processing';
    const weightSource = body.weightSource ?? (hasManualData ? 'manual' : null);

    const itemRows = await sql`
      INSERT INTO items (
        session_id, form_id, item_index, status,
        donor_name, donor_custom,
        description, food_type, soup_kitchen_category,
        weight_lbs, weight_source, quantity, expiration_date
      )
      VALUES (
        ${body.sessionId}, ${session.form_id}, ${itemIndex}, ${initialStatus},
        ${body.donorName ?? null}, ${body.donorCustom ?? null},
        ${body.description ?? null}, ${body.foodType ?? null}, ${body.soupKitchenCategory ?? null},
        ${body.weightLbs ?? null}, ${weightSource}, ${body.quantity ?? null}, ${body.expirationDate ?? null}
      )
      RETURNING *
    `;
    const item = itemRows[0];

    // Insert photo rows if URLs were provided
    const urls = Array.isArray(body.photoUrls) ? body.photoUrls.filter(u => typeof u === 'string') : [];
    if (urls.length > 0) {
      for (let i = 0; i < urls.length; i++) {
        await sql`
          INSERT INTO photos (item_id, blob_url, photo_index)
          VALUES (${item.id}, ${urls[i]}, ${i})
        `;
      }
    }

    // Fire the cascade if photos were attached and no manual data was supplied.
    // Fire-and-forget: we don't block the response on n8n.
    if (urls.length > 0 && !hasManualData) {
      const cascadeUrl = process.env.N8N_CASCADE_WEBHOOK_URL;
      const cascadeSecret = process.env.N8N_CASCADE_WEBHOOK_SECRET;
      if (cascadeUrl && cascadeSecret) {
        fetch(cascadeUrl, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'x-webhook-secret': cascadeSecret,
          },
          body: JSON.stringify({
            itemId: item.id,
            sessionId: body.sessionId,
            donorName: body.donorName,
            donorCustom: body.donorCustom,
            photoUrls: urls,
          }),
        }).catch(err => {
          console.error('cascade webhook trigger failed:', err);
        });
      }
    }

    return res.status(201).json({ ...item, photo_urls: urls });
  }

  if (req.method === 'GET') {
    const sessionId = typeof req.query.sessionId === 'string' ? req.query.sessionId : null;
    const status = typeof req.query.status === 'string' ? req.query.status : null;
    const limit = Math.min(Number(req.query.limit) || 100, 500);

    let rows: any[];
    if (sessionId && status) {
      rows = await sql`
        SELECT i.*, COALESCE(json_agg(p.blob_url ORDER BY p.photo_index) FILTER (WHERE p.id IS NOT NULL), '[]') AS photo_urls
        FROM items i LEFT JOIN photos p ON p.item_id = i.id
        WHERE i.session_id = ${sessionId} AND i.status = ${status}
        GROUP BY i.id ORDER BY i.item_index ASC LIMIT ${limit}
      `;
    } else if (sessionId) {
      rows = await sql`
        SELECT i.*, COALESCE(json_agg(p.blob_url ORDER BY p.photo_index) FILTER (WHERE p.id IS NOT NULL), '[]') AS photo_urls
        FROM items i LEFT JOIN photos p ON p.item_id = i.id
        WHERE i.session_id = ${sessionId}
        GROUP BY i.id ORDER BY i.item_index ASC LIMIT ${limit}
      `;
    } else if (status) {
      rows = await sql`
        SELECT i.*, COALESCE(json_agg(p.blob_url ORDER BY p.photo_index) FILTER (WHERE p.id IS NOT NULL), '[]') AS photo_urls
        FROM items i LEFT JOIN photos p ON p.item_id = i.id
        WHERE i.status = ${status}
        GROUP BY i.id ORDER BY i.created_at DESC LIMIT ${limit}
      `;
    } else {
      rows = await sql`
        SELECT i.*, COALESCE(json_agg(p.blob_url ORDER BY p.photo_index) FILTER (WHERE p.id IS NOT NULL), '[]') AS photo_urls
        FROM items i LEFT JOIN photos p ON p.item_id = i.id
        GROUP BY i.id ORDER BY i.created_at DESC LIMIT ${limit}
      `;
    }
    return res.status(200).json(rows);
  }

  res.setHeader('Allow', 'GET, POST');
  return res.status(405).json({ error: 'method not allowed' });
}
