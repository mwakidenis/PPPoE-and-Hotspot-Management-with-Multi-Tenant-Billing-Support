import { NextRequest, NextResponse } from 'next/server';
import { getGenieACSCredentials } from '../route';

// POST - Queue task to GenieACS for a device
export async function POST(request: NextRequest) {
  try {
    const credentials = await getGenieACSCredentials();

    if (!credentials) {
      return NextResponse.json(
        { error: 'GenieACS not configured' },
        { status: 400 }
      );
    }

    const { host, username, password } = credentials;
    const body = await request.json();
    const { deviceId, taskName } = body as { deviceId: string; taskName: string };

    if (!deviceId || !taskName) {
      return NextResponse.json(
        { error: 'deviceId and taskName are required' },
        { status: 400 }
      );
    }

    // Map simple names to GenieACS preset tasks
    const taskMapping: Record<string, any> = {
      reboot: {
        name: 'reboot',
        parameterValues: [],
      },
      factoryReset: {
        name: 'factoryReset',
        parameterValues: [],
      },
      getParameterValues: {
        name: 'refreshObject',
        objectName: '',
      },
    };

    const taskConfig = taskMapping[taskName] || { name: taskName };

    // Use tasks?connection_request to queue task
    const response = await fetch(`${host}/devices/${encodeURIComponent(deviceId)}/tasks?connection_request`, {
      method: 'POST',
      headers: {
        'Authorization': 'Basic ' + Buffer.from(`${username}:${password}`).toString('base64'),
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(taskConfig),
    });

    if (!response.ok) {
      const text = await response.text();
      throw new Error(`GenieACS tasks API returned ${response.status}: ${text}`);
    }

    const data = await response.json();

    return NextResponse.json({ success: true, data });
  } catch (error: any) {
    console.error('Error queueing GenieACS task:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to queue task' },
      { status: 500 }
    );
  }
}
