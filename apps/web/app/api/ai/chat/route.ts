import { NextRequest } from 'next/server';
import { SERVER_API_URL } from '@/lib/server-api';

export async function POST(request: NextRequest) {
  const cookieHeader = request.headers.get('cookie') || '';
  const backendUrl = `${SERVER_API_URL}/ai/chat`;

  const rawBody = await request.text();

  const response = await fetch(backendUrl, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Cookie: cookieHeader,
    },
    body: rawBody,
  });

  return new Response(response.body, {
    status: response.status,
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      Connection: 'keep-alive',
    },
  });
}
