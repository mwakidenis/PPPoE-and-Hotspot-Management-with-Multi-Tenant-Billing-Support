import { NextRequest, NextResponse } from 'next/server';

// POST - Test GenieACS connection
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { host, username, password } = body;

    if (!host || !username || !password) {
      return NextResponse.json(
        { error: 'Host, username, and password are required' },
        { status: 400 }
      );
    }

    // Test connection by fetching devices
    const response = await fetch(`${host}/devices?limit=1`, {
      method: 'GET',
      headers: {
        'Authorization': 'Basic ' + Buffer.from(`${username}:${password}`).toString('base64'),
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      if (response.status === 401) {
        return NextResponse.json(
          { 
            success: false,
            error: 'Authentication failed. Invalid username or password.' 
          },
          { status: 401 }
        );
      }
      throw new Error(`GenieACS returned status ${response.status}`);
    }

    const data = await response.json();

    return NextResponse.json({
      success: true,
      message: 'Connection successful!',
      deviceCount: Array.isArray(data) ? data.length : 0,
    });
  } catch (error: any) {
    console.error('Error testing GenieACS connection:', error);
    
    let errorMessage = 'Connection failed. Please check your settings.';
    if (error.message.includes('fetch failed')) {
      errorMessage = 'Unable to connect to GenieACS. Please check the host URL.';
    }

    return NextResponse.json(
      { 
        success: false,
        error: errorMessage,
        details: error.message 
      },
      { status: 500 }
    );
  }
}
