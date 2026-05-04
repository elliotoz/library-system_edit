import { NextRequest } from 'next/server';
import { SERVER_API_URL } from '@/lib/server-api';

const BACKEND = SERVER_API_URL;

export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } },
) {
  await fetch(`${BACKEND}/ai/conversations/${params.id}`, {
    method: 'DELETE',
    headers: { Cookie: request.headers.get('cookie') || '' },
  });
  return new Response(null, { status: 204 });
}
