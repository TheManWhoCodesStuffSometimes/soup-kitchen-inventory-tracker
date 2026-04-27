// Client for the Vercel API routes (/api/*).
// All requests include credentials so the auth cookie is sent.

export interface SessionRow {
  id: string;
  form_id: string;
  status: 'active' | 'finalized' | 'abandoned';
  user_label: string | null;
  total_items: number;
  total_weight_lbs: number;
  started_at: string;
  ended_at: string | null;
}

export interface ItemRow {
  id: string;
  session_id: string;
  form_id: string;
  item_index: number;
  status: 'processing' | 'resolved' | 'needs_review' | 'approved' | 'failed';
  donor_name: string | null;
  donor_custom: string | null;
  description: string | null;
  food_type: string | null;
  soup_kitchen_category: string | null;
  weight_lbs: number | null;
  weight_source: string | null;
  quantity: number | null;
  expiration_date: string | null;
  estimated_value: number | null;
  price_per_unit: number | null;
  confidence_level: string | null;
  pricing_source: string | null;
  search_results_summary: string | null;
  pricing_notes: string | null;
  cascade_attempts: number;
  cascade_error: string | null;
  cascade_run_at: string | null;
  created_at: string;
  last_modified: string;
  photo_urls?: string[];
}

async function jsonFetch<T>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(url, {
    credentials: 'include',
    headers: { 'Content-Type': 'application/json', ...(init?.headers ?? {}) },
    ...init,
  });
  // Read the body once as text, then attempt JSON parse. Avoids
  // "body stream already read" errors when the response isn't JSON.
  const text = await res.text();
  if (!res.ok) {
    let detail = text;
    try {
      const parsed = text ? JSON.parse(text) : null;
      if (parsed && typeof parsed === 'object') {
        detail = parsed.error || JSON.stringify(parsed);
      }
    } catch {
      // body wasn't JSON; keep it as raw text
    }
    throw new Error(`${res.status} ${res.statusText}${detail ? `: ${detail}` : ''}`);
  }
  return (text ? JSON.parse(text) : null) as T;
}

// --- Auth ---

export async function checkAuth(): Promise<boolean> {
  const r = await fetch('/api/me', { credentials: 'include' });
  if (!r.ok) return false;
  const body = await r.json();
  return !!body.authed;
}

export async function login(password: string): Promise<void> {
  await jsonFetch('/api/login', {
    method: 'POST',
    body: JSON.stringify({ password }),
  });
}

export async function logout(): Promise<void> {
  await jsonFetch('/api/logout', { method: 'POST' });
}

// --- Sessions ---

export async function createSession(userLabel?: string): Promise<SessionRow> {
  return jsonFetch<SessionRow>('/api/sessions', {
    method: 'POST',
    body: JSON.stringify({ userLabel }),
  });
}

export async function getSession(id: string): Promise<SessionRow & { items: ItemRow[] }> {
  return jsonFetch<SessionRow & { items: ItemRow[] }>(`/api/sessions/${id}`);
}

export async function finalizeSession(id: string): Promise<SessionRow> {
  return jsonFetch<SessionRow>(`/api/sessions/${id}`, {
    method: 'PATCH',
    body: JSON.stringify({ status: 'finalized' }),
  });
}

export async function listSessions(status?: string): Promise<SessionRow[]> {
  const qs = status ? `?status=${encodeURIComponent(status)}` : '';
  return jsonFetch<SessionRow[]>(`/api/sessions${qs}`);
}

// --- Items ---

export interface CreateItemInput {
  sessionId: string;
  donorName?: string;
  donorCustom?: string;
  photoUrls?: string[];
  description?: string;
  foodType?: string;
  soupKitchenCategory?: string;
  weightLbs?: number;
  weightSource?: string;
  quantity?: number;
  expirationDate?: string;
}

export async function createItem(input: CreateItemInput): Promise<ItemRow> {
  return jsonFetch<ItemRow>('/api/items', {
    method: 'POST',
    body: JSON.stringify(input),
  });
}

export async function patchItem(id: string, patch: Partial<CreateItemInput> & { status?: string; estimatedValue?: number; pricePerUnit?: number }): Promise<ItemRow> {
  return jsonFetch<ItemRow>(`/api/items/${id}`, {
    method: 'PATCH',
    body: JSON.stringify(patch),
  });
}

export async function listItems(params: { sessionId?: string; status?: string; limit?: number } = {}): Promise<ItemRow[]> {
  const qs = new URLSearchParams();
  if (params.sessionId) qs.set('sessionId', params.sessionId);
  if (params.status) qs.set('status', params.status);
  if (params.limit) qs.set('limit', String(params.limit));
  const q = qs.toString();
  return jsonFetch<ItemRow[]>(`/api/items${q ? `?${q}` : ''}`);
}

// --- Photos ---

export async function uploadPhoto(blob: Blob, sessionId: string): Promise<string> {
  const res = await fetch(`/api/upload-photo?sessionId=${encodeURIComponent(sessionId)}`, {
    method: 'POST',
    credentials: 'include',
    headers: { 'Content-Type': blob.type || 'image/jpeg' },
    body: blob,
  });
  if (!res.ok) {
    const detail = await res.text();
    throw new Error(`upload failed: ${res.status} ${detail}`);
  }
  const body = await res.json();
  return body.url as string;
}
