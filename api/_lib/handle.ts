import type { VercelRequest, VercelResponse } from '@vercel/node';

// Wrap a handler so any throw becomes a JSON 500 response instead of
// Vercel's opaque FUNCTION_INVOCATION_FAILED page.
export function handle(
  fn: (req: VercelRequest, res: VercelResponse) => Promise<unknown> | unknown
) {
  return async (req: VercelRequest, res: VercelResponse) => {
    try {
      await fn(req, res);
    } catch (err: any) {
      console.error('handler error:', err?.stack || err?.message || err);
      if (!res.headersSent) {
        res.status(500).json({
          error: 'server error',
          detail: err?.message || String(err),
        });
      }
    }
  };
}
