import { NextRequest } from 'next/server';

export async function POST(request: NextRequest) {
  const cookieHeader = request.headers.get('cookie') || '';
  const backendUrl = `${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001'}/ai/chat`;

  // Read raw body to avoid Next.js default 1MB JSON limit
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
