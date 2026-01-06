import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getGenieACSCredentials } from '@/app/api/settings/genieacs/route';

export async function GET(request: NextRequest) {
  try {
    const token = request.headers.get('authorization')?.replace('Bearer ', '');

    if (!token) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 401 }
      );
    }

    // Find session by token
    const session = await prisma.customerSession.findFirst({
      where: {
        token,
        verified: true,
        expiresAt: { gte: new Date() },
      },
    });

    if (!session) {
      return NextResponse.json(
        { success: false, error: 'Invalid or expired token' },
        { status: 401 }
      );
    }

    // Get user with username for PPPoE
    const user = await prisma.pppoeUser.findUnique({
      where: { id: session.userId },
      select: {
        username: true,
      },
    });

    if (!user) {
      return NextResponse.json(
        { success: false, error: 'User not found' },
        { status: 404 }
      );
    }

    // Get GenieACS credentials
    const credentials = await getGenieACSCredentials();

    if (!credentials) {
      return NextResponse.json(
        { success: false, error: 'GenieACS not configured' },
        { status: 503 }
      );
    }

    const { host, username, password } = credentials;

    // Get devices with projection - Virtual Parameters + WiFi config
    const projection = [
      '_id',
      '_deviceId',
      '_lastInform',
      'VirtualParameters',
      'InternetGatewayDevice.LANDevice.1.WLANConfiguration.1.SSID',
      'InternetGatewayDevice.LANDevice.1.WLANConfiguration.1.Enable',
      'InternetGatewayDevice.LANDevice.1.WLANConfiguration.1.Channel',
      'InternetGatewayDevice.LANDevice.1.WLANConfiguration.1.TotalAssociations'
    ].join(',');
    const devicesUrl = `${host}/devices?projection=${encodeURIComponent(projection)}`;

    const response = await fetch(devicesUrl, {
      method: 'GET',
      headers: {
        'Authorization': 'Basic ' + Buffer.from(`${username}:${password}`).toString('base64'),
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      throw new Error(`GenieACS API returned ${response.status}`);
    }

    const allDevices = await response.json();

    // Filter devices by PPPoE username - ONLY Virtual Parameters
    const device = allDevices.find((dev: any) => {
      const vp = dev.VirtualParameters || {};
      const vpUsername = vp.pppoeUsername?._value || vp.pppoeUsername2?._value || vp.pppUsername?._value;
      
      return vpUsername === user.username || vpUsername?.startsWith(user.username);
    });

    if (!device) {
      return NextResponse.json({
        success: true,
        device: null,
        message: 'No ONT device found for this account',
      });
    }

    // Extract info from Virtual Parameters + WiFi from original parameters
    const vp = device.VirtualParameters || {};
    const wlanConfig = device['InternetGatewayDevice']?.LANDevice?.[1]?.WLANConfiguration?.[1];
    
    // Get active clients from WLANConfiguration.1.TotalAssociations (not VP)
    const totalAssociations = wlanConfig?.TotalAssociations?._value || 0;
    
    // Check if device is online (lastInform within last 5 minutes)
    const lastInformDate = device._lastInform ? new Date(device._lastInform) : null;
    const now = new Date();
    const isOnline = lastInformDate ? (now.getTime() - lastInformDate.getTime()) < (5 * 60 * 1000) : false;
    
    const deviceInfo = {
      serialNumber: vp.getSerialNumber?._value || 'N/A',
      manufacturer: device._deviceId?._Manufacturer || 'N/A',
      model: device._deviceId?._ProductClass || 'N/A',
      ipAddress: vp.pppoeIP?._value || 'N/A',
      uptime: vp.getdeviceuptime?._value || 'N/A',
      lastInform: device._lastInform || null,
      connectionStatus: isOnline ? 'Online' : 'Offline',
      rxPower: vp.RXPower?._value || 'N/A',
      temperature: vp.gettemp?._value || 'N/A',
      activeClients: totalAssociations,
      ponMode: vp.getponmode?._value || 'N/A',
      
      // WiFi Info - Password from VP, rest from original
      wifiSSID: wlanConfig?.SSID?._value || 'N/A',
      wifiPassword: vp.WlanPassword?._value || null,
      wifiEnabled: wlanConfig?.Enable?._value || false,
      wifiChannel: wlanConfig?.Channel?._value || 'N/A',
    };

    return NextResponse.json({
      success: true,
      device: deviceInfo,
    });
  } catch (error: any) {
    console.error('Get ONT error:', error);
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    );
  }
}
