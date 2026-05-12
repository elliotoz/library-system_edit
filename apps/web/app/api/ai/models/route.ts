import { NextRequest } from 'next/server';
import { SERVER_API_URL } from '@/lib/server-api';

const BACKEND = SERVER_API_URL;

export async function GET(request: NextRequest) {
  const res = await fetch(`${BACKEND}/ai/models`, {
    headers: { Cookie: request.headers.get('cookie') || '' },
  });
  if (!res.ok) return Response.json({ error: 'Failed to fetch models' }, { status: res.status });
  const data = await res.json();
  return Response.json(data);
}
