const { app, BrowserWindow, ipcMain, Menu, Tray, screen } = require('electron');
const { execSync } = require('child_process');
const axios = require('axios');
const os = require('os');
const fs = require('fs');
const path = require('path');
const net = require('net');
const { uIOhook, UiohookKey } = require('uiohook-napi');

// --- Helpers ---
const getIPAddress = () => {
    const interfaces = os.networkInterfaces();
    for (const name of Object.keys(interfaces)) {
        for (const iface of interfaces[name]) {
            if (('IPv4' === iface.family || iface.family === 4) && !iface.internal) {
                return iface.address;
            }
        }
    }
    return '127.0.0.1';
};

const getISTISOString = () => {
    const d = new Date();
    const utc = d.getTime() + (d.getTimezoneOffset() * 60000);
    const nd = new Date(utc + (3600000 * 5.5));
    const pad = (n) => (n < 10 ? '0' + n : n);
    return `${nd.getFullYear()}-${pad(nd.getMonth() + 1)}-${pad(nd.getDate())}T${pad(nd.getHours())}:${pad(nd.getMinutes())}:${pad(nd.getSeconds())}.000+05:30`;
};

let mainWindow;
let tray = null;
let isTracking = false;
let trackingInterval = null;
let lastScreenshotTime = 0;
let checkInTime = null;
let trackingSeconds = 0;
let timerInterval = null;

let currentKeyStrokes = 0;
let currentMouseClicks = 0;

let config = {};
let userId = null;
let screenshotInterval = 300000; // Default 5 minutes
// You can change your server url if needed or pass via config
let SERVER_URL = 'http://103.181.108.248/api';
const CONFIG_FILE = path.join(app.getPath('userData'), 'agent-config.json');

// --- Config Handling ---
const loadConfig = () => {
    if (fs.existsSync(CONFIG_FILE)) {
        try {
            config = JSON.parse(fs.readFileSync(CONFIG_FILE, 'utf8'));
            userId = config.userId;
            console.log(`[CONFIG] Loaded User ID: ${userId}`);
            // Robust SERVER_URL check
            // Removed dynamic SERVER_URL from config to strictly enforce cloud database.
        } catch (e) {
            console.error('[CONFIG] Error loading config:', e);
        }
    } else {
        console.log('[CONFIG] Config file not found, creating directory...');
        if (!fs.existsSync(path.dirname(CONFIG_FILE))) {
            fs.mkdirSync(path.dirname(CONFIG_FILE), { recursive: true });
        }
    }
};

const saveConfig = (newConfig) => {
    try {
        config = { ...config, ...newConfig };
        if (!fs.existsSync(path.dirname(CONFIG_FILE))) {
            fs.mkdirSync(path.dirname(CONFIG_FILE), { recursive: true });
        }
        fs.writeFileSync(CONFIG_FILE, JSON.stringify(config, null, 2));
        userId = config.userId;
    } catch (e) {
        console.error('[CONFIG] Error saving config:', e.message);
    }
};

// --- Auto IP Discovery ---
async function autoDiscoverServerIP() {
    return new Promise((resolve) => {
        const interfaces = os.networkInterfaces();
        const subnetIps = [];

        for (const name of Object.keys(interfaces)) {
            for (const iface of interfaces[name]) {
                if ('IPv4' !== iface.family || iface.internal !== false) {
                    continue;
                }
                const parts = iface.address.split('.');
                const baseIp = parts.slice(0, 3).join('.');
                for (let i = 1; i < 255; i++) {
                    subnetIps.push(`${baseIp}.${i}`);
                }
            }
        }

        let found = false;
        let pending = subnetIps.length;
        if (pending === 0) return resolve(null);

        const globalTimeout = setTimeout(() => {
            if (!found) resolve(null);
        }, 5000); // 5 sec max discovery wait

        subnetIps.forEach(ip => {
            if (found) return;
            const socket = new net.Socket();
            socket.setTimeout(2000);

            socket.on('connect', () => {
                if (!found) {
                    found = true;
                    clearTimeout(globalTimeout);
                    resolve(`http://${ip}:8084/api`);
                }
                socket.destroy();
            }).on('error', () => {
                socket.destroy();
                pending--;
                if (pending === 0 && !found) {
                    clearTimeout(globalTimeout);
                    resolve(null);
                }
            }).on('timeout', () => {
                socket.destroy();
                pending--;
                if (pending === 0 && !found) {
                    clearTimeout(globalTimeout);
                    resolve(null);
                }
            });
            socket.connect(8084, ip);
        });
    });
}

// --- Registration ---
const register = async () => {
    let computerName = 'Unknown-PC';
    let userName = 'Unknown-User';

    try {
        const ip = getIPAddress();
        computerName = `${os.hostname()}_${ip}`;
        const userInfo = os.userInfo();
        userName = userInfo ? userInfo.username : (process.env.USERNAME || 'User');
    } catch (e) {
        console.error('Core OS info fetch failed:', e.message);
    }

    console.log('--------------------------------------------------');
    console.log(`Starting registration for ${userName} on ${computerName}...`);

    const registrationData = {
        computerName,
        userName,
        email: `${userName.toLowerCase().replace(/\s+/g, '.')}.${computerName.toLowerCase()}@internal.monitor`
    };

    // Ensure SERVER_URL is standardized before sending
    if (SERVER_URL.endsWith('/')) SERVER_URL = SERVER_URL.slice(0, -1);
    if (!SERVER_URL.endsWith('/api')) SERVER_URL += '/api';

    // 1. Try configured Cloud SERVER_URL first (Production default)
    try {
        console.log(`[REG] Attempting registration at default server ${SERVER_URL}/users/register...`);
        const res = await axios.post(`${SERVER_URL}/users/register`, registrationData);
        if (res.data.success && res.data.user) {
            console.log("[REG] Registration successful via Cloud URL. ID:", res.data.user.id);
            saveConfig({ userId: res.data.user.id });
            return;
        } else {
            console.log("[REG] Registration response received but success was false:", JSON.stringify(res.data));
        }
    } catch (error) {
        if (error.response) {
            console.error(`[REG] Cloud server returned error [${error.response.status}]:`, JSON.stringify(error.response.data));
        } else if (error.request) {
            console.error('[REG] Cloud server unreachable. No response received.');
        } else {
            console.error('[REG] Registration setup error:', error.message);
        }
    }

    // --- Localhost fallback removed to enforce production use ---

    // Final Fallback: Keep trying production URL
    if (!userId) {
        console.error('[REG] Registration failed at production server. Retrying soon...');
    }
    console.log('--------------------------------------------------');

    // Fetch user settings after registration/load
    if (userId) {
        try {
            console.log(`[AGENT] Fetching settings from ${SERVER_URL}/users/${userId}...`);
            const settingsRes = await axios.get(`${SERVER_URL}/users/${userId}`);
            if (settingsRes.data && settingsRes.data.screenshotInterval) {
                // Ignore backend and lock to 5 minutes
                screenshotInterval = 300000;
                console.log(`[AGENT] Screenshot interval locked to ${screenshotInterval}ms`);
            }
        } catch (e) {
            console.error('[AGENT] Failed to fetch settings:', e.message);
        }
    }
};

// --- Monitoring Functions ---
const activeWindow = async () => {
    if (process.platform === 'win32') {
        try {
            // Using a more robust PowerShell script to get foreground window, name and title.
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
                try {
                    $hwnd = [User32]::GetForegroundWindow()
                    if ($hwnd -ne [IntPtr]::Zero) {
                        $pidOut = 0
                        [User32]::GetWindowThreadProcessId($hwnd, [ref]$pidOut) | Out-Null
                        $proc = Get-Process -Id $pidOut
                        $obj = @{ owner = @{ name = $proc.ProcessName }; title = $proc.MainWindowTitle }
                        $obj | ConvertTo-Json -Compress
                    } else {
                        '{"owner":{"name":"Idle"},"title":""}'
                    }
                } catch {
                    '{"owner":{"name":"Unknown"},"title":""}'
                }
            `;
            // Base64 encoding the command is the SAFEST way to pass complex PS to PowerShell via shell
            const encodedScript = Buffer.from(script, 'utf16le').toString('base64');
            const command = `powershell -NoProfile -ExecutionPolicy Bypass -EncodedCommand ${encodedScript}`;
            const stdout = execSync(command, { encoding: 'utf8', stdio: 'pipe' });
            return JSON.parse(stdout.trim());
        } catch (e) {
            console.error('[AGENT] activeWindow failed:', e.message);
            return { owner: { name: 'Unknown' }, title: '' };
        }
    }
    return { owner: { name: 'Unknown' }, title: '' };
};

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
            maxBuffer: 1024 * 1024 * 10
        });
        return base64 ? base64.trim() : null;
    } catch (e) {
        console.error('Screenshot failed. Continuing...');
        return null;
    }
};

const monitor = async () => {
    if (!isTracking) return;
    if (!userId) {
        await register();
        if (!userId) return;
    }

    try {
        // 1. Get the Active Window (foreground priority)
        const activeWin = await activeWindow();
        console.log(`[TRACKER] Active App: ${activeWin.owner ? activeWin.owner.name : 'Unknown'}`);

        // 2. Get ALL Running Apps/Windows (for 'Applications Used' and 'Websites')
        let runningApps = [];
        try {
            const script = `Get-Process | Where-Object {$_.MainWindowTitle -ne ''} | Select-Object @{N='ProcessName';E={$_.ProcessName}}, @{N='MainWindowTitle';E={$_.MainWindowTitle}} | ConvertTo-Json -Compress`;
            const encodedScript = Buffer.from(script, 'utf16le').toString('base64');
            const psCommandForRunning = `powershell -NoProfile -ExecutionPolicy Bypass -EncodedCommand ${encodedScript}`;
            const stdout = execSync(psCommandForRunning, { encoding: 'utf8' });
            if (stdout.trim()) {
                const parsed = JSON.parse(stdout);
                runningApps = Array.isArray(parsed) ? parsed : [parsed];
            }
        } catch (e) {
            console.error('[TRACKER] Error detecting running apps:', e.message);
        }

        console.log(`[TRACKER] Syncing ${runningApps.length} processes`);

        // Grab values and reset for next interval
        const keys = currentKeyStrokes;
        const clicks = currentMouseClicks;
        currentKeyStrokes = 0;
        currentMouseClicks = 0;

        // 3. Send ACTIVE Ping
        const activeData = {
            userId,
            type: 'active',
            application: activeWin && activeWin.owner ? activeWin.owner.name : 'Unknown',
            website: activeWin ? activeWin.title : '',
            keyStrokes: keys,
            mouseClicks: clicks,
            idleTime: 0,
            timestamp: getISTISOString()
        };

        axios.post(`${SERVER_URL}/activity/track`, activeData)
            .then(() => console.log(`[TRACKER] Active ping SENT: ${activeData.application}`))
            .catch(err => console.error(`[TRACKER] ACTIVE SYNC FAILED: ${err.message}`));

        // 4. Send BACKGROUND pings for other open windows
        const activeAppNameLower = (activeWin && activeWin.owner ? activeWin.owner.name : '').toLowerCase();

        for (const app of runningApps) {
            if (!app.ProcessName || app.ProcessName.toLowerCase() === activeAppNameLower) continue;

            const bgActivity = {
                userId,
                type: 'background', // Mark as background for analytics
                application: app.ProcessName,
                website: app.MainWindowTitle || '',
                keyStrokes: 0,
                mouseClicks: 0,
                idleTime: 10,
                timestamp: getISTISOString()
            };
            axios.post(`${SERVER_URL}/activity/track`, bgActivity).catch(() => null);
        }

        // Screenshot based on saved interval
        const now = Date.now();
        if (now - lastScreenshotTime >= screenshotInterval) {
            const imgBase64 = takeScreenshot();
            if (imgBase64) {
                axios.post(`${SERVER_URL}/screenshots/upload`, {
                    userId,
                    imageBase64: imgBase64,
                    timestamp: getISTISOString()
                }).catch(() => null);
            }
            lastScreenshotTime = now;
        }
    } catch (error) {
        console.error('Error in monitoring loop:', error.message);
    }
};

// Hook events
uIOhook.on('keydown', (e) => {
    if (isTracking) currentKeyStrokes++;
});

uIOhook.on('mousedown', (e) => {
    if (isTracking) currentMouseClicks++;
});

// --- App Lifecycle ---
function createWindow() {
    const primaryDisplay = screen.getPrimaryDisplay();
    const { width, height } = primaryDisplay.workAreaSize;

    const winWidth = 240;
    const winHeight = 140;
    const marginX = 20;
    const marginY = 20;

    mainWindow = new BrowserWindow({
        width: winWidth,
        height: winHeight,
        x: width - winWidth - marginX,
        y: height - winHeight - marginY,
        resizable: true, // Allow slight resizing if user desires, but mostly fixed by default
        alwaysOnTop: true,
        frame: false,
        transparent: true,
        show: false,
        webPreferences: {
            nodeIntegration: false,
            contextIsolation: true,
            preload: path.join(__dirname, 'preload.js')
        }
    });

    mainWindow.loadFile('index.html');
    mainWindow.setMenuBarVisibility(false);

    mainWindow.once('ready-to-show', () => {
        mainWindow.show();
    });

    mainWindow.on('close', (event) => {
        if (!app.isQuiting) {
            event.preventDefault();
            mainWindow.hide();
        }
        return false;
    });
}

// --- IPC Handlers ---
ipcMain.handle('get-status', () => {
    return {
        isTracking,
        trackingSeconds,
        checkInTime: checkInTime ? getISTISOString() : null,
        computerName: `${os.hostname()}_${getIPAddress()}`,
        userName: os.userInfo() ? os.userInfo().username : 'Unknown',
        userId: userId || 'Not Registered',
        serverUrl: SERVER_URL
    };
});

ipcMain.on('start-tracking', () => {
    if (!isTracking) {
        isTracking = true;
        if (!checkInTime) checkInTime = new Date(); // Start fresh if completely stopped before
        // Immediately take a screenshot when they press start
        lastScreenshotTime = 0;

        // Timer for the UI Check In Time
        if (!timerInterval) {
            timerInterval = setInterval(() => {
                if (isTracking) trackingSeconds++;
            }, 1000);
        }

        // Monitoring loop (Activity data) -> every 10 seconds
        if (!trackingInterval) {
            currentKeyStrokes = 0;
            currentMouseClicks = 0;
            uIOhook.start(); // Start listening to inputs globally
            trackingInterval = setInterval(monitor, 10000);
            monitor(); // call immediately once
        }
        console.log("Tracking started.");
    }
});

ipcMain.on('pause-tracking', () => {
    if (isTracking) {
        isTracking = false;
        if (trackingInterval) {
            clearInterval(trackingInterval);
            trackingInterval = null;
            uIOhook.stop(); // Stop listening
        }
        if (timerInterval) {
            clearInterval(timerInterval);
            timerInterval = null;
        }
        console.log("Tracking paused.");
    }
});

ipcMain.on('stop-tracking', () => {
    isTracking = false;
    trackingSeconds = 0;
    checkInTime = null;
    if (trackingInterval) {
        clearInterval(trackingInterval);
        trackingInterval = null;
        uIOhook.stop(); // Stop listening
    }
    if (timerInterval) {
        clearInterval(timerInterval);
        timerInterval = null;
    }
    console.log("Tracking stopped.");
});

ipcMain.handle('test-connection', async () => {
    try {
        console.log(`[TEST] Testing connection to ${SERVER_URL}/users/register...`);
        const registrationData = {
            computerName: `${os.hostname()}_TEST`,
            userName: 'TestUser',
            email: 'test@example.com'
        };
        const res = await axios.post(`${SERVER_URL}/users/register`, registrationData, { timeout: 8000 });
        return {
            success: true,
            message: 'Connected successfully!',
            details: `Status: ${res.status}, User ID: ${res.data.user?.id || 'N/A'}`
        };
    } catch (error) {
        let msg = error.message;
        if (error.response) msg = `Server Error: ${error.response.status} - ${JSON.stringify(error.response.data)}`;
        else if (error.request) msg = 'No response from server. Check firewall or internet.';
        return { success: false, message: 'Connection Failed', details: msg };
    }
});

app.whenReady().then(async () => {
    loadConfig();
    await register();
    createWindow();

    tray = new Tray(path.join(__dirname, 'icon.png')); // ensure we have some dummy or valid icon.png or use electron's default
    const contextMenu = Menu.buildFromTemplate([
        { label: 'Show App', click: () => mainWindow.show() },
        {
            label: 'Quit', click: () => {
                app.isQuiting = true;
                app.quit();
            }
        }
    ]);
    tray.setToolTip('Employee Tracker');
    tray.setContextMenu(contextMenu);

    app.on('activate', function () {
        if (BrowserWindow.getAllWindows().length === 0) createWindow();
    });
});

app.on('window-all-closed', function () {
    if (process.platform !== 'darwin') app.quit();
});
