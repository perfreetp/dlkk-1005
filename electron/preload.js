const { contextBridge, ipcRenderer } = require('electron')

contextBridge.exposeInMainWorld('electronAPI', {
  openFileDialog: (options) => ipcRenderer.invoke('open-file-dialog', options),
  openDirectoryDialog: () => ipcRenderer.invoke('open-directory-dialog'),
  readFile: (filePath) => ipcRenderer.invoke('read-file', filePath),
  readDirectory: (dirPath) => ipcRenderer.invoke('read-directory', dirPath),
  saveReport: (data) => ipcRenderer.invoke('save-report', data),
  onMenuImport: (callback) => ipcRenderer.on('menu-import', callback),
  onMenuPrint: (callback) => ipcRenderer.on('menu-print', callback),
  onSwitchWindow: (callback) => ipcRenderer.on('switch-window', (_, windowName) => callback(windowName)),
  onShowShortcuts: (callback) => ipcRenderer.on('show-shortcuts', callback),
})
