import { NextRequest } from 'next/server';

const BACKEND = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';

export async function POST(request: NextRequest) {
  try {
    const body = await request.text();
    const res = await fetch(`${BACKEND}/ai/study`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Cookie: request.headers.get('cookie') || '',
      },
      body,
    });

    if (!res.ok) {
      const errBody = await res.text();
      console.error(`[/api/ai/study] backend error ${res.status}:`, errBody);
      return Response.json({ error: errBody }, { status: res.status });
    }

    return Response.json(await res.json(), { status: 201 });
  } catch (err) {
    console.error('[/api/ai/study] proxy error:', err);
    return Response.json({ error: 'Failed to reach backend' }, { status: 502 });
  }
}
