import type { VercelRequest, VercelResponse } from '@vercel/node';
import { sql } from './_lib/db';
import { requireWebhookSecret } from './_lib/auth';

// Called by n8n when the cascade workflow finishes processing an item.
// Auth: shared secret in x-webhook-secret header (NOT the user cookie).
//
// Body shape:
// {
//   itemId: string,
//   status: 'resolved' | 'needs_review' | 'failed',
//   description?: string,
//   foodType?: string,
//   soupKitchenCategory?: string,
//   weightLbs?: number,
//   weightSource?: 'scale' | 'standard' | 'estimated',
//   quantity?: number,
//   expirationDate?: string,
//   estimatedValue?: number,
//   pricePerUnit?: number,
//   confidenceLevel?: string,
//   pricingSource?: string,
//   searchResultsSummary?: string,
//   pricingNotes?: string,
//   cascadeRaw?: object,
//   cascadeError?: string,
// }
export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ error: 'method not allowed' });
  }
  if (!requireWebhookSecret(req, res)) return;

  const body = (req.body ?? {}) as Record<string, any>;
  const itemId = body.itemId;
  if (!itemId || typeof itemId !== 'string') {
    return res.status(400).json({ error: 'itemId required' });
  }

  const allowedStatuses = ['resolved', 'needs_review', 'failed'];
  const status = allowedStatuses.includes(body.status) ? body.status : 'needs_review';

  const rows = await sql`
    UPDATE items SET
      status = ${status},
      description = COALESCE(${body.description ?? null}, description),
      food_type = COALESCE(${body.foodType ?? null}, food_type),
      soup_kitchen_category = COALESCE(${body.soupKitchenCategory ?? null}, soup_kitchen_category),
      weight_lbs = COALESCE(${body.weightLbs ?? null}, weight_lbs),
      weight_source = COALESCE(${body.weightSource ?? null}, weight_source),
      quantity = COALESCE(${body.quantity ?? null}, quantity),
      expiration_date = COALESCE(${body.expirationDate ?? null}, expiration_date),
      estimated_value = COALESCE(${body.estimatedValue ?? null}, estimated_value),
      price_per_unit = COALESCE(${body.pricePerUnit ?? null}, price_per_unit),
      confidence_level = COALESCE(${body.confidenceLevel ?? null}, confidence_level),
      pricing_source = COALESCE(${body.pricingSource ?? null}, pricing_source),
      search_results_summary = COALESCE(${body.searchResultsSummary ?? null}, search_results_summary),
      pricing_notes = COALESCE(${body.pricingNotes ?? null}, pricing_notes),
      cascade_raw = COALESCE(${body.cascadeRaw ? JSON.stringify(body.cascadeRaw) : null}::jsonb, cascade_raw),
      cascade_run_at = now(),
      cascade_attempts = cascade_attempts + 1,
      cascade_error = ${body.cascadeError ?? null}
    WHERE id = ${itemId}
    RETURNING id, status
  `;

  if (rows.length === 0) return res.status(404).json({ error: 'item not found' });
  return res.status(200).json({ ok: true, item: rows[0] });
}
