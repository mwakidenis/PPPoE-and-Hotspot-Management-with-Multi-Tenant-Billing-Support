import { WhatsAppService } from './whatsapp';
import { prisma } from './prisma';

/**
 * Render template with variables
 * Replace {{variable}} with actual values
 */
function renderTemplate(template: string, variables: Record<string, any>): string {
  let rendered = template;
  
  for (const [key, value] of Object.entries(variables)) {
    const regex = new RegExp(`{{${key}}}`, 'g');
    rendered = rendered.replace(regex, String(value ?? ''));
  }
  
  return rendered;
}

/**
 * Get template from database by type
 */
async function getTemplate(type: string): Promise<string | null> {
  try {
    const template = await prisma.whatsapp_templates.findFirst({
      where: {
        type,
        isActive: true,
      },
    });
    
    return template?.message || null;
  } catch (error) {
    console.error(`[Template] Failed to fetch template ${type}:`, error);
    return null;
  }
}

/**
 * Send registration approval notification
 * Includes username, password, and installation info
 */
export async function sendRegistrationApproval(data: {
  customerName: string;
  customerPhone: string;
  username: string;
  password: string;
  profileName: string;
  installationFee: number;
}) {
  try {
    const company = await prisma.company.findFirst();
    const companyName = company?.name || 'AI-BILL RADIUS';
    const companyPhone = company?.phone || '';

    // Get template from database
    const templateContent = await getTemplate('registration-approval');
    
    if (!templateContent) {
      console.warn('[WA] No template found for registration-approval');
      return;
    }

    // Prepare variables
    const variables = {
      customerName: data.customerName,
      username: data.username,
      password: data.password,
      profileName: data.profileName,
      installationFee: `Rp ${data.installationFee.toLocaleString('id-ID')}`,
      companyName,
      companyPhone,
    };

    // Render template
    const message = renderTemplate(templateContent, variables);

    await WhatsAppService.sendMessage({
      phone: data.customerPhone,
      message,
    });
    
    console.log(`[WA] ✅ Approval notification sent to ${data.customerPhone}`);
  } catch (error) {
    console.error(`[WA] ❌ Failed to send approval notification:`, error);
    // Don't throw - notification failure shouldn't break the flow
  }
}

/**
 * Send installation invoice notification
 * Includes payment link
 */
export async function sendInstallationInvoice(data: {
  customerName: string;
  customerPhone: string;
  invoiceNumber: string;
  amount: number;
  paymentLink: string;
  dueDate: Date;
}) {
  try {
    const company = await prisma.company.findFirst();
    const companyName = company?.name || 'AI-BILL RADIUS';
    const companyPhone = company?.phone || '';

    const dueDateStr = data.dueDate.toLocaleDateString('id-ID', {
      day: 'numeric',
      month: 'long',
      year: 'numeric',
      timeZone: 'Asia/Jakarta',
    });

    // Get template from database
    const templateContent = await getTemplate('installation-invoice');
    
    if (!templateContent) {
      console.warn('[WA] No template found for installation-invoice');
      return;
    }

    // Prepare variables
    const variables = {
      customerName: data.customerName,
      invoiceNumber: data.invoiceNumber,
      amount: `Rp ${data.amount.toLocaleString('id-ID')}`,
      dueDate: dueDateStr,
      paymentLink: data.paymentLink,
      companyName,
      companyPhone,
    };

    // Render template
    const message = renderTemplate(templateContent, variables);

    await WhatsAppService.sendMessage({
      phone: data.customerPhone,
      message,
    });
    
    console.log(`[WA] ✅ Invoice notification sent to ${data.customerPhone}`);
  } catch (error) {
    console.error(`[WA] ❌ Failed to send invoice notification:`, error);
  }
}

/**
 * Send admin create user notification
 * For manually created users by admin
 */
export async function sendAdminCreateUser(data: {
  customerName: string;
  customerPhone: string;
  username: string;
  password: string;
  profileName: string;
}) {
  try {
    const company = await prisma.company.findFirst();
    const companyName = company?.name || 'AI-BILL RADIUS';
    const companyPhone = company?.phone || '';

    // Get template from database
    const templateContent = await getTemplate('admin-create-user');
    
    if (!templateContent) {
      console.warn('[WA] No template found for admin-create-user');
      return;
    }

    // Prepare variables
    const variables = {
      customerName: data.customerName,
      username: data.username,
      password: data.password,
      profileName: data.profileName,
      companyName,
      companyPhone,
    };

    // Render template
    const message = renderTemplate(templateContent, variables);

    await WhatsAppService.sendMessage({
      phone: data.customerPhone,
      message,
    });
    
    console.log(`[WA] ✅ Admin create user notification sent to ${data.customerPhone}`);
  } catch (error) {
    console.error(`[WA] ❌ Failed to send admin create user notification:`, error);
    // Don't throw - notification failure shouldn't break the flow
  }
}

/**
 * Send invoice reminder notification
 * For monthly recurring invoices
 */
export async function sendInvoiceReminder(data: {
  phone: string;
  customerName: string;
  customerUsername?: string;
  invoiceNumber: string;
  amount: number;
  dueDate: Date;
  paymentLink: string;
  companyName: string;
  companyPhone: string;
}) {
  try {
    const dueDateStr = data.dueDate.toLocaleDateString('id-ID', {
      day: 'numeric',
      month: 'long',
      year: 'numeric',
      timeZone: 'Asia/Jakarta',
    });

    // Calculate days remaining
    const now = new Date();
    const dueDate = new Date(data.dueDate);
    const diffTime = dueDate.getTime() - now.getTime();
    const daysRemaining = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

    // Get template from database
    const templateContent = await getTemplate('invoice-reminder');
    
    if (!templateContent) {
      console.warn('[WA] No template found for invoice-reminder');
      return;
    }

    // Prepare variables
    const variables = {
      customerName: data.customerName,
      username: data.customerUsername || '-',
      invoiceNumber: data.invoiceNumber,
      amount: `Rp ${data.amount.toLocaleString('id-ID')}`,
      dueDate: dueDateStr,
      daysRemaining: daysRemaining.toString(),
      paymentLink: data.paymentLink,
      companyName: data.companyName,
      companyPhone: data.companyPhone,
    };

    // Render template
    const message = renderTemplate(templateContent, variables);

    await WhatsAppService.sendMessage({
      phone: data.phone,
      message,
    });
    
    console.log(`[WA] ✅ Invoice reminder sent to ${data.phone}`);
  } catch (error) {
    console.error(`[WA] ❌ Failed to send invoice reminder:`, error);
    throw error; // Re-throw to let cron handle it
  }
}

/**
 * Send payment success notification
 * Account activated
 */
export async function sendPaymentSuccess(data: {
  customerName: string;
  customerPhone: string;
  username: string;
  password: string;
  profileName: string;
  invoiceNumber: string;
  amount: number;
}) {
  try {
    const company = await prisma.company.findFirst();
    const companyName = company?.name || 'AI-BILL RADIUS';
    const companyPhone = company?.phone || '';

    // Get template from database
    const templateContent = await getTemplate('payment-success');
    
    if (!templateContent) {
      console.warn('[WA] No template found for payment-success');
      return;
    }

    // Prepare variables
    const variables = {
      customerName: data.customerName,
      username: data.username,
      password: data.password,
      profileName: data.profileName,
      invoiceNumber: data.invoiceNumber,
      amount: `Rp ${data.amount.toLocaleString('id-ID')}`,
      companyName,
      companyPhone,
    };

    // Render template
    const message = renderTemplate(templateContent, variables);

    await WhatsAppService.sendMessage({
      phone: data.customerPhone,
      message,
    });
    
    console.log(`[WA] ✅ Payment success notification sent to ${data.customerPhone}`);
  } catch (error) {
    console.error(`[WA] ❌ Failed to send payment success notification:`, error);
  }
}

/**
 * Send voucher purchase success notification
 * Sends voucher codes to customer after successful e-voucher payment
 */
export async function sendVoucherPurchaseSuccess(data: {
  customerName: string;
  customerPhone: string;
  orderNumber: string;
  profileName: string;
  quantity: number;
  voucherCodes: string[];
  validityValue: number;
  validityUnit: string;
}) {
  try {
    const company = await prisma.company.findFirst();
    const companyName = company?.name || 'AI-BILL RADIUS';
    const companyPhone = company?.phone || '';

    // Get template from database
    const templateContent = await getTemplate('voucher-purchase-success');
    
    if (!templateContent) {
      console.warn('[WA] No template found for voucher-purchase-success');
      return;
    }

    // Format voucher codes list
    const voucherList = data.voucherCodes.map((code, i) => `${i + 1}. ${code}`).join('\n');
    
    // Format validity
    const validityText = `${data.validityValue} ${data.validityUnit.toLowerCase()}`;

    // Prepare variables
    const variables = {
      customerName: data.customerName,
      orderNumber: data.orderNumber,
      profileName: data.profileName,
      quantity: data.quantity.toString(),
      voucherCodes: voucherList,
      validity: validityText,
      companyName,
      companyPhone,
    };

    // Render template
    const message = renderTemplate(templateContent, variables);

    await WhatsAppService.sendMessage({
      phone: data.customerPhone,
      message,
    });
    
    console.log(`[WA] ✅ Voucher purchase notification sent to ${data.customerPhone}`);
  } catch (error) {
    console.error(`[WA] ❌ Failed to send voucher purchase notification:`, error);
  }
}
