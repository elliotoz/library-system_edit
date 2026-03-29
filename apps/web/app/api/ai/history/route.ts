import { NextRequest } from 'next/server';

export async function GET(request: NextRequest) {
  const cookieHeader = request.headers.get('cookie') || '';
  const conversationId = request.nextUrl.searchParams.get('conversationId');

  const url = `${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001'}/ai/history${
    conversationId ? `?conversationId=${conversationId}` : ''
  }`;

  const response = await fetch(url, { headers: { Cookie: cookieHeader } });
  if (!response.ok) return Response.json([]);
  return Response.json(await response.json());
}
