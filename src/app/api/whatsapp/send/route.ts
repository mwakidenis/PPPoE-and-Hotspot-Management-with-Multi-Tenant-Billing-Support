import { NextRequest, NextResponse } from 'next/server';
import { WhatsAppService } from '@/lib/whatsapp';

export async function POST(request: NextRequest) {
  try {
    const { phone, message } = await request.json();

    if (!phone || !message) {
      return NextResponse.json(
        { success: false, error: 'Phone and message are required' },
        { status: 400 }
      );
    }

    // Use WhatsApp failover service
    const result = await WhatsAppService.sendMessage({ phone, message });

    if (result.success) {
      return NextResponse.json({
        success: true,
        provider: result.provider,
        attempts: result.attempts,
        response: result.response,
      });
    } else {
      return NextResponse.json(
        {
          success: false,
          error: result.error || 'All providers failed',
          attempts: result.attempts,
        },
        { status: 500 }
      );
    }
  } catch (error: any) {
    console.error('Send API error:', error);
    return NextResponse.json(
      { success: false, error: error.message || 'Failed to send message' },
      { status: 500 }
    );
  }
}
