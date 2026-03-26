const { app, BrowserWindow, ipcMain, Menu, Tray, screen } = require('electron');
const { execSync } = require('child_process');
const axios = require('axios');
const os = require('os');
const fs = require('fs');
const path = require('path');
const net = require('net');
const { uIOhook } = require('uiohook-napi');

// Handle single instance
const gotTheLock = app.requestSingleInstanceLock();
if (!gotTheLock) {
    app.quit();
} else {
    app.on('second-instance', () => {
        if (mainWindow) {
            if (mainWindow.isMinimized()) mainWindow.restore();
            mainWindow.show();
            mainWindow.focus();
        }
    });
}

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
    // Offset for IST (UTC+5:30)
    const utc = d.getTime() + (d.getTimezoneOffset() * 60000);
    const nd = new Date(utc + (3600000 * 5.5));
    const pad = (n) => (n < 10 ? '0' + n : n);
    // Format as YYYY-MM-DDTHH:mm:ss which Java LocalDateTime handles best
    return `${nd.getFullYear()}-${pad(nd.getMonth() + 1)}-${pad(nd.getDate())}T${pad(nd.getHours())}:${pad(nd.getMinutes())}:${pad(nd.getSeconds())}`;
};

let mainWindow;
let tray = null;
let isTracking = false;
let trackingInterval = null;
let lastScreenshotTime = 0;
let checkInTime = null;
let trackingSeconds = 0;
let timerInterval = null;

let lastActivityTime = Date.now();
uIOhook.on('keydown', () => { if (isTracking) { currentKeyStrokes++; lastActivityTime = Date.now(); } });
uIOhook.on('mousedown', () => { if (isTracking) { currentMouseClicks++; lastActivityTime = Date.now(); } });
uIOhook.on('mousemove', () => { if (isTracking) { lastActivityTime = Date.now(); } });

let config = {};
let userId = null;
let screenshotInterval = 300000; // Default 5 minutes

// Dynamic Server URL (Local for Dev, Cloud for Prod)
let SERVER_URL = app.isPackaged
    ? 'http://103.181.108.248/api'
    : 'http://localhost:8084/api';

const CONFIG_FILE = path.join(app.getPath('userData'), 'agent-config.json');

// --- Config Handling ---
const loadConfig = () => {
    if (fs.existsSync(CONFIG_FILE)) {
        try {
            config = JSON.parse(fs.readFileSync(CONFIG_FILE, 'utf8'));
            userId = config.userId;
            console.log(`[CONFIG] Loaded User ID: ${userId}, User Name: ${config.userName}`);
        } catch (e) {
            console.error('[CONFIG] Error loading config:', e);
        }
    } else {
        console.log('[CONFIG] Config file not found');
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

    const registrationData = {
        computerName,
        userName,
        email: `${userName.toLowerCase().replace(/\s+/g, '.')}.${computerName.toLowerCase()}@internal.monitor`
    };

    if (SERVER_URL.endsWith('/')) SERVER_URL = SERVER_URL.slice(0, -1);

    try {
        const serverType = SERVER_URL.includes('localhost') ? 'Local' : 'Cloud';
        console.log(`[REG] Attempting registration at ${serverType} server ${SERVER_URL}/users/register...`);
        const res = await axios.post(`${SERVER_URL}/users/register`, registrationData);
        if (res.data.success && res.data.user) {
            console.log(`[REG] Registration successful. ID: ${res.data.user.id}`);
            saveConfig({
                userId: res.data.user.id,
                userName: res.data.user.userName,
                generatedPassword: res.data.rawPassword
            });
            return;
        }
    } catch (error) {
        console.error(`[REG] Registration failed: ${error.message}`);
    }

    if (!userId) {
        // console.log('[REG] No user logged in yet. Waiting for login.');
    }
};

// --- Tracking Utilities ---
let getActiveWinModule = null;

/**
 * Extracts the URL from the active browser window using PowerShell UI Automation.
 * This works for Chrome, Edge, and Firefox on Windows.
 * Optimized with multiple fallback methods for robust detection.
 */
const getBrowserUrl = (processName) => {
    try {
        const script = `
            Add-Type -AssemblyName UIAutomationClient
            
            $proc = Get-Process -Name "${processName}" -ErrorAction SilentlyContinue | Where-Object { $_.MainWindowHandle -ne 0 } | Select-Object -First 1
            if (-not $proc) { exit }

            $root = [Windows.Automation.AutomationElement]::FromHandle($proc.MainWindowHandle)
            if (-not $root) { exit }

            # Direct search for Edit controls (fastest)
            $condition = New-Object Windows.Automation.PropertyCondition([Windows.Automation.AutomationElement]::ControlTypeProperty, [Windows.Automation.ControlTypes]::Edit)
            $edits = $root.FindAll([Windows.Automation.TreeScope]::Descendants, $condition)
            
            foreach ($edit in $edits) {
                $val = ""
                try {
                    if ($edit.GetSupportedPatterns() -contains [Windows.Automation.ValuePattern]::Pattern) {
                        $val = $edit.GetCurrentPattern([Windows.Automation.ValuePattern]::Pattern).Current.Value
                    }
                    if (-not $val) { $val = $edit.Current.Name }

                    if ($val -and ($val -match "^(https?://|www\\.)" -or $val -match "^[a-z0-9.-]+\\.(com|org|net|edu|in|gov|io|co|me|ai)/")) {
                        if ($val -notmatch "^https?://") { $val = "https://" + $val }
                        $val; exit
                    }
                } catch { continue }
            }

            # Search by specific names (robust fallback)
            $names = @("Address and search bar", "Search or enter web address", "Search or enter address", "Address Bar", "Address and Search Bar")
            foreach ($n in $names) {
                $cond = New-Object Windows.Automation.PropertyCondition([Windows.Automation.AutomationElement]::NameProperty, $n)
                $element = $root.FindFirst([Windows.Automation.TreeScope]::Descendants, $cond)
                if ($element) {
                    try {
                        if ($element.GetSupportedPatterns() -contains [Windows.Automation.ValuePattern]::Pattern) {
                            $v = $element.GetCurrentPattern([Windows.Automation.ValuePattern]::Pattern).Current.Value
                            if ($v) { $v; exit }
                        }
                    } catch {}
                }
            }
        `;
        const encodedScript = Buffer.from(script, 'utf16le').toString('base64');
        const command = `powershell -NoProfile -ExecutionPolicy Bypass -Ordered -EncodedCommand ${encodedScript}`;
        const output = execSync(command, { encoding: 'utf8', stdio: 'pipe', timeout: 5000 }).trim();
        return output || null;
    } catch (e) {
        return null;
    }
};

/**
 * Gets the active window title and process name using a robust PowerShell script.
 * This is more reliable than Electron modules on Windows for capturing all apps.
 */
const activeWindow = async () => {
    try {
        const script = `
            Add-Type @"
              using System;
              using System.Runtime.InteropServices;
              using System.Text;
              public class Win32 {
                [DllImport("user32.dll")]
                public static extern IntPtr GetForegroundWindow();
                [DllImport("user32.dll")]
                public static extern int GetWindowThreadProcessId(IntPtr hWnd, out int lpdwProcessId);
                [DllImport("user32.dll")]
                public static extern int GetWindowText(IntPtr hWnd, StringBuilder text, int count);
              }
"@
            $hwnd = [Win32]::GetForegroundWindow()
            if ($hwnd -ne [IntPtr]::Zero) {
                $pid = 0
                [Win32]::GetWindowThreadProcessId($hwnd, [ref]$pid)
                $proc = Get-Process -Id $pid
                
                $titleBuilder = New-Object System.Text.StringBuilder 256
                [Win32]::GetWindowText($hwnd, $titleBuilder, 256) | Out-Null
                $title = $titleBuilder.ToString()
                
                # Output format: ProcessName|WindowTitle|ProcessPath
                $proc.Name + "|" + $title + "|" + $proc.MainModule.FileName
            }
        `;
        const encodedScript = Buffer.from(script, 'utf16le').toString('base64');
        const command = `powershell -NoProfile -ExecutionPolicy Bypass -EncodedCommand ${encodedScript}`;
        const output = execSync(command, { encoding: 'utf8', stdio: 'pipe', timeout: 3000 }).trim();
        
        if (output && output.includes('|')) {
            const [name, title, path] = output.split('|');
            const processName = name.toLowerCase();
            
            // Check if it's a browser to try and get the URL
            let browserUrl = null;
            const browsers = ['chrome', 'msedge', 'firefox', 'brave', 'opera', 'vivaldi'];
            if (browsers.some(b => processName.includes(b))) {
                browserUrl = getBrowserUrl(name);
            }

            return {
                title: title || 'No Title',
                owner: { name: name || 'Unknown', path: path || '' },
                url: browserUrl
            };
        }
    } catch (e) {
        // console.error('[AGENT] Window detection error:', e.message);
    }
    return { title: 'Unknown', owner: { name: 'Unknown' }, url: null };
};

const takeScreenshot = () => {
    try {
        const script = `
            Add-Type -AssemblyName System.Windows.Forms
            $screen = [System.Windows.Forms.Screen]::PrimaryScreen
            $width = [System.Windows.Forms.SystemInformation]::VirtualScreen.Width
            $height = [System.Windows.Forms.SystemInformation]::VirtualScreen.Height
            $left = [System.Windows.Forms.SystemInformation]::VirtualScreen.Left
            $top = [System.Windows.Forms.SystemInformation]::VirtualScreen.Top
            
            $bitmap = New-Object System.Drawing.Bitmap $width, $height
            $graphics = [System.Drawing.Graphics]::FromImage($bitmap)
            $graphics.CopyFromScreen($left, $top, 0, 0, $bitmap.Size)
            
            $ms = New-Object System.IO.MemoryStream
            $bitmap.Save($ms, [System.Drawing.Imaging.ImageFormat]::Jpeg)
            $bitmap.Dispose()
            $graphics.Dispose()
            
            [Convert]::ToBase64String($ms.ToArray())
        `;
        const encodedScript = Buffer.from(script, 'utf16le').toString('base64');
        const command = `powershell -NoProfile -ExecutionPolicy Bypass -EncodedCommand ${encodedScript}`;
        const base64 = execSync(command, { encoding: 'utf8', stdio: 'pipe', maxBuffer: 1024 * 1024 * 20 });
        return base64 ? base64.trim() : null;
    } catch (e) {
        console.error('[AGENT] Screenshot failed:', e.message);
        return null;
    }
};

// Monitoring loop
const monitor = async () => {
    if (!isTracking || !userId) return;

    try {
        const now = Date.now();
        const activeWin = await activeWindow();
        const idleSecs = Math.floor((now - lastActivityTime) / 1000);

        // More robust data construction
        let appName = activeWin?.owner?.name || 'Unknown';
        let pageTitle = activeWin?.title || 'Unknown';
        const url = activeWin?.url || null;

        // Clean up common system names
        if (appName.toLowerCase() === 'explorer') appName = 'Windows Explorer';
        if (pageTitle === 'No Title') pageTitle = appName;

        // Dashboard info
        console.log(`[MONITOR] App: ${appName} | URL: ${url || 'None'} | Idle: ${idleSecs}s`);

        const keys = currentKeyStrokes;
        const clicks = currentMouseClicks;
        currentKeyStrokes = 0;
        currentMouseClicks = 0;

        // For "Websites Visited", we MUST have the URL. 
        // If not, we send the Title, but the backend handles it better now.
        const siteOrTitle = url || pageTitle;

        const activeData = {
            userId: Number(userId),
            type: idleSecs > 120 ? 'idle' : 'active',
            application: String(appName),
            website: String(siteOrTitle),
            keyStrokes: Number(keys),
            mouseClicks: Number(clicks),
            idleTime: Number(idleSecs),
            timestamp: getISTISOString()
        };

        axios.post(`${SERVER_URL}/activity/track`, activeData, { timeout: 5000 })
            .then(() => console.log(`[TRACKER] Sync Success: ${activeData.application}`))
            .catch(err => {
                 console.error(`[TRACKER] Sync Error at ${SERVER_URL}: ${err.message}`);
            });

        if (now - lastScreenshotTime >= screenshotInterval) {
            console.log('[MONITOR] Capturing screenshot...');
            const imgBase64 = takeScreenshot();
            if (imgBase64) {
                axios.post(`${SERVER_URL}/screenshots/upload`, {
                    userId,
                    imageBase64: imgBase64,
                    timestamp: getISTISOString()
                }).catch(e => console.error('[MONITOR] Screenshot upload failed'));
            }
            lastScreenshotTime = now;
        }
    } catch (error) {
        console.error('Error in monitoring loop:', error.message);
    }
};

let currentKeyStrokes = 0;
let currentMouseClicks = 0;

const stopEverything = () => {
    isTracking = false;
    if (trackingInterval) {
        clearInterval(trackingInterval);
        trackingInterval = null;
    }
    if (timerInterval) {
        clearInterval(timerInterval);
        timerInterval = null;
    }
    try {
        uIOhook.stop();
    } catch (e) {
        // Ignore if already stopped
    }
};
app.whenReady().then(async () => {
    loadConfig();
    await register();

    // Window creation logic
    const primaryDisplay = screen.getPrimaryDisplay();
    const { width, height } = primaryDisplay.workAreaSize;
    const winWidth = 240, winHeight = 220;

    mainWindow = new BrowserWindow({
        width: winWidth, height: winHeight,
        x: width - winWidth - 20, y: height - winHeight - 20,
        resizable: false, alwaysOnTop: true, frame: false, transparent: true, show: false,
        webPreferences: { nodeIntegration: false, contextIsolation: true, preload: path.join(__dirname, 'preload.js') }
    });
    mainWindow.loadFile('index.html');
    mainWindow.once('ready-to-show', () => mainWindow.show());

    // Tray initialization with safety
    try {
        const iconPath = path.join(__dirname, 'assets', 'icon.png');
        if (fs.existsSync(iconPath)) {
            tray = new Tray(iconPath);
            const contextMenu = Menu.buildFromTemplate([
                { label: 'Show App', click: () => mainWindow.show() },
                { label: 'Quit', click: () => { app.isQuiting = true; app.quit(); } }
            ]);
            tray.setToolTip('TimeTracker Agent');
            tray.setContextMenu(contextMenu);
        } else {
            console.warn(`[TRAY] Icon not found at ${iconPath}. Running without tray icon.`);
        }
    } catch (e) {
        console.error('[TRAY] Failed to initialize:', e.message);
    }
});

ipcMain.handle('get-status', () => ({
    isTracking, trackingSeconds, checkInTime: checkInTime ? getISTISOString() : null,
    computerName: os.hostname(),
    userName: config.userName || os.userInfo()?.username || 'Unknown',
    userId: userId || null,
    generatedPassword: config.generatedPassword || null,
    serverUrl: SERVER_URL
}));

ipcMain.handle('login', async (event, credentials) => {
    try {
        console.log(`[LOGIN] Attempting login for ${credentials.userName}...`);
        const res = await axios.post(`${SERVER_URL}/users/login`, credentials);
        if (res.data.success && res.data.user) {
            const user = res.data.user;
            userId = user.id;
            saveConfig({
                userId: user.id,
                userName: user.userName,
                employeeId: user.employeeId,
                generatedPassword: null // Clear once logged in
            });
            console.log(`[LOGIN] Successful: ${user.userName} (ID: ${user.id})`);
            return { success: true, user: res.data.user };
        }
        return { success: false, message: res.data.message || 'Invalid credentials' };
    } catch (error) {
        console.error(`[LOGIN] Error: ${error.message}`);
        return { success: false, message: 'Server connection error' };
    }
});

ipcMain.handle('logout', async () => {
    console.log('[LOGOUT] User logging out...');
    stopEverything();
    trackingSeconds = 0;
    checkInTime = null;
    userId = null;
    saveConfig({
        userId: null,
        userName: null,
        employeeId: null,
        generatedPassword: null
    });
    return { success: true };
});

ipcMain.on('start-tracking', () => {
    if (!isTracking) {
        isTracking = true;
        if (!checkInTime) checkInTime = new Date();
        lastScreenshotTime = 0;
        if (!timerInterval) timerInterval = setInterval(() => { if (isTracking) trackingSeconds++; }, 1000);
        if (!trackingInterval) {
            try { uIOhook.start(); } catch (e) { }
            trackingInterval = setInterval(monitor, 10000);
            monitor();
        }
    }
});

ipcMain.on('pause-tracking', () => {
    stopEverything();
});

ipcMain.on('stop-tracking', () => {
    stopEverything();
    trackingSeconds = 0;
    checkInTime = null;
});

app.on('window-all-closed', () => { if (process.platform !== 'darwin') app.quit(); });
