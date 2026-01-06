import { NextResponse } from 'next/server';
import { RouterOSAPI } from 'node-routeros';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

export async function POST(request: Request) {
  const results = {
    l2tp: false,
    sstp: false,
    pptp: false,
  };

  try {
    const { host, username, password, port, subnet } = await request.json();
    
    // Parse subnet to get network info
    const subnetParts = (subnet || '10.20.30.0/24').split('/');
    const baseIp = subnetParts[0].split('.');
    const networkBase = `${baseIp[0]}.${baseIp[1]}.${baseIp[2]}`;
    const localAddress = `${networkBase}.1`;
    const poolRange = `${networkBase}.2-${networkBase}.254`;
    const subnetCidr = `${networkBase}.0/24`;

    const conn = new RouterOSAPI({
      host,
      user: username,
      password,
      port: port || 8728,
      timeout: 10,
    });

    await conn.connect();

    // 1. Create IP Pool
    try {
      await conn.write('/ip/pool/add', [
        '=name=vpn-pool',
        `=ranges=${poolRange}`,
      ]);
    } catch (e: any) {
      // Pool might already exist
      if (!e.message?.includes('already have')) {
        console.log('IP Pool creation skipped:', e.message);
      }
    }

    // 2. Create PPP Profile
    try {
      await conn.write('/ppp/profile/add', [
        '=name=vpn-profile',
        `=local-address=${localAddress}`,
        '=remote-address=vpn-pool',
        '=dns-server=8.8.8.8,8.8.4.4',
        '=use-encryption=yes',
      ]);
    } catch (e: any) {
      if (!e.message?.includes('already have')) {
        console.log('PPP Profile creation skipped:', e.message);
      }
    }

    // 3. Setup L2TP Server
    try {
      await conn.write('/interface/l2tp-server/server/set', [
        '=enabled=yes',
        '=default-profile=vpn-profile',
        '=authentication=mschap2',
        '=use-ipsec=yes',
        '=ipsec-secret=aibill-secret',
      ]);
      results.l2tp = true;
    } catch (e) {
      console.error('L2TP setup failed:', e);
    }

    // 4. Setup SSTP Server
    try {
      await conn.write('/interface/sstp-server/server/set', [
        '=enabled=yes',
        '=default-profile=vpn-profile',
        '=authentication=mschap2',
        '=certificate=none',
        '=port=443',
      ]);
      results.sstp = true;
    } catch (e) {
      console.error('SSTP setup failed:', e);
    }

    // 5. Setup PPTP Server
    try {
      await conn.write('/interface/pptp-server/server/set', [
        '=enabled=yes',
        '=default-profile=vpn-profile',
        '=authentication=mschap2',
      ]);
      results.pptp = true;
    } catch (e) {
      console.error('PPTP setup failed:', e);
    }

    // 6. Add NAT Masquerade (if not exists)
    try {
      const natRules = await conn.write('/ip/firewall/nat/print');
      const hasMasquerade = natRules.some(
        (rule: any) => 
          rule.chain === 'srcnat' && 
          rule.action === 'masquerade' &&
          rule['src-address'] === subnetCidr
      );

      if (!hasMasquerade) {
        await conn.write('/ip/firewall/nat/add', [
          '=chain=srcnat',
          `=src-address=${subnetCidr}`,
          '=action=masquerade',
          '=comment=VPN NAT',
        ]);
      }
    } catch (e) {
      console.error('NAT setup failed:', e);
    }

    await conn.close();

    // Save to database
    const existing = await prisma.vpnServer.findFirst();
    if (existing) {
      await prisma.vpnServer.update({
        where: { id: existing.id },
        data: {
          host,
          username,
          password,
          port: port || 8728,
          subnet: subnet || '10.20.30.0/24',
          l2tpEnabled: results.l2tp,
          sstpEnabled: results.sstp,
          pptpEnabled: results.pptp,
          isConfigured: true,
        },
      });
    } else {
      await prisma.vpnServer.create({
        data: {
          id: crypto.randomUUID(),
          host,
          username,
          password,
          port: port || 8728,
          subnet: subnet || '10.20.30.0/24',
          l2tpEnabled: results.l2tp,
          sstpEnabled: results.sstp,
          pptpEnabled: results.pptp,
          isConfigured: true,
        },
      });
    }

    return NextResponse.json({
      success: true,
      message: 'VPN server configured successfully',
      ...results,
    });
  } catch (error: any) {
    console.error('Setup error:', error);
    return NextResponse.json({
      success: false,
      message: error.message || 'Setup failed',
      ...results,
    }, { status: 500 });
  }
}
