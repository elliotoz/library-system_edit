import { NextRequest } from 'next/server';

export async function GET(request: NextRequest) {
  const cookieHeader = request.headers.get('cookie') || '';

  const backendUrl = `${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001'}/ai/history`;

  const response = await fetch(backendUrl, {
    headers: {
      Cookie: cookieHeader,
    },
  });

  if (!response.ok) return Response.json([]);
  const data = await response.json();
  return Response.json(data);
}
