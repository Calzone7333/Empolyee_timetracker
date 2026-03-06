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

let currentKeyStrokes = 0;
let currentMouseClicks = 0;

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
            console.log(`[CONFIG] Loaded User ID: ${userId}`);
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
            saveConfig({ userId: res.data.user.id });
            return;
        }
    } catch (error) {
        console.error(`[REG] Registration failed: ${error.message}`);
    }

    if (!userId) {
        console.error('[REG] Still not registered. Monitoring will be delayed.');
    }
};

// --- Tracking Utilities ---
const activeWindow = async () => {
    try {
        const { activeWindow: getActiveWindow } = require('active-win');
        const win = await getActiveWindow();
        return win || { title: 'Unknown', owner: { name: 'Unknown' } };
    } catch (e) {
        return { title: 'Unknown', owner: { name: 'Unknown' } };
    }
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

const monitor = async () => {
    if (!isTracking || !userId) return;

    try {
        const activeWin = await activeWindow();
        const keys = currentKeyStrokes;
        const clicks = currentMouseClicks;
        currentKeyStrokes = 0;
        currentMouseClicks = 0;

        const activeData = {
            userId: Number(userId),
            type: 'active',
            application: activeWin && activeWin.owner ? String(activeWin.owner.name) : 'Unknown',
            website: activeWin ? String(activeWin.title) : '',
            keyStrokes: Number(keys),
            mouseClicks: Number(clicks),
            idleTime: 0,
            timestamp: getISTISOString()
        };

        axios.post(`${SERVER_URL}/activity/track`, activeData)
            .then(() => console.log(`[TRACKER] Active ping SENT`))
            .catch(err => {
                const errorDetail = err.response ? JSON.stringify(err.response.data) : err.message;
                console.error(`[TRACKER] Active sync failed: ${errorDetail}`);
            });

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

// --- Handlers ---
uIOhook.on('keydown', () => { if (isTracking) currentKeyStrokes++; });
uIOhook.on('mousedown', () => { if (isTracking) currentMouseClicks++; });

app.whenReady().then(async () => {
    loadConfig();
    await register();

    // Window creation logic
    const primaryDisplay = screen.getPrimaryDisplay();
    const { width, height } = primaryDisplay.workAreaSize;
    const winWidth = 240, winHeight = 140;

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
    computerName: `${os.hostname()}_${getIPAddress()}`,
    userName: os.userInfo() ? os.userInfo().username : 'Unknown',
    userId: userId || 'Not Registered', serverUrl: SERVER_URL
}));

ipcMain.on('start-tracking', () => {
    if (!isTracking) {
        isTracking = true;
        if (!checkInTime) checkInTime = new Date();
        lastScreenshotTime = 0;
        if (!timerInterval) timerInterval = setInterval(() => { if (isTracking) trackingSeconds++; }, 1000);
        if (!trackingInterval) {
            uIOhook.start();
            trackingInterval = setInterval(monitor, 10000);
            monitor();
        }
    }
});

ipcMain.on('pause-tracking', () => {
    isTracking = false;
    if (trackingInterval) { clearInterval(trackingInterval); trackingInterval = null; uIOhook.stop(); }
    if (timerInterval) { clearInterval(timerInterval); timerInterval = null; }
});

ipcMain.on('stop-tracking', () => {
    isTracking = false; trackingSeconds = 0; checkInTime = null;
    if (trackingInterval) { clearInterval(trackingInterval); trackingInterval = null; uIOhook.stop(); }
    if (timerInterval) { clearInterval(timerInterval); timerInterval = null; }
});

app.on('window-all-closed', () => { if (process.platform !== 'darwin') app.quit(); });
