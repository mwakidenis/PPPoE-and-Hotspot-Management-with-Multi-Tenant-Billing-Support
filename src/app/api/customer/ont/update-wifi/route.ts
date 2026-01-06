import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getGenieACSCredentials } from '@/app/api/settings/genieacs/route';

export async function POST(request: NextRequest) {
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

    const body = await request.json();
    const { ssid, password } = body;

    if (!ssid && !password) {
      return NextResponse.json(
        { success: false, error: 'SSID atau password harus diisi' },
        { status: 400 }
      );
    }

    // Validate password length (WPA2: 8-63 characters)
    if (password && (password.length < 8 || password.length > 63)) {
      return NextResponse.json(
        { success: false, error: 'Password harus 8-63 karakter' },
        { status: 400 }
      );
    }

    // Get user
    const user = await prisma.pppoeUser.findUnique({
      where: { id: session.userId },
      select: { username: true },
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

    const { host, username, password: geniePassword } = credentials;

    // Get device by username
    const projection = ['_id', 'VirtualParameters.pppoeUsername', 'VirtualParameters.pppoeUsername2'].join(',');
    const devicesUrl = `${host}/devices?projection=${encodeURIComponent(projection)}`;

    const response = await fetch(devicesUrl, {
      method: 'GET',
      headers: {
        'Authorization': 'Basic ' + Buffer.from(`${username}:${geniePassword}`).toString('base64'),
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      throw new Error(`GenieACS API returned ${response.status}`);
    }

    const allDevices = await response.json();

    const device = allDevices.find((dev: any) => {
      const vp = dev.VirtualParameters || {};
      const vpUsername = vp.pppoeUsername?._value || vp.pppoeUsername2?._value;
      return vpUsername === user.username || vpUsername?.startsWith(user.username);
    });

    if (!device) {
      return NextResponse.json(
        { success: false, error: 'Device not found' },
        { status: 404 }
      );
    }

    const deviceId = device._id;
    const tasksUrl = `${host}/devices/${encodeURIComponent(deviceId)}/tasks`;
    const auth = 'Basic ' + Buffer.from(`${username}:${geniePassword}`).toString('base64');
    const tasks: string[] = [];

    // Update SSID
    if (ssid) {
      const ssidTask = {
        name: 'setParameterValues',
        parameterValues: [[
          'InternetGatewayDevice.LANDevice.1.WLANConfiguration.1.SSID',
          ssid
        ]]
      };

      await fetch(tasksUrl, {
        method: 'POST',
        headers: {
          'Authorization': auth,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(ssidTask),
      });
      tasks.push('SSID');
    }

    // Update Password using Virtual Parameter
    if (password) {
      const passwordTask = {
        name: 'setParameterValues',
        parameterValues: [[
          'VirtualParameters.WlanPassword',
          password
        ]]
      };

      await fetch(tasksUrl, {
        method: 'POST',
        headers: {
          'Authorization': auth,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(passwordTask),
      });
      tasks.push('Password');
    }

    // Trigger connection request
    const connectionRequestUrl = `${host}/devices/${encodeURIComponent(deviceId)}/tasks?connection_request`;
    try {
      await fetch(connectionRequestUrl, {
        method: 'POST',
        headers: { 'Authorization': auth },
      });
    } catch (error) {
      console.log('Connection request warning:', error);
    }

    return NextResponse.json({
      success: true,
      message: `Update ${tasks.join(' dan ')} berhasil. Perubahan akan diterapkan dalam 1-2 menit.`
    });
  } catch (error: any) {
    console.error('Update WiFi error:', error);
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    );
  }
}
