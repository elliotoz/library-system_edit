import { NextRequest } from 'next/server';
import { SERVER_API_URL } from '@/lib/server-api';

const BACKEND = SERVER_API_URL;

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;

  await fetch(`${BACKEND}/ai/conversations/${id}`, {
    method: 'DELETE',
    headers: { Cookie: request.headers.get('cookie') || '' },
  });
  return new Response(null, { status: 204 });
}
