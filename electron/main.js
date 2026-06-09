const { app, BrowserWindow, ipcMain, dialog, Menu } = require('electron')
const path = require('path')
const fs = require('fs')

const isDev = process.env.NODE_ENV === 'development'

function createWindow() {
  const mainWindow = new BrowserWindow({
    width: 1920,
    height: 1080,
    minWidth: 1280,
    minHeight: 720,
    backgroundColor: '#0a0a0a',
    title: 'PACS 阅片工作站',
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      nodeIntegration: false,
      contextIsolation: true,
      sandbox: false,
    },
  })

  if (isDev) {
    mainWindow.loadURL('http://localhost:5173')
    mainWindow.webContents.openDevTools({ mode: 'detach' })
  } else {
    mainWindow.loadFile(path.join(__dirname, '../dist/index.html'))
  }

  mainWindow.maximize()
}

ipcMain.handle('open-file-dialog', async (event, options) => {
  const result = await dialog.showOpenDialog({
    properties: ['openFile', 'multiSelections'],
    filters: options?.filters || [
      { name: 'DICOM 文件', extensions: ['dcm', 'dicom', 'ima'] },
      { name: '所有文件', extensions: ['*'] },
    ],
  })
  return result
})

ipcMain.handle('open-directory-dialog', async () => {
  const result = await dialog.showOpenDialog({
    properties: ['openDirectory'],
  })
  return result
})

ipcMain.handle('read-file', async (event, filePath) => {
  try {
    const buffer = fs.readFileSync(filePath)
    return {
      success: true,
      data: Array.from(buffer),
      path: filePath,
      name: path.basename(filePath),
      size: buffer.length,
    }
  } catch (error) {
    return { success: false, error: error.message }
  }
})

ipcMain.handle('read-directory', async (event, dirPath) => {
  try {
    const files = fs.readdirSync(dirPath)
    const fileList = files.map(file => {
      const fullPath = path.join(dirPath, file)
      const stat = fs.statSync(fullPath)
      return {
        name: file,
        path: fullPath,
        isDirectory: stat.isDirectory(),
        size: stat.size,
      }
    })
    return { success: true, files: fileList }
  } catch (error) {
    return { success: false, error: error.message }
  }
})

ipcMain.handle('save-report', async (event, { content, fileName }) => {
  try {
    const savePath = await dialog.showSaveDialog({
      defaultPath: fileName || 'report.txt',
      filters: [{ name: '文本文件', extensions: ['txt'] }],
    })
    if (!savePath.canceled && savePath.filePath) {
      fs.writeFileSync(savePath.filePath, content)
      return { success: true, path: savePath.filePath }
    }
    return { success: false, canceled: true }
  } catch (error) {
    return { success: false, error: error.message }
  }
})

const appMenu = [
  {
    label: '文件',
    submenu: [
      {
        label: '导入影像',
        accelerator: 'Ctrl+O',
        click: () => {
          BrowserWindow.getFocusedWindow()?.webContents.send('menu-import')
        },
      },
      { type: 'separator' },
      {
        label: '打印胶片',
        accelerator: 'Ctrl+P',
        click: () => {
          BrowserWindow.getFocusedWindow()?.webContents.send('menu-print')
        },
      },
      { type: 'separator' },
      { role: 'quit', label: '退出', accelerator: 'Alt+F4' },
    ],
  },
  {
    label: '视图',
    submenu: [
      { role: 'reload', label: '刷新' },
      { role: 'toggleDevTools', label: '开发者工具' },
      { type: 'separator' },
      { role: 'togglefullscreen', label: '全屏' },
    ],
  },
  {
    label: '窗口',
    submenu: [
      {
        label: '工作列表',
        accelerator: 'Ctrl+1',
        click: () => BrowserWindow.getFocusedWindow()?.webContents.send('switch-window', 'worklist'),
      },
      {
        label: '阅片',
        accelerator: 'Ctrl+2',
        click: () => BrowserWindow.getFocusedWindow()?.webContents.send('switch-window', 'viewer'),
      },
      {
        label: '报告',
        accelerator: 'Ctrl+3',
        click: () => BrowserWindow.getFocusedWindow()?.webContents.send('switch-window', 'report'),
      },
      {
        label: '设置',
        accelerator: 'Ctrl+,',
        click: () => BrowserWindow.getFocusedWindow()?.webContents.send('switch-window', 'settings'),
      },
    ],
  },
  {
    label: '帮助',
    submenu: [
      {
        label: '快捷键说明',
        accelerator: 'F1',
        click: () => BrowserWindow.getFocusedWindow()?.webContents.send('show-shortcuts'),
      },
    ],
  },
]

app.whenReady().then(() => {
  if (process.platform !== 'darwin') {
    const menu = Menu.buildFromTemplate(appMenu)
    Menu.setApplicationMenu(menu)
  }
  createWindow()
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit()
})

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) createWindow()
})
