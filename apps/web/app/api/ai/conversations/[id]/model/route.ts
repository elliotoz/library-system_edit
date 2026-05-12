import { NextRequest } from 'next/server';
import { SERVER_API_URL } from '@/lib/server-api';

const BACKEND = SERVER_API_URL;

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const body = await request.text();
  const res = await fetch(`${BACKEND}/ai/conversations/${id}/model`, {
    method: 'PATCH',
    headers: {
      'Content-Type': 'application/json',
      Cookie: request.headers.get('cookie') || '',
    },
    body,
  });
  if (!res.ok) return Response.json({ error: 'Failed to update model preference' }, { status: res.status });
  return new Response(null, { status: 204 });
}
