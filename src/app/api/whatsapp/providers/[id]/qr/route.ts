import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import axios from 'axios';

interface RouteParams {
  params: Promise<{ id: string }>;
}

// GET - Fetch QR code from provider
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

    if (!provider.isActive) {
      return NextResponse.json(
        { error: 'Provider is not active' },
        { status: 400 }
      );
    }

    try {
      switch (provider.type) {
        case 'mpwa':
          // MPWA returns JSON with base64 QR
          // Add force=1 to auto-create device if not exists
          const mpwaUrl = `${provider.apiUrl}/generate-qr?api_key=${provider.apiKey}&device=${provider.senderNumber}&force=1`;
          const mpwaRes = await axios.get(mpwaUrl);

          const mpwaData = mpwaRes.data;
          
          // Check if MPWA returned an error
          if (mpwaData.status === false || mpwaData.error) {
            const errorMsg = mpwaData.msg || mpwaData.message || mpwaData.error || 'Unknown MPWA error';
            return NextResponse.json(
              { error: errorMsg, mpwaResponse: mpwaData },
              { status: 400 }
            );
          }

          // Return the full response so UI can check status
          return NextResponse.json(mpwaData);

        case 'waha':
          // WAHA returns image directly
          const wahaUrl = `${provider.apiUrl}/api/default/auth/qr`;
          
          try {
            const wahaRes = await axios.get(wahaUrl, {
              headers: {
                'X-Api-Key': provider.apiKey,
              },
              responseType: 'arraybuffer',
            });

            // Return image
            return new NextResponse(wahaRes.data, {
              headers: {
                'Content-Type': 'image/png',
              },
            });
          } catch (wahaError: any) {
            // Handle WAHA specific errors
            if (wahaError.response?.status === 422) {
              const errorData = wahaError.response?.data;
              let message = 'Session tidak dalam status SCAN_QR_CODE.';
              
              if (errorData?.status === 'WORKING') {
                message = '✅ Device sudah tersambung! Session status: WORKING';
              } else if (errorData?.status === 'STOPPED') {
                message = '⚠️ Session stopped. Gunakan tombol "Restart Session" terlebih dahulu.';
              }
              
              return NextResponse.json(
                {
                  error: message,
                  status: errorData?.status,
                  details: errorData,
                },
                { status: 422 }
              );
            }
            throw wahaError;
          }

        case 'gowa':
          // GOWA returns JSON with QR link
          const gowaUrl = `${provider.apiUrl}/app/login`;
          
          const gowaHeaders: any = {};
          if (provider.apiKey && provider.apiKey.includes(':')) {
            const base64Auth = Buffer.from(provider.apiKey).toString('base64');
            gowaHeaders['Authorization'] = `Basic ${base64Auth}`;
          }
          
          const gowaRes = await axios.get(gowaUrl, { headers: gowaHeaders });
          const gowaData = gowaRes.data;
          
          // GOWA response format: { code: "SUCCESS", message: "...", results: { qr_link: "..." } }
          if (gowaData.code === 'SUCCESS' && gowaData.results?.qr_link) {
            // Fetch the actual QR image from the link
            const qrImageRes = await axios.get(gowaData.results.qr_link, {
              headers: gowaHeaders,
              responseType: 'arraybuffer'
            });
            
            // Return image like WAHA
            return new NextResponse(qrImageRes.data, {
              headers: {
                'Content-Type': 'image/png',
              },
            });
          } else if (gowaData.code === 'ALREADY_LOGGED_IN') {
            return NextResponse.json(
              { 
                error: '✅ Device sudah tersambung! Session status: Connected',
                alreadyConnected: true,
                message: gowaData.message 
              },
              { status: 422 }
            );
          } else {
            return NextResponse.json(
              { error: gowaData.message || 'Failed to get QR code' },
              { status: 400 }
            );
          }
          

        default:
          return NextResponse.json(
            { error: `QR code not supported for ${provider.type}` },
            { status: 400 }
          );
      }
    } catch (error: any) {
      console.error('Failed to fetch QR from provider:', error);
      return NextResponse.json(
        {
          error: 'Failed to fetch QR code from provider',
          details: error.response?.data?.message || error.message,
        },
        { status: 500 }
      );
    }
  } catch (error: any) {
    console.error('QR endpoint error:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to fetch QR code' },
      { status: 500 }
    );
  }
}
