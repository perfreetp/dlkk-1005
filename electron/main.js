const { app, BrowserWindow, ipcMain, dialog, Menu } = require('electron')
const path = require('path')
const fs = require('fs')

const isDev = process.env.NODE_ENV === 'development'
const DEV_SERVER_URL = 'http://localhost:5173'
let mainWindow = null

function createMainWindow() {
  mainWindow = new BrowserWindow({
    width: 1920,
    height: 1080,
    minWidth: 1280,
    minHeight: 720,
    backgroundColor: '#0a0a0a',
    title: 'PACS 医学影像阅片工作站',
    titleBarStyle: 'default',
    autoHideMenuBar: false,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      nodeIntegration: false,
      contextIsolation: true,
      sandbox: false,
      webSecurity: false,
      backgroundThrottling: false,
    },
    show: false,
  })

  mainWindow.once('ready-to-show', () => {
    mainWindow.maximize()
    mainWindow.show()
    mainWindow.focus()
  })

  mainWindow.on('closed', () => { mainWindow = null })
  loadMainContent()
}

function loadMainContent() {
  if (isDev) {
    loadWithRetry(DEV_SERVER_URL, 0)
  } else {
    const indexHtml = path.join(__dirname, '../dist/index.html')
    if (fs.existsSync(indexHtml)) {
      mainWindow.loadFile(indexHtml)
        .then(() => mainWindow.setTitle('PACS 医学影像阅片工作站'))
    } else {
      dialog.showErrorBox(
        '启动错误',
        '未找到构建资源文件。请先执行 npm run build。\n路径：' + indexHtml
      )
    }
  }
}

function loadWithRetry(targetUrl, attempts) {
  if (!mainWindow) return
  mainWindow.loadURL(targetUrl)
    .then(() => {
      console.log('[PACS] 加载成功:', targetUrl)
      mainWindow.setTitle('PACS 医学影像阅片工作站')
    })
    .catch((err) => {
      console.error('[PACS] 加载失败:', err.message)
      if (attempts < 20) {
        setTimeout(() => loadWithRetry(targetUrl, attempts + 1), 1500)
      } else {
        dialog.showErrorBox(
          '连接失败',
          '无法连接到开发服务器。请确认 npm run dev 是否已启动。\n错误: ' + err.message
        )
      }
    })
}

// ===== IPC: 文件对话框 =====
ipcMain.handle('open-file-dialog', async (event, options) => {
  return await dialog.showOpenDialog(mainWindow, {
    properties: ['openFile', 'multiSelections'],
    filters: options && options.filters ? options.filters : [
      { name: 'DICOM 医学影像', extensions: ['dcm', 'dicom', 'ima', 'DCM'] },
      { name: '图像文件', extensions: ['jpg', 'jpeg', 'png', 'bmp'] },
      { name: '所有文件', extensions: ['*'] },
    ],
    title: '选择 DICOM 或图像文件',
  })
})

ipcMain.handle('open-directory-dialog', async () => {
  return await dialog.showOpenDialog(mainWindow, {
    properties: ['openDirectory'],
    title: '选择 DICOM 影像目录',
  })
})

ipcMain.handle('read-file', async (event, filePath) => {
  try {
    const stat = fs.statSync(filePath)
    const buffer = fs.readFileSync(filePath)
    return {
      success: true,
      data: Array.from(buffer),
      path: filePath,
      name: path.basename(filePath),
      size: stat.size,
      modifiedTime: stat.mtime.toISOString(),
    }
  } catch (error) {
    return { success: false, error: error.message }
  }
})

ipcMain.handle('read-directory', async (event, dirPath) => {
  try {
    const entries = fs.readdirSync(dirPath, { withFileTypes: true })
    const fileList = entries.map(entry => {
      const fullPath = path.join(dirPath, entry.name)
      const stat = fs.statSync(fullPath, { throwIfNoEntry: false })
      return {
        name: entry.name,
        path: fullPath,
        isDirectory: entry.isDirectory(),
        size: stat ? stat.size : 0,
      }
    })
    return { success: true, files: fileList }
  } catch (error) {
    return { success: false, error: error.message }
  }
})

ipcMain.handle('save-report', async (event, data) => {
  try {
    const result = await dialog.showSaveDialog(mainWindow, {
      defaultPath: data.fileName || 'report.txt',
      filters: [
        { name: '报告文件', extensions: ['txt'] },
        { name: '所有文件', extensions: ['*'] },
      ],
      title: '保存诊断报告',
    })
    if (!result.canceled && result.filePath) {
      fs.writeFileSync(result.filePath, data.content || '', 'utf-8')
      return { success: true, path: result.filePath }
    }
    return { success: false, canceled: true }
  } catch (error) {
    return { success: false, error: error.message }
  }
})

ipcMain.handle('print-dialog', async () => {
  try {
    mainWindow.webContents.print({ silent: false, printBackground: true, color: true })
    return { success: true }
  } catch (error) {
    return { success: false, error: error.message }
  }
})

ipcMain.handle('get-app-info', async () => ({
  appVersion: app.getVersion(),
  appName: app.getName(),
  userDataPath: app.getPath('userData'),
  appPath: app.getAppPath(),
  isPackaged: app.isPackaged,
  platform: process.platform,
}))

// ===== 主菜单 =====
function sendToRender(payload) {
  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.webContents.send('menu-action', payload)
    return true
  }
  console.warn('[PACS] 主窗口不可用，无法发送菜单事件')
  return false
}

function buildMainMenu() {
  const template = [
    {
      label: '文件(&F)',
      submenu: [
        {
          label: '导入 DICOM 影像...',
          accelerator: 'CmdOrCtrl+O',
          click: () => sendToRender({ type: 'import' }),
        },
        { type: 'separator' },
        {
          label: '打印胶片 / 刻录光盘...',
          accelerator: 'CmdOrCtrl+P',
          click: () => sendToRender({ type: 'print' }),
        },
        {
          label: '导出诊断报告...',
          accelerator: 'CmdOrCtrl+S',
          click: () => sendToRender({ type: 'save-report' }),
        },
        { type: 'separator' },
        {
          label: '退出(&X)',
          accelerator: 'CmdOrCtrl+Q',
          role: 'quit',
        },
      ],
    },
    {
      label: '编辑(&E)',
      submenu: [
        { role: 'undo', label: '撤销' },
        { role: 'redo', label: '重做' },
        { type: 'separator' },
        { role: 'cut', label: '剪切' },
        { role: 'copy', label: '复制' },
        { role: 'paste', label: '粘贴' },
        { role: 'selectAll', label: '全选' },
      ],
    },
    {
      label: '视图(&V)',
      submenu: [
        { role: 'reload', label: '重新加载' },
        { role: 'forceReload', label: '强制刷新' },
        { role: 'toggleDevTools', label: '开发者工具' },
        { type: 'separator' },
        { role: 'resetZoom', label: '重置缩放' },
        { role: 'zoomIn', label: '放大视图' },
        { role: 'zoomOut', label: '缩小视图' },
        { type: 'separator' },
        { role: 'togglefullscreen', label: '全屏切换' },
      ],
    },
    {
      label: '窗口(&W)',
      submenu: [
        {
          label: '1. 工作列表',
          accelerator: 'CmdOrCtrl+1',
          click: () => sendToRender({ type: 'switch-window', data: 'worklist' }),
        },
        {
          label: '2. 影像导入',
          accelerator: 'CmdOrCtrl+Shift+I',
          click: () => sendToRender({ type: 'switch-window', data: 'import' }),
        },
        {
          label: '3. 阅片窗口',
          accelerator: 'CmdOrCtrl+2',
          click: () => sendToRender({ type: 'switch-window', data: 'viewer' }),
        },
        {
          label: '4. 诊断报告',
          accelerator: 'CmdOrCtrl+3',
          click: () => sendToRender({ type: 'switch-window', data: 'report' }),
        },
        { type: 'separator' },
        {
          label: '5. 打印刻录',
          accelerator: 'CmdOrCtrl+4',
          click: () => sendToRender({ type: 'switch-window', data: 'print' }),
        },
        {
          label: '6. 个人设置',
          accelerator: 'CmdOrCtrl+,',
          click: () => sendToRender({ type: 'switch-window', data: 'settings' }),
        },
        { type: 'separator' },
        { role: 'minimize', label: '最小化' },
        { role: 'close', label: '关闭窗口' },
      ],
    },
    {
      label: '帮助(&H)',
      submenu: [
        {
          label: '快捷键说明',
          accelerator: 'F1',
          click: () => sendToRender({ type: 'show-shortcuts' }),
        },
        { type: 'separator' },
        {
          label: '关于 PACS 阅片工作站',
          click: () => {
            dialog.showMessageBox(mainWindow, {
              type: 'info',
              title: '关于 PACS 阅片工作站',
              message: 'PACS 医学影像阅片工作站 v' + app.getVersion(),
              detail: '医院影像科专用阅片系统\n\n版权所有 © 2024 医院放射科\n\n技术支持：React + Electron',
              noLink: true,
            })
          },
        },
      ],
    },
  ]

  const menu = Menu.buildFromTemplate(template)
  Menu.setApplicationMenu(menu)
}

app.whenReady().then(() => {
  console.log('[PACS] Electron 启动中...')
  buildMainMenu()
  createMainWindow()

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createMainWindow()
  })
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit()
})

app.on('second-instance', () => {
  if (mainWindow) {
    if (mainWindow.isMinimized()) mainWindow.restore()
    mainWindow.focus()
  }
})

process.on('uncaughtException', (err) => {
  console.error('[PACS] 未捕获异常:', err.message)
})
