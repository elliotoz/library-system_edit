import { NextRequest } from 'next/server';

const BACKEND = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';

export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const body = await request.text();
  const res = await fetch(`${BACKEND}/ai/conversations/${params.id}/mode`, {
    method: 'PATCH',
    headers: {
      'Content-Type': 'application/json',
      Cookie: request.headers.get('cookie') || '',
    },
    body,
  });
  if (!res.ok) return Response.json({ error: 'Failed to update mode' }, { status: 500 });
  return new Response(null, { status: 204 });
}
