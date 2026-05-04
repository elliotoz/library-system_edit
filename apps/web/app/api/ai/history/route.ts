import { NextRequest } from 'next/server';
import { SERVER_API_URL } from '@/lib/server-api';

export async function GET(request: NextRequest) {
  const cookieHeader = request.headers.get('cookie') || '';
  const conversationId = request.nextUrl.searchParams.get('conversationId');

  const url = `${SERVER_API_URL}/ai/history${
    conversationId ? `?conversationId=${conversationId}` : ''
  }`;

  const response = await fetch(url, { headers: { Cookie: cookieHeader } });
  if (!response.ok) return Response.json([]);
  return Response.json(await response.json());
}
