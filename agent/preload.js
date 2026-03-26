const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('api', {
    startTracking: () => ipcRenderer.send('start-tracking'),
    pauseTracking: () => ipcRenderer.send('pause-tracking'),
    stopTracking: () => ipcRenderer.send('stop-tracking'),
    getStatus: () => ipcRenderer.invoke('get-status'),
    testConnection: () => ipcRenderer.invoke('test-connection'),
    login: (credentials) => ipcRenderer.invoke('login', credentials),
    logout: () => ipcRenderer.invoke('logout')
});
