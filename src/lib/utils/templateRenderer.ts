/**
 * Render voucher template with actual data
 * Replaces Smarty-style variables like {$vs['code']}, {$_c['currency_code']}, etc.
 */

interface VoucherData {
  code: string
  secret?: string
  total: number
  profile?: {
    name?: string
  }
}

interface RenderContext {
  currencyCode?: string
  companyName?: string
}

export function renderVoucherTemplate(
  templateHtml: string,
  vouchers: VoucherData[],
  context?: RenderContext
): string {
  const currencyCode = context?.currencyCode || 'IDR'
  const companyName = context?.companyName || 'AIBILL'

  // Split template into header, body, footer
  const headerMatch = templateHtml.match(/\{include file="rad-template-header\.tpl"\}([\s\S]*?)\{foreach/)
  const foreachMatch = templateHtml.match(/\{foreach \$v as \$vs\}([\s\S]*?)\{\/foreach\}/)
  const footerMatch = templateHtml.match(/\{\/foreach\}([\s\S]*?)\{include file="rad-template-footer\.tpl"\}/)

  const header = headerMatch ? headerMatch[1].trim() : ''
  const bodyTemplate = foreachMatch ? foreachMatch[1].trim() : templateHtml
  const footer = footerMatch ? footerMatch[1].trim() : ''

  // Render each voucher
  const renderedVouchers = vouchers.map(vs => {
    let html = bodyTemplate

    // Replace voucher variables
    html = html.replace(/\{\$vs\['code'\]\}/g, vs.code)
    html = html.replace(/\{\$vs\['secret'\]\}/g, vs.secret || vs.code)
    html = html.replace(/\{\$vs\['total'\]\}/g, vs.total.toString())
    
    // Replace conditional for code/secret
    html = html.replace(
      /\{if \$vs\['code'\] eq \$vs\['secret'\]\}([\s\S]*?)\{else\}([\s\S]*?)\{\/if\}/g,
      (_, ifBlock, elseBlock) => {
        return vs.code === (vs.secret || vs.code) ? ifBlock : elseBlock
      }
    )

    // Replace number_format function
    html = html.replace(
      /\{number_format\(\$vs\['total'\],\s*(\d+),\s*'([^']*)',\s*'([^']*)'\)\}/g,
      (_, decimals, decPoint, thousandsSep) => {
        return formatNumber(vs.total, parseInt(decimals), decPoint, thousandsSep)
      }
    )

    // Replace context variables
    html = html.replace(/\{\$_c\['currency_code'\]\}/g, currencyCode)
    html = html.replace(/\{company_name\}/g, companyName)

    return html
  }).join('\n')

  // Combine header + vouchers + footer
  return `${header}\n${renderedVouchers}\n${footer}`
}

/**
 * Format number with thousand separators
 */
function formatNumber(
  num: number,
  decimals: number = 0,
  decPoint: string = '.',
  thousandsSep: string = ','
): string {
  const parts = num.toFixed(decimals).split('.')
  parts[0] = parts[0].replace(/\B(?=(\d{3})+(?!\d))/g, thousandsSep)
  return parts.join(decPoint)
}

/**
 * Get printable HTML with proper styling for print
 */
export function getPrintableHtml(renderedHtml: string): string {
  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <title>Print Vouchers</title>
  <style>
    @media print {
      @page {
        size: A4;
        margin: 10mm;
      }
      body {
        margin: 0;
        padding: 0;
      }
    }
    body {
      font-family: Arial, sans-serif;
      margin: 0;
      padding: 10px;
    }
  </style>
</head>
<body>
${renderedHtml}
</body>
</html>
  `.trim()
}
