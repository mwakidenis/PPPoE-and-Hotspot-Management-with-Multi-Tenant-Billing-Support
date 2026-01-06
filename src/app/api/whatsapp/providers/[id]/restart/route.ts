import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import axios from 'axios';

interface RouteParams {
  params: Promise<{ id: string }>;
}

// POST - Restart WAHA session
export async function POST(request: NextRequest, { params }: RouteParams) {
  try {
    const { id } = await params;

    const provider = await prisma.whatsapp_providers.findUnique({
      where: { id },
    });

    if (!provider) {
      return NextResponse.json(
        { error: 'Provider not found' },
        { status: 404 }
      );
    }

    if (provider.type !== 'waha' && provider.type !== 'gowa') {
      return NextResponse.json(
        { error: 'Restart only supported for WAHA and GOWA providers' },
        { status: 400 }
      );
    }

    try {
      if (provider.type === 'waha') {
        // WAHA restart logic
        try {
          const logoutUrl = `${provider.apiUrl}/api/sessions/default/logout`;
          await axios.post(logoutUrl, {}, {
            headers: {
              'X-Api-Key': provider.apiKey,
            },
          });
          console.log('[Restart] WAHA logged out successfully');
        } catch (logoutError) {
          console.log('[Restart] WAHA logout error (might not be connected):', logoutError);
        }

        await new Promise(resolve => setTimeout(resolve, 1000));

        const restartUrl = `${provider.apiUrl}/api/sessions/default/restart`;
        await axios.post(restartUrl, {}, {
          headers: {
            'X-Api-Key': provider.apiKey,
          },
        });

        await new Promise(resolve => setTimeout(resolve, 3000));
      } else if (provider.type === 'gowa') {
        // GOWA restart logic
        const gowaHeaders: any = {};
        if (provider.apiKey && provider.apiKey.includes(':')) {
          const base64Auth = Buffer.from(provider.apiKey).toString('base64');
          gowaHeaders['Authorization'] = `Basic ${base64Auth}`;
        }

        // Logout first
        try {
          await axios.get(`${provider.apiUrl}/app/logout`, { headers: gowaHeaders });
          console.log('[Restart] GOWA logged out successfully');
        } catch (logoutError) {
          console.log('[Restart] GOWA logout error (might not be connected):', logoutError);
        }

        await new Promise(resolve => setTimeout(resolve, 2000));

        // Reconnect
        await axios.get(`${provider.apiUrl}/app/reconnect`, { headers: gowaHeaders });
        
        await new Promise(resolve => setTimeout(resolve, 2000));
      }

      return NextResponse.json({
        success: true,
        message: 'Session restarted successfully. Please scan QR code.',
      });
    } catch (error: any) {
      console.error('Failed to restart WAHA session:', error);
      return NextResponse.json(
        {
          error: 'Failed to restart session',
          details: error.response?.data?.message || error.message,
        },
        { status: 500 }
      );
    }
  } catch (error: any) {
    console.error('Restart endpoint error:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to restart session' },
      { status: 500 }
    );
  }
}
