import { NextRequest, NextResponse } from 'next/server';

export async function POST(request: NextRequest) {
  const cookieHeader = request.headers.get('cookie') || '';
  const contentType = request.headers.get('content-type') || '';

  const backendUrl = `${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001'}/ai/upload-file`;

  const body = await request.arrayBuffer();

  const response = await fetch(backendUrl, {
    method: 'POST',
    headers: {
      'Content-Type': contentType,
      Cookie: cookieHeader,
    },
    body,
  });

  const data = await response.json();
  return NextResponse.json(data, { status: response.status });
}
