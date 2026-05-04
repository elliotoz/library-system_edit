import { NextRequest } from 'next/server';
import { SERVER_API_URL } from '@/lib/server-api';

const BACKEND = SERVER_API_URL;

export async function GET(request: NextRequest) {
  const res = await fetch(`${BACKEND}/ai/conversations`, {
    headers: { Cookie: request.headers.get('cookie') || '' },
  });
  if (!res.ok) return Response.json([]);
  return Response.json(await res.json());
}

export async function POST(request: NextRequest) {
  const res = await fetch(`${BACKEND}/ai/conversations`, {
    method: 'POST',
    headers: { Cookie: request.headers.get('cookie') || '' },
  });
  if (!res.ok) return Response.json({ error: 'Failed to create conversation' }, { status: 500 });
  return Response.json(await res.json(), { status: 201 });
}
