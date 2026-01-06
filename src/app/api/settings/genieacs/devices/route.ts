import { NextRequest, NextResponse } from 'next/server';
import { getGenieACSCredentials } from '../route';

// GET - Fetch devices from GenieACS
export async function GET(request: NextRequest) {
  try {
    const credentials = await getGenieACSCredentials();

    if (!credentials) {
      return NextResponse.json(
        { error: 'GenieACS not configured. Please setup connection first.' },
        { status: 400 }
      );
    }

    const { host, username, password } = credentials;

    // Call GenieACS API
    const response = await fetch(`${host}/devices`, {
      method: 'GET',
      headers: {
        'Authorization': 'Basic ' + Buffer.from(`${username}:${password}`).toString('base64'),
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      throw new Error(`GenieACS API returned ${response.status}`);
    }

    const devices = await response.json();

    return NextResponse.json({
      success: true,
      devices,
      count: devices.length,
    });
  } catch (error: any) {
    console.error('Error fetching devices from GenieACS:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to fetch devices from GenieACS' },
      { status: 500 }
    );
  }
}
