import { NextRequest } from 'next/server';
import { SERVER_API_URL } from '@/lib/server-api';

export async function GET(request: NextRequest) {
  const cookieHeader = request.headers.get('cookie') || '';
  const response = await fetch(`${SERVER_API_URL}/dashboard/admin/snapshot`, {
    method: 'GET',
    headers: {
      Cookie: cookieHeader,
    },
  });

  return new Response(response.body, {
    status: response.status,
    headers: {
      'Content-Type': response.headers.get('content-type') || 'application/json',
      'Cache-Control': 'no-store',
    },
  });
}
