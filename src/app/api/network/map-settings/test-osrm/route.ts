import { NextRequest, NextResponse } from 'next/server';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { osrmApiUrl } = body;

    if (!osrmApiUrl) {
      return NextResponse.json(
        { success: false, error: 'OSRM API URL is required' },
        { status: 400 }
      );
    }

    // Test with a simple route query (Tasikmalaya area)
    const testUrl = `${osrmApiUrl}/route/v1/driving/108.2,-7.3;108.3,-7.4?overview=false`;
    
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 5000); // 5 second timeout

    try {
      const res = await fetch(testUrl, {
        signal: controller.signal,
        headers: {
          'User-Agent': 'AIBill-Radius/1.0',
        },
      });

      clearTimeout(timeoutId);

      if (res.ok) {
        const data = await res.json();
        if (data.code === 'Ok') {
          return NextResponse.json({
            success: true,
            message: 'OSRM connection successful!',
            details: {
              routes: data.routes?.length || 0,
              waypoints: data.waypoints?.length || 0,
            },
          });
        } else {
          return NextResponse.json({
            success: false,
            error: `OSRM responded but returned code: ${data.code}`,
            details: data.message,
          });
        }
      } else {
        return NextResponse.json({
          success: false,
          error: `Failed to connect: ${res.status} ${res.statusText}`,
        });
      }
    } catch (fetchError: any) {
      clearTimeout(timeoutId);
      
      if (fetchError.name === 'AbortError') {
        return NextResponse.json({
          success: false,
          error: 'Connection timeout (5s). Server might be unreachable.',
        });
      }
      
      throw fetchError;
    }
  } catch (error: any) {
    console.error('OSRM test error:', error);
    return NextResponse.json({
      success: false,
      error: error.message || 'Connection failed',
      hint: 'Check if OSRM server is running and the URL is correct',
    });
  }
}
