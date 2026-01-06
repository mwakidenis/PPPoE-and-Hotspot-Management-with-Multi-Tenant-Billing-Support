import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import axios from 'axios';
import https from 'https';

interface RouteParams {
  params: Promise<{ id: string }>;
}

// GET - Check provider device status
export async function GET(request: NextRequest, { params }: RouteParams) {
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

    try {
      switch (provider.type) {
        case 'mpwa':
          // MPWA uses info-devices endpoint to check status
          const mpwaUrl = `${provider.apiUrl}/info-devices?api_key=${provider.apiKey}`;
          const mpwaRes = await axios.get(mpwaUrl, {
            httpsAgent: new https.Agent({ rejectUnauthorized: false })
          });

          const mpwaData = mpwaRes.data;
          // MPWA returns devices array in 'info' key
          const devices = mpwaData.info || mpwaData.data || [];
          const device = devices.find((d: any) => d.body === provider.senderNumber);
          
          if (device) {
            const isConnected = device.status === 'Connected';
            return NextResponse.json({
              status: device.status.toLowerCase(),
              connected: isConnected,
              phone: device.body,
              name: null,
            });
          } else {
            return NextResponse.json({
              status: 'not_found',
              connected: false,
            });
          }

        case 'waha':
          // WAHA returns array of sessions
          const wahaUrl = `${provider.apiUrl}/api/sessions`;
          const wahaRes = await axios.get(wahaUrl, {
            headers: {
              'X-Api-Key': provider.apiKey,
            },
          });

          const sessions = wahaRes.data;
          const session = sessions.find((s: any) => s.name === 'default');
          
          if (session) {
            return NextResponse.json({
              status: session.status.toLowerCase(),
              connected: session.status === 'WORKING',
              phone: session.me?.id || null,
              name: session.me?.pushName || null,
            });
          } else {
            return NextResponse.json({
              status: 'not_found',
              connected: false,
            });
          }

        case 'gowa':
          // GOWA uses /app/devices to check status
          const gowaUrl = `${provider.apiUrl}/app/devices`;
          
          const gowaHeaders: any = {};
          if (provider.apiKey && provider.apiKey.includes(':')) {
            const base64Auth = Buffer.from(provider.apiKey).toString('base64');
            gowaHeaders['Authorization'] = `Basic ${base64Auth}`;
          }
          
          const gowaRes = await axios.get(gowaUrl, { headers: gowaHeaders });
          const gowaData = gowaRes.data;
          
          // GOWA returns: { code: "SUCCESS", results: [{ name, device }] }
          // If results array has device, it means connected
          if (gowaData.code === 'SUCCESS' && gowaData.results && gowaData.results.length > 0) {
            const device = gowaData.results[0];
            return NextResponse.json({
              status: 'connected',
              connected: true,
              phone: device.device || null,
              name: device.name || null,
            });
          } else {
            return NextResponse.json({
              status: 'disconnected',
              connected: false,
            });
          }

        default:
          return NextResponse.json({
            status: 'unsupported',
            connected: false,
          });
      }
    } catch (error: any) {
      console.error(`Failed to check status for ${provider.name}:`, error);
      return NextResponse.json({
        status: 'error',
        connected: false,
        error: error.response?.data?.message || error.message,
      });
    }
  } catch (error: any) {
    console.error('Status endpoint error:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to check status' },
      { status: 500 }
    );
  }
}
