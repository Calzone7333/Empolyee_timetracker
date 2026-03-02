const { app, BrowserWindow, ipcMain, Menu, Tray } = require('electron');
const { execSync } = require('child_process');
const axios = require('axios');
const os = require('os');
const fs = require('fs');
const path = require('path');
const net = require('net');
const { uIOhook, UiohookKey } = require('uiohook-napi');

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
// You can change your server url if needed or pass via config
let SERVER_URL = 'http://localhost:8084/api';
const CONFIG_FILE = path.join(app.getPath('userData'), 'agent-config.json');

// --- Config Handling ---
const loadConfig = () => {
    if (fs.existsSync(CONFIG_FILE)) {
        try {
            config = JSON.parse(fs.readFileSync(CONFIG_FILE, 'utf8'));
            userId = config.userId;
            if (config.serverUrl) SERVER_URL = config.serverUrl;
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
        computerName = os.hostname();
        const userInfo = os.userInfo();
        userName = userInfo ? userInfo.username : (process.env.USERNAME || 'User');
    } catch (e) {
        console.error('Core OS info fetch failed:', e.message);
    }

    console.log(`Registering agent: ${userName} @ ${computerName}`);

    const registrationData = {
        computerName,
        userName,
        email: `${userName.toLowerCase().replace(/\s+/g, '.')}.${computerName.toLowerCase()}@internal.monitor`
    };

    // 1. Try Localhost first (if on same machine)
    const localUrl = 'http://localhost:8084/api';
    try {
        console.log(`Checking local server at ${localUrl}...`);
        const res = await axios.post(`${localUrl}/users/register`, registrationData);
        if (res.data.success && res.data.user) {
            SERVER_URL = localUrl;
            console.log("Registration successful via localhost. ID:", res.data.user.id);
            saveConfig({ userId: res.data.user.id, serverUrl: SERVER_URL });
            return;
        }
    } catch (err) {
        console.log("Localhost server not found or refused.");
    }

    // 2. Try configured SERVER_URL
    try {
        console.log(`Attempting registration at ${SERVER_URL}...`);
        const res = await axios.post(`${SERVER_URL}/users/register`, registrationData);
        if (res.data.success && res.data.user) {
            console.log("Registration successful via configured URL. ID:", res.data.user.id);
            saveConfig({ userId: res.data.user.id });
            return;
        }
    } catch (error) {
        console.log("Connection to default server failed. Finding server...");
        const discoveredUrl = await autoDiscoverServerIP();
        if (discoveredUrl) {
            SERVER_URL = discoveredUrl;
            console.log(`Discovered Server: ${SERVER_URL}`);

            try {
                const retryRes = await axios.post(`${SERVER_URL}/users/register`, registrationData);
                if (retryRes.data.success && retryRes.data.user) {
                    saveConfig({ userId: retryRes.data.user.id, serverUrl: SERVER_URL });
                }
            } catch (retryErr) {
                console.error('Retry registration failed');
            }
        } else {
            console.error('No server found for registration.');
        }
    }
};

// --- Monitoring Functions ---
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
        // 1. Get the Active Window (the current priority)
        const activeWin = await activeWindow();

        // 2. Get ALL Running Apps with windows (for the 'Applications Used' list)
        // This makes it match Task Manager as the user requested.
        let runningApps = [];
        try {
            const psCommandForRunning = `powershell -NoProfile -ExecutionPolicy Bypass -Command "Get-Process | Where-Object {$_.MainWindowTitle -ne ''} | Select-Object ProcessName, MainWindowTitle | ConvertTo-Json -Compress"`;
            const runningStdout = execSync(psCommandForRunning, { encoding: 'utf8' });
            if (runningStdout.trim()) {
                const parsed = JSON.parse(runningStdout);
                runningApps = Array.isArray(parsed) ? parsed : [parsed];
            }
        } catch (e) {
            console.error('[TRACKER] Error getting running apps:', e.message);
        }

        console.log(`[TRACKER] Active: ${activeWin && activeWin.owner ? activeWin.owner.name : 'Unknown'} | Total Running Apps: ${runningApps.length}`);

        // Grab values and reset for next interval
        const keys = currentKeyStrokes;
        const clicks = currentMouseClicks;
        currentKeyStrokes = 0;
        currentMouseClicks = 0;

        // Send the main ACTIVE activity
        const activityData = {
            userId,
            type: 'active',
            application: activeWin && activeWin.owner ? activeWin.owner.name : 'Unknown',
            website: activeWin ? (activeWin.url || activeWin.title) : '',
            keyStrokes: keys,
            mouseClicks: clicks,
            idleTime: 0,
            timestamp: new Date().toISOString()
        };

        axios.post(`${SERVER_URL}/activity/track`, activityData)
            .then(() => console.log(`[TRACKER] Active data sent`))
            .catch(err => console.error(`[TRACKER] Failed to send active data: ${err.message}`));

        // Send BACKGROUND activities for all other running apps so they appear in the "Applications Used" table
        // We filter out the active app from this list to prevent double counting in the same second
        const activeAppName = activeWin && activeWin.owner ? activeWin.owner.name.toLowerCase() : '';
        for (const app of runningApps) {
            const name = app.ProcessName;
            if (name.toLowerCase() === activeAppName) continue;

            const bgActivity = {
                userId,
                type: 'background',
                application: name,
                website: app.MainWindowTitle,
                keyStrokes: 0,
                mouseClicks: 0,
                idleTime: 10, // Mark as idle since it's in background
                timestamp: new Date().toISOString()
            };
            axios.post(`${SERVER_URL}/activity/track`, bgActivity).catch(() => null);
        }

        // Screenshot every 1 minute (60000 ms) for quicker testing and visibility
        const now = Date.now();
        if (now - lastScreenshotTime >= 60000) {
            const imgBase64 = takeScreenshot();
            if (imgBase64) {
                axios.post(`${SERVER_URL}/screenshots/upload`, {
                    userId,
                    imageBase64: imgBase64,
                    timestamp: new Date().toISOString()
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
    mainWindow = new BrowserWindow({
        width: 450,
        height: 600,
        resizable: true,
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
        checkInTime: checkInTime ? checkInTime.toISOString() : null,
        computerName: os.hostname(),
        userName: os.userInfo() ? os.userInfo().username : 'Unknown',
        userId: userId || 'Not Registered'
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
