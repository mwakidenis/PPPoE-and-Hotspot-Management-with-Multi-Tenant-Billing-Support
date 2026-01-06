import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

// Track last restart time to prevent concurrent restarts
let lastRestartTime = 0;
const RESTART_COOLDOWN = 3000; // 3 seconds cooldown

/**
 * Restart FreeRADIUS service
 * Requires sudoers permission for PM2 user
 */
export async function reloadFreeRadius(): Promise<void> {
  const now = Date.now();
  
  // Prevent concurrent restarts
  if (now - lastRestartTime < RESTART_COOLDOWN) {
    console.log('FreeRADIUS restart skipped (cooldown active)');
    return;
  }

  try {
    lastRestartTime = now;
    
    // Restart FreeRADIUS service via sudo
    const { stdout, stderr } = await execAsync('sudo systemctl restart freeradius', {
      timeout: 10000, // 10 second timeout
    });

    if (stderr) {
      console.error('FreeRADIUS restart stderr:', stderr);
    }

    console.log('FreeRADIUS restarted successfully');
  } catch (error: any) {
    console.error('Failed to restart FreeRADIUS:', error.message);
    // Don't throw error - NAS update is more important
    // FreeRADIUS can be restarted manually if needed
  }
}
