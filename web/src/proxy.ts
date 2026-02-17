import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

export function proxy(request: NextRequest) {
  const apiKey = request.headers.get('x-api-key');
  const expectedKey = process.env.AGENT_API_KEY;

  if (!expectedKey) {
    return NextResponse.json(
      { error: 'Server misconfigured: AGENT_API_KEY not set' },
      { status: 500 },
    );
  }

  if (!apiKey || apiKey !== expectedKey) {
    return NextResponse.json(
      { error: 'Unauthorized' },
      { status: 401 },
    );
  }

  return NextResponse.next();
}

export const config = {
  matcher: '/api/agent/:path*',
};
