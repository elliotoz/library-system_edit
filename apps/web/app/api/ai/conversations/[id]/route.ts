import { NextRequest } from 'next/server';

const BACKEND = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';

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
