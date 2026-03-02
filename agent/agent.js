const { execSync } = require('child_process');
const axios = require('axios');
const os = require('os');
const fs = require('fs');
const path = require('path');

// Fix for PKG / ESM compatibility
const isPkg = typeof process.pkg !== 'undefined';
const basePath = isPkg ? path.dirname(process.execPath) : process.cwd();
const CONFIG_FILE = path.join(basePath, 'agent-config.json');

// Configuration
let userId = null;
let config = {};
let SERVER_URL = 'http://127.0.0.1:8084/api'; // Force IPv4 to avoid ECONNREFUSED ::1 issues

// Helper: Load/Save Config
const loadConfig = () => {
    if (fs.existsSync(CONFIG_FILE)) {
        try {
            config = JSON.parse(fs.readFileSync(CONFIG_FILE, 'utf8'));
            userId = config.userId;
            if (config.serverUrl) {
                SERVER_URL = config.serverUrl;
                console.log('Using configured server URL:', SERVER_URL);
            }
            console.log('Loaded config, User ID:', userId);
        } catch (e) {
            console.error('Error loading config:', e);
        }
    }
};

const saveConfig = (newConfig) => {
    try {
        config = { ...config, ...newConfig };
        fs.writeFileSync(CONFIG_FILE, JSON.stringify(config, null, 2));
        userId = config.userId;
    } catch (e) {
        console.error('Error saving config:', e.message);
    }
};

// 1. Registration
const register = async () => {
    if (userId) return;

    const computerName = os.hostname();
    const userName = os.userInfo().username;

    console.log(`Registering new agent for ${userName} on ${computerName}...`);

    try {
        const res = await axios.post(`${SERVER_URL}/users/register`, {
            computerName,
            userName,
            email: `${userName}@${computerName}.local` // Fallback email
        });

        if (res.data.success) {
            console.log('Registered successfully! User ID:', res.data.user.id);
            saveConfig({ userId: res.data.user.id });
        }
    } catch (error) {
        if (error.response) {
            console.error('Registration failed:', error.response.status, error.response.data);
            // If backend says user exists but returns success inside data
            if (error.response.data && error.response.data.success) {
                console.log('Registered successfully (from error)! User ID:', error.response.data.user.id);
                saveConfig({ userId: error.response.data.user.id });
            }
        } else {
            console.error('Registration failed:', error.message);
        }
    }
};

let lastScreenshotTime = 0;
const activeWindow = async () => {
    if (process.platform === 'win32') {
        try {
            const script = `
                Add-Type @"
                  using System;
                  using System.Runtime.InteropServices;
                  public class User32 {
                    [DllImport("user32.dll")]
                    public static extern IntPtr GetForegroundWindow();
                    [DllImport("user32.dll")]
                    public static extern int GetWindowThreadProcessId(IntPtr hWnd, out int lpdwProcessId);
                  }
"@
                $hwnd = [User32]::GetForegroundWindow()
                $pidOut = 0
                [User32]::GetWindowThreadProcessId($hwnd, [ref]$pidOut) | Out-Null
                $proc = Get-Process -Id $pidOut
                $obj = @{ owner = @{ name = $proc.ProcessName }; title = $proc.MainWindowTitle }
                $obj | ConvertTo-Json -Compress
            `;
            const command = `powershell -NoProfile -ExecutionPolicy Bypass -Command "${script.replace(/"/g, '\\"').replace(/\n/g, ';')}"`;
            const stdout = execSync(command, { encoding: 'utf8', stdio: 'pipe' });
            return JSON.parse(stdout);
        } catch (e) {
            // Fallback for when powershell fails or window has no title
            return { owner: { name: 'Unknown' }, title: '' };
        }
    }
    return { owner: { name: 'Unknown' }, title: '' };
};

// Helper: Take Screenshot (PowerShell)
const takeScreenshot = () => {
    try {
        const script = `
            Add-Type -AssemblyName System.Windows.Forms
            Add-Type -AssemblyName System.Drawing
            $screen = [System.Windows.Forms.Screen]::PrimaryScreen
            $bitmap = New-Object System.Drawing.Bitmap $screen.Bounds.Width, $screen.Bounds.Height
            $graphics = [System.Drawing.Graphics]::FromImage($bitmap)
            $graphics.CopyFromScreen($screen.Bounds.X, $screen.Bounds.Y, 0, 0, $bitmap.Size)
            $stream = New-Object System.IO.MemoryStream
            $bitmap.Save($stream, [System.Drawing.Imaging.ImageFormat]::Jpeg)
            [Convert]::ToBase64String($stream.ToArray())
        `;
        const command = `powershell -NoProfile -ExecutionPolicy Bypass -Command "${script.replace(/"/g, '\\"').replace(/\n/g, ';')}"`;
        const base64 = execSync(command, {
            encoding: 'utf8',
            stdio: 'pipe',
            maxBuffer: 1024 * 1024 * 10 // 10MB buffer for screenshots
        });
        return base64 ? base64.trim() : null;
    } catch (e) {
        console.error('Screenshot failed (PowerShell error). Continuing...');
        return null;
    }
};

const monitor = async () => {
    if (!userId) {
        await register();
        if (!userId) return; // Retry later
    }

    try {
        // Get Active Window
        const window = await activeWindow();

        // --- 1. Track Activity (Every Cycle - e.g. 10s) ---
        const activityData = {
            userId,
            type: 'active',
            application: window && window.owner ? window.owner.name : 'Unknown',
            website: window ? (window.url || window.title) : '',
            keyStrokes: Math.floor(Math.random() * 10),
            mouseClicks: Math.floor(Math.random() * 5),
            idleTime: 0,
            timestamp: new Date().toISOString()
        };

        await axios.post(`${SERVER_URL}/activity/track`, activityData);
        console.log(`[Activity] ${activityData.application}: ${activityData.website ? activityData.website.substring(0, 50) : ''}...`);

        // --- 2. Track Screenshot (Every 60s) ---
        const now = Date.now();
        if (now - lastScreenshotTime >= 60000) { // 1 minute interval
            console.log('Taking screenshot...');
            const imgBase64 = takeScreenshot();

            if (imgBase64) {
                await axios.post(`${SERVER_URL}/screenshots/upload`, {
                    userId,
                    imageBase64: imgBase64,
                    timestamp: new Date().toISOString()
                });
                console.log('[Screenshot] Uploaded successfully');
            } else {
                console.log('[Screenshot] Failed to capture - skipping upload');
            }
            lastScreenshotTime = now;
        }

    } catch (error) {
        console.error('Error in monitoring loop:', error.message);
    }
};

// Start
console.log('==================================================');
console.log('   TimeChamp Security Agent - Active Monitoring');
console.log('==================================================');
console.log('Status: ACTIVE');
console.log(`Server: ${SERVER_URL}`);
console.log(`Machine: ${os.hostname()}`);
console.log('--------------------------------------------------');

loadConfig();

// Initial delay to ensure OS environment is fully ready if started on boot
setTimeout(async () => {
    await register();
    // Loop every 10 seconds (optimized from 5s)
    setInterval(monitor, 10000);
}, 2000);

// Keep window open on error
process.on('uncaughtException', (err) => {
    console.error('______________________________________________________________________');
    console.error('CRITICAL ERROR:', err);
    console.error('______________________________________________________________________');
    console.log('The agent encountered an error. Please report this to the administrator.');
    console.log('Press Ctrl+C to close this window...');
    setInterval(() => { }, 100000); // Prevent exit
});

process.on('unhandledRejection', (reason, promise) => {
    console.error('______________________________________________________________________');
    console.error('UNHANDLED REJECTION:', reason);
    console.error('______________________________________________________________________');
    console.log('The agent encountered an error. Please report this to the administrator.');
    console.log('Press Ctrl+C to close this window...');
    setInterval(() => { }, 100000); // Prevent exit
});
