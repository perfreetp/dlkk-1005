const { contextBridge, ipcRenderer } = require('electron')

// 统一从主进程发送 'menu-action' 事件，根据 payload.type 分发给不同的回调
const menuActionListeners = {
  import: [],
  print: [],
  'save-report': [],
  'switch-window': [],
  'show-shortcuts': [],
  'show-help': [],
}

ipcRenderer.on('menu-action', (_, payload) => {
  if (!payload || !payload.type) return
  const listeners = menuActionListeners[payload.type] || []
  listeners.forEach((cb) => {
    try {
      cb(payload.data || null)
    } catch (e) {
      console.error('[PACS-preload] 回调执行错误:', e)
    }
  })
})

contextBridge.exposeInMainWorld('electronAPI', {
  openFileDialog: (options) => ipcRenderer.invoke('open-file-dialog', options),
  openDirectoryDialog: () => ipcRenderer.invoke('open-directory-dialog'),
  readFile: (filePath) => ipcRenderer.invoke('read-file', filePath),
  readDirectory: (dirPath) => ipcRenderer.invoke('read-directory', dirPath),
  saveReport: (data) => ipcRenderer.invoke('save-report', data),
  printDialog: () => ipcRenderer.invoke('print-dialog'),
  getAppInfo: () => ipcRenderer.invoke('get-app-info'),

  // ===== 菜单事件订阅（统一从 menu-action 事件分发）
  onMenuImport: (callback) => {
    if (typeof callback === 'function') menuActionListeners.import.push(() => callback())
  },
  onMenuPrint: (callback) => {
    if (typeof callback === 'function') menuActionListeners.print.push(() => callback())
  },
  onMenuSaveReport: (callback) => {
    if (typeof callback === 'function') menuActionListeners['save-report'].push(() => callback())
  },
  onSwitchWindow: (callback) => {
    if (typeof callback === 'function') menuActionListeners['switch-window'].push((name) => callback(name))
  },
  onShowShortcuts: (callback) => {
    if (typeof callback === 'function') menuActionListeners['show-shortcuts'].push(() => callback())
  },
  onShowHelp: (callback) => {
    if (typeof callback === 'function') menuActionListeners['show-help'].push(() => callback())
  },
})
