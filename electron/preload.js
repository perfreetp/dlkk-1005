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
  // 每个 onXxx 返回 unsubscribe 函数，避免重复注册
  onMenuImport: (callback) => {
    const fn = () => callback()
    if (typeof callback === 'function') menuActionListeners.import.push(fn)
    return () => {
      const idx = menuActionListeners.import.indexOf(fn)
      if (idx >= 0) menuActionListeners.import.splice(idx, 1)
    }
  },
  onMenuPrint: (callback) => {
    const fn = () => callback()
    if (typeof callback === 'function') menuActionListeners.print.push(fn)
    return () => {
      const idx = menuActionListeners.print.indexOf(fn)
      if (idx >= 0) menuActionListeners.print.splice(idx, 1)
    }
  },
  onMenuSaveReport: (callback) => {
    const fn = () => callback()
    if (typeof callback === 'function') menuActionListeners['save-report'].push(fn)
    return () => {
      const idx = menuActionListeners['save-report'].indexOf(fn)
      if (idx >= 0) menuActionListeners['save-report'].splice(idx, 1)
    }
  },
  onSwitchWindow: (callback) => {
    const fn = (name) => callback(name)
    if (typeof callback === 'function') menuActionListeners['switch-window'].push(fn)
    return () => {
      const idx = menuActionListeners['switch-window'].indexOf(fn)
      if (idx >= 0) menuActionListeners['switch-window'].splice(idx, 1)
    }
  },
  onShowShortcuts: (callback) => {
    const fn = () => callback()
    if (typeof callback === 'function') menuActionListeners['show-shortcuts'].push(fn)
    return () => {
      const idx = menuActionListeners['show-shortcuts'].indexOf(fn)
      if (idx >= 0) menuActionListeners['show-shortcuts'].splice(idx, 1)
    }
  },
  onShowHelp: (callback) => {
    const fn = () => callback()
    if (typeof callback === 'function') menuActionListeners['show-help'].push(fn)
    return () => {
      const idx = menuActionListeners['show-help'].indexOf(fn)
      if (idx >= 0) menuActionListeners['show-help'].splice(idx, 1)
    }
  },
})
