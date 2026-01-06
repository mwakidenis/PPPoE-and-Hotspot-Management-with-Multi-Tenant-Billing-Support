import crypto from 'crypto';

interface DuitkuConfig {
  merchantCode: string;
  apiKey: string;
  callbackUrl: string;
  returnUrl: string;
  sandbox?: boolean;
}

interface CreateInvoiceParams {
  invoiceId: string;
  amount: number;
  customerName: string;
  customerEmail: string;
  description: string;
  expiryMinutes?: number;
}

interface DuitkuResponse {
  statusCode: string;
  statusMessage: string;
  reference: string;
  paymentUrl: string;
  vaNumber?: string;
  qrString?: string;
  amount: string;
}

export class DuitkuPayment {
  private config: DuitkuConfig;
  private baseUrl: string;

  constructor(config: DuitkuConfig) {
    this.config = config;
    // POP API menggunakan endpoint berbeda
    this.baseUrl = config.sandbox
      ? 'https://api-sandbox.duitku.com/api/merchant'
      : 'https://api-prod.duitku.com/api/merchant';
  }

  /**
   * Generate signature untuk request Duitku
   */
  private generateSignature(
    merchantCode: string,
    merchantOrderId: string,
    amount: number,
    apiKey: string
  ): string {
    const signatureString = `${merchantCode}${merchantOrderId}${amount}${apiKey}`;
    return crypto.createHash('md5').update(signatureString).digest('hex');
  }

  /**
   * Validate callback signature dari Duitku
   */
  public validateCallbackSignature(
    merchantCode: string,
    amount: string,
    merchantOrderId: string,
    apiKey: string,
    signature: string
  ): boolean {
    const calculatedSignature = crypto
      .createHash('md5')
      .update(`${merchantCode}${amount}${merchantOrderId}${apiKey}`)
      .digest('hex');
    return calculatedSignature === signature;
  }

  /**
   * Create payment request
   */
  async createInvoice(params: CreateInvoiceParams): Promise<DuitkuResponse> {
    const {
      invoiceId,
      amount,
      customerName,
      customerEmail,
      description,
      expiryMinutes = 1440, // 24 hours default
    } = params;

    // Generate signature
    const signature = this.generateSignature(
      this.config.merchantCode,
      invoiceId,
      amount,
      this.config.apiKey
    );

    const payload = {
      merchantCode: this.config.merchantCode,
      paymentAmount: amount,
      merchantOrderId: invoiceId,
      productDetails: description,
      customerVaName: customerName,
      email: customerEmail,
      phoneNumber: '08123456789', // Default phone number
      itemDetails: [
        {
          name: description,
          price: amount,
          quantity: 1
        }
      ],
      customerDetail: {
        firstName: customerName.split(' ')[0] || 'Customer',
        lastName: customerName.split(' ').slice(1).join(' ') || 'Name',
        email: customerEmail,
        phoneNumber: '08123456789'
      },
      callbackUrl: this.config.callbackUrl,
      returnUrl: this.config.returnUrl,
      signature: signature,
      expiryPeriod: expiryMinutes,
    };

    try {
      // POP API menggunakan header-based authentication
      const timestamp = Date.now(); // in milliseconds
      const headerSignature = crypto
        .createHash('sha256')
        .update(`${this.config.merchantCode}${timestamp}${this.config.apiKey}`)
        .digest('hex');
      
      console.log('[Duitku] Request URL:', `${this.baseUrl}/createInvoice`);
      console.log('[Duitku] Timestamp:', timestamp);
      console.log('[Duitku] Header Signature:', headerSignature);
      console.log('[Duitku] Request payload:', JSON.stringify(payload, null, 2));
      
      const response = await fetch(`${this.baseUrl}/createInvoice`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json',
          'x-duitku-signature': headerSignature,
          'x-duitku-timestamp': timestamp.toString(),
          'x-duitku-merchantcode': this.config.merchantCode,
        },
        body: JSON.stringify(payload),
      });

      const data = await response.json();
      
      console.log('[Duitku] API Response:', JSON.stringify(data, null, 2));
      console.log('[Duitku] Payment URL:', data.paymentUrl);

      if (!response.ok || data.statusCode !== '00') {
        throw new Error(data.statusMessage || 'Failed to create Duitku invoice');
      }

      return data;
    } catch (error) {
      console.error('Duitku create invoice error:', error);
      throw error;
    }
  }

  /**
   * Check transaction status
   */
  async checkTransactionStatus(merchantOrderId: string): Promise<any> {
    // Signature untuk status check: md5(merchantCode + merchantOrderId + apiKey)
    const signatureString = `${this.config.merchantCode}${merchantOrderId}${this.config.apiKey}`;
    const signature = crypto.createHash('md5').update(signatureString).digest('hex');

    try {
      const response = await fetch(
        `${this.baseUrl}/merchant/transactionStatus`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            merchantCode: this.config.merchantCode,
            merchantOrderId: merchantOrderId,
            signature: signature,
          }),
        }
      );

      const data = await response.json();
      return data;
    } catch (error) {
      console.error('Duitku check status error:', error);
      throw error;
    }
  }

  /**
   * Get available payment methods
   */
  async getPaymentMethods(amount: number): Promise<any> {
    const signature = crypto
      .createHash('md5')
      .update(`${this.config.merchantCode}${amount}${this.config.apiKey}`)
      .digest('hex');

    try {
      const response = await fetch(
        `${this.baseUrl}/merchant/paymentmethod/getpaymentmethod`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            merchantcode: this.config.merchantCode,
            amount: amount,
            signature: signature,
          }),
        }
      );

      const data = await response.json();
      return data;
    } catch (error) {
      console.error('Duitku get payment methods error:', error);
      throw error;
    }
  }
}

/**
 * Helper function to initialize Duitku
 */
export function createDuitkuClient(
  merchantCode: string,
  apiKey: string,
  callbackUrl: string,
  returnUrl: string,
  sandbox: boolean = false
): DuitkuPayment {
  return new DuitkuPayment({
    merchantCode,
    apiKey,
    callbackUrl,
    returnUrl,
    sandbox,
  });
}
