import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import axios from 'axios';
import { nanoid } from 'nanoid';

interface RouteParams {
  params: Promise<{ id: string }>;
}

// POST - Test provider
export async function POST(request: NextRequest, { params }: RouteParams) {
  try {
    const { id } = await params;
    const { phone } = await request.json();

    if (!phone) {
      return NextResponse.json(
        { success: false, error: 'Phone number required' },
        { status: 400 }
      );
    }

    const provider = await prisma.whatsapp_providers.findUnique({
      where: { id },
    });

    if (!provider) {
      return NextResponse.json(
        { success: false, error: 'Provider not found' },
        { status: 404 }
      );
    }

    const testMessage = `🧪 *Test Message from AI-BILL*

This is a test message from WhatsApp Provider: *${provider.name}*

Provider Type: ${provider.type.toUpperCase()}
Test Time: ${new Date().toLocaleString('id-ID', { timeZone: 'Asia/Jakarta' })}

If you receive this message, the provider is working correctly! ✅`;

    let success = false;
    let responseData: any = null;
    let errorMessage: string | null = null;

    try {
      switch (provider.type) {
        case 'fonnte':
          const fonnteRes = await axios.post(
            provider.apiUrl,
            {
              target: phone,
              message: testMessage,
              countryCode: '62',
            },
            {
              headers: {
                Authorization: provider.apiKey,
              },
            }
          );
          responseData = fonnteRes.data;
          success = fonnteRes.data.status === true || fonnteRes.data.success === true;
          break;

        case 'waha':
          const wahaRes = await axios.post(
            `${provider.apiUrl}/api/sendText`,
            {
              chatId: `${phone}@c.us`,
              text: testMessage,
              session: 'default',
            },
            {
              headers: {
                'Content-Type': 'application/json',
                'X-API-Key': provider.apiKey,
              },
            }
          );
          responseData = wahaRes.data;
          success = wahaRes.status === 200 || wahaRes.status === 201;
          break;

        case 'mpwa':
          const mpwaRes = await axios.post(
            `${provider.apiUrl}/api/send-message`,
            {
              number: phone,
              message: testMessage,
            },
            {
              headers: {
                'Content-Type': 'application/json',
                Authorization: `Bearer ${provider.apiKey}`,
              },
            }
          );
          responseData = mpwaRes.data;
          success = mpwaRes.data.status === 'success';
          break;

        case 'wablas':
          const wablasRes = await axios.post(
            `${provider.apiUrl}/api/send-message`,
            {
              phone,
              message: testMessage,
            },
            {
              headers: {
                Authorization: provider.apiKey,
              },
            }
          );
          responseData = wablasRes.data;
          success = wablasRes.data.status === true;
          break;

        default:
          errorMessage = `Unknown provider type: ${provider.type}`;
          break;
      }
    } catch (error: any) {
      console.error('Provider test failed:', error);
      errorMessage = error.response?.data?.message || error.message || 'Unknown error';
      responseData = error.response?.data;
    }

    // Log test result
    await prisma.whatsapp_history.create({
      data: {
        id: nanoid(),
        phone,
        message: testMessage,
        status: success ? 'sent' : 'failed',
        response: JSON.stringify({ provider: provider.name, responseData, errorMessage }),
      },
    });

    return NextResponse.json({
      success,
      error: errorMessage,
      response: responseData,
      provider: {
        id: provider.id,
        name: provider.name,
        type: provider.type,
      },
    });
  } catch (error: any) {
    console.error('Test provider error:', error);
    return NextResponse.json(
      { success: false, error: error.message || 'Failed to test provider' },
      { status: 500 }
    );
  }
}
