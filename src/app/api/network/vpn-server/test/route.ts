import { NextResponse } from 'next/server';
import { RouterOSAPI } from 'node-routeros';

export async function POST(request: Request) {
  try {
    const { host, username, password, port } = await request.json();

    const conn = new RouterOSAPI({
      host,
      user: username,
      password,
      port: port || 8728,
      timeout: 5,
    });

    await conn.connect();
    
    // Get router identity
    const identity = await conn.write('/system/identity/print');
    
    await conn.close();

    return NextResponse.json({
      success: true,
      message: 'Connection successful!',
      identity: identity[0]?.name || 'Unknown',
    });
  } catch (error: any) {
    console.error('Test connection error:', error);
    return NextResponse.json({
      success: false,
      message: error.message || 'Connection failed',
    }, { status: 500 });
  }
}
