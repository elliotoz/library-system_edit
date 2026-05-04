import { NextRequest } from 'next/server';
import { SERVER_API_URL } from '@/lib/server-api';

const BACKEND = SERVER_API_URL;

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
      return Response.json({ error: 'Backend study request failed' }, { status: res.status });
    }

    return Response.json(await res.json(), { status: 201 });
  } catch {
    return Response.json({ error: 'Failed to reach backend' }, { status: 502 });
  }
}
