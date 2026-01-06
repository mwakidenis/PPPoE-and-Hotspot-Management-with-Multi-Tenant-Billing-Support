import { prisma } from './prisma';

interface WhatsAppProvider {
  id: string;
  name: string;
  type: 'fonnte' | 'waha' | 'mpwa' | 'wablas' | 'gowa';
  apiKey: string;
  apiUrl: string;
  isActive: boolean;
  priority: number;
  senderNumber?: string;
}

interface SendMessageParams {
  phone: string;
  message: string;
}

/**
 * WhatsApp Service with Failover
 * Automatically tries next provider if current one fails
 */
export class WhatsAppService {
  
  /**
   * Get active providers sorted by priority
   */
  static async getActiveProviders(): Promise<WhatsAppProvider[]> {
    return await prisma.whatsapp_providers.findMany({
      where: { isActive: true },
      orderBy: { priority: 'asc' },
    }) as any[];
  }

  /**
   * Send message with automatic failover
   */
  static async sendMessage({ phone, message }: SendMessageParams) {
    const providers = await this.getActiveProviders();

    if (providers.length === 0) {
      throw new Error('No active WhatsApp providers configured');
    }

    // Clean phone number - ensure it starts with country code (62 for Indonesia)
    let cleanPhone = phone.replace(/[^0-9]/g, '');
    
    // Add 62 prefix if starts with 0
    if (cleanPhone.startsWith('0')) {
      cleanPhone = '62' + cleanPhone.substring(1);
    }
    
    // Ensure starts with 62
    if (!cleanPhone.startsWith('62')) {
      cleanPhone = '62' + cleanPhone;
    }
    
    let lastError: Error | null = null;
    const attempts: Array<{
      provider: string;
      type: string;
      success: boolean;
      error?: string;
      response?: any;
    }> = [];
    
    // Try each provider in priority order
    for (const provider of providers) {
      try {
        console.log(`[WhatsApp] Trying provider: ${provider.name} (${provider.type})`);
        
        const result = await this.sendViaProvider(provider, cleanPhone, message);
        
        // Log success
        await this.logMessage({
          phone: cleanPhone,
          message,
          status: 'sent',
          providerId: provider.id,
          providerName: provider.name,
          providerType: provider.type,
          response: JSON.stringify(result),
        });
        
        console.log(`[WhatsApp] ✅ Sent via ${provider.name}`);
        
        attempts.push({
          provider: provider.name,
          type: provider.type,
          success: true,
          response: result,
        });
        
        return {
          success: true,
          provider: provider.name,
          response: result,
          attempts,
        };
        
      } catch (error) {
        lastError = error as Error;
        console.error(`[WhatsApp] ❌ Failed via ${provider.name}:`, error);
        
        attempts.push({
          provider: provider.name,
          type: provider.type,
          success: false,
          error: lastError.message,
        });
        
        // Log failure
        await this.logMessage({
          phone: cleanPhone,
          message,
          status: 'failed',
          providerId: provider.id,
          providerName: provider.name,
          providerType: provider.type,
          response: JSON.stringify({ error: lastError.message }),
        });
        
        // Continue to next provider
        continue;
      }
    }
    
    // All providers failed
    throw new Error(`All WhatsApp providers failed. Last error: ${lastError?.message}`);
  }

  /**
   * Send via specific provider based on type
   */
  private static async sendViaProvider(
    provider: WhatsAppProvider,
    phone: string,
    message: string
  ) {
    switch (provider.type) {
      case 'fonnte':
        return await this.sendViaFonnte(provider, phone, message);
      case 'waha':
        return await this.sendViaWAHA(provider, phone, message);
      case 'mpwa':
        return await this.sendViaMPWA(provider, phone, message);
      case 'wablas':
        return await this.sendViaWablas(provider, phone, message);
      case 'gowa':
        return await this.sendViaGOWA(provider, phone, message);
      default:
        throw new Error(`Unsupported provider type: ${provider.type}`);
    }
  }

  /**
   * Fonnte API
   */
  private static async sendViaFonnte(
    provider: WhatsAppProvider,
    phone: string,
    message: string
  ) {
    const response = await fetch(provider.apiUrl, {
      method: 'POST',
      headers: {
        'Authorization': provider.apiKey,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        target: phone,
        message: message,
        countryCode: '62',
      }),
    });

    if (!response.ok) {
      throw new Error(`Fonnte API error: ${response.status}`);
    }

    return await response.json();
  }

  /**
   * WAHA (WhatsApp HTTP API)
   */
  private static async sendViaWAHA(
    provider: WhatsAppProvider,
    phone: string,
    message: string
  ) {
    try {
      // First check session status
      const statusResponse = await fetch(`${provider.apiUrl}/api/sessions`, {
        method: 'GET',
        headers: {
          'X-Api-Key': provider.apiKey,
        },
      });

      if (statusResponse.ok) {
        const sessions = await statusResponse.json();
        const defaultSession = sessions.find((s: any) => s.name === 'default');
        
        if (!defaultSession || defaultSession.status !== 'WORKING') {
          throw new Error(`WAHA session not ready. Status: ${defaultSession?.status || 'NOT_FOUND'}. Please scan QR code.`);
        }
      }

      // Send message
      const response = await fetch(`${provider.apiUrl}/api/sendText`, {
        method: 'POST',
        headers: {
          'X-Api-Key': provider.apiKey,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          session: 'default',
          chatId: `${phone}@c.us`,
          text: message,
        }),
      });

      if (!response.ok) {
        const errorText = await response.text();
        let errorDetail = errorText;
        
        try {
          const errorJson = JSON.parse(errorText);
          errorDetail = errorJson.message || errorJson.error || errorText;
        } catch {
          // Use raw text if not JSON
        }
        
        throw new Error(`WAHA API error: ${response.status} - ${errorDetail}`);
      }

      return await response.json();
    } catch (error) {
      if (error instanceof Error) {
        throw error;
      }
      throw new Error(`WAHA error: ${String(error)}`);
    }
  }

  /**
   * GOWA (Go WhatsApp Multi-Device)
   */
  private static async sendViaGOWA(
    provider: WhatsAppProvider,
    phone: string,
    message: string
  ) {
    try {
      // Extra clean: Remove @s.whatsapp.net suffix if present
      let cleanPhone = phone.replace(/@s\.whatsapp\.net$/, '');
      // Remove any non-numeric characters
      cleanPhone = cleanPhone.replace(/[^0-9]/g, '');
      
      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
      };

      // Add basic auth if API key is in username:password format
      if (provider.apiKey && provider.apiKey.includes(':')) {
        const base64Auth = Buffer.from(provider.apiKey).toString('base64');
        headers['Authorization'] = `Basic ${base64Auth}`;
      }

      const response = await fetch(`${provider.apiUrl}/send/message`, {
        method: 'POST',
        headers,
        body: JSON.stringify({
          phone: cleanPhone,
          message: message,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(`GOWA API error: ${response.status} - ${errorData.message || 'Unknown error'}`);
      }

      const result = await response.json();
      
      // Check GOWA response: { code: "SUCCESS", message: "...", results: {...} }
      if (result.code !== 'SUCCESS') {
        throw new Error(`GOWA error: ${result.message || 'Failed to send message'}`);
      }

      return result;
    } catch (error) {
      if (error instanceof Error) {
        throw error;
      }
      throw new Error(`GOWA error: ${String(error)}`);
    }
  }

  /**
   * MPWA (Multi Purpose WhatsApp API)
   */
  private static async sendViaMPWA(
    provider: WhatsAppProvider,
    phone: string,
    message: string
  ) {
    // MPWA uses query params, not JSON body
    const url = new URL(`${provider.apiUrl}/send-message`);
    url.searchParams.append('api_key', provider.apiKey);
    url.searchParams.append('sender', provider.senderNumber || '');
    url.searchParams.append('number', phone);
    url.searchParams.append('message', message);

    const response = await fetch(url.toString(), {
      method: 'GET',
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`MPWA API error: ${response.status} - ${errorText}`);
    }

    return await response.json();
  }

  /**
   * Wablas API
   */
  private static async sendViaWablas(
    provider: WhatsAppProvider,
    phone: string,
    message: string
  ) {
    const response = await fetch(`${provider.apiUrl}/api/send-message`, {
      method: 'POST',
      headers: {
        'Authorization': provider.apiKey,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        phone: phone,
        message: message,
      }),
    });

    if (!response.ok) {
      throw new Error(`Wablas API error: ${response.status}`);
    }

    return await response.json();
  }

  /**
   * Log message to history
   */
  private static async logMessage(data: {
    phone: string;
    message: string;
    status: 'sent' | 'failed';
    providerId: string;
    providerName: string;
    providerType: string;
    response: string;
  }) {
    try {
      await prisma.whatsapp_history.create({
        data: {
          id: crypto.randomUUID(),
          phone: data.phone,
          message: data.message,
          status: data.status,
          response: data.response,
          providerName: data.providerName,
          providerType: data.providerType,
        },
      });
    } catch (error) {
      console.error('[WhatsApp] Failed to log message:', error);
      // Don't throw, logging failure shouldn't break the flow
    }
  }

  /**
   * Test provider connection
   */
  static async testProvider(providerId: string, testPhone: string) {
    const provider = await prisma.whatsapp_providers.findUnique({
      where: { id: providerId },
    });

    if (!provider) {
      throw new Error('Provider not found');
    }

    try {
      const result = await this.sendViaProvider(
        provider as any,
        testPhone.replace(/[^0-9]/g, ''),
        'Test message from AI-BILL RADIUS 📱\n\nJika Anda menerima pesan ini, WhatsApp provider berhasil terhubung!'
      );

      return {
        success: true,
        provider: provider.name,
        response: result,
      };
    } catch (error) {
      return {
        success: false,
        provider: provider.name,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }
}
