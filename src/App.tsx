import React, { useEffect, useState } from 'react'
import { Button, Modal, Tag, Space, Avatar, Badge, Dropdown, Drawer, List, Tooltip, App as AntApp, Divider } from 'antd'
import {
  UnorderedListOutlined,
  ImportOutlined,
  PictureOutlined,
  FileTextOutlined,
  PrinterOutlined,
  SettingOutlined,
  BellOutlined,
  UserOutlined,
  LogoutOutlined,
  EditOutlined,
  MenuFoldOutlined,
  MenuUnfoldOutlined,
  QuestionCircleOutlined,
} from '@ant-design/icons'
import { useAppStore } from '@/stores/appStore'
import WorklistWindow from './components/WorklistWindow'
import ImportWindow from './components/ImportWindow'
import ViewerWindow from './components/ViewerWindow'
import ReportWindow from './components/ReportWindow'
import PrintWindow from './components/PrintWindow'
import SettingsWindow from './components/SettingsWindow'
import type { WindowName } from './types'
import dayjs from 'dayjs'

const windowConfig: {
  key: WindowName
  label: string
  icon: React.ReactNode
  shortcut: string
}[] = [
  { key: 'worklist', label: '工作列表', icon: <UnorderedListOutlined />, shortcut: 'Ctrl+1' },
  { key: 'import', label: '影像导入', icon: <ImportOutlined />, shortcut: 'Ctrl+O' },
  { key: 'viewer', label: '阅片窗口', icon: <PictureOutlined />, shortcut: 'Ctrl+2' },
  { key: 'report', label: '诊断报告', icon: <FileTextOutlined />, shortcut: 'Ctrl+3' },
  { key: 'print', label: '打印刻录', icon: <PrinterOutlined />, shortcut: 'Ctrl+P' },
  { key: 'settings', label: '个人设置', icon: <SettingOutlined />, shortcut: 'Ctrl+,' },
]

const App: React.FC = () => {
  const {
    activeWindow,
    setActiveWindow,
    setShowImportWindow,
    showShortcuts,
    setShowShortcuts,
    studies,
    importTasks,
    userSettings,
  } = useAppStore()

  const { message } = AntApp.useApp()
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false)
  const [currentTime, setCurrentTime] = useState(dayjs().format('YYYY-MM-DD HH:mm:ss'))

  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentTime(dayjs().format('YYYY-MM-DD HH:mm:ss'))
    }, 1000)
    return () => clearInterval(timer)
  }, [])

  useEffect(() => {
    const api = (window as any).electronAPI
    if (!api) return
    api.onSwitchWindow((name: WindowName) => {
      if (['worklist', 'import', 'viewer', 'report', 'print', 'settings'].includes(name)) {
        setActiveWindow(name)
      }
    })
    api.onMenuImport(() => {
      setActiveWindow('import')
    })
    api.onMenuPrint(() => {
      setActiveWindow('print')
    })
    api.onShowShortcuts(() => {
      setShowShortcuts(true)
    })
  }, [])

  const emergencyCount = studies.filter((s) => s.status === 'emergency').length
  const pendingCount = studies.filter((s) => s.status === 'pending').length
  const returnedCount = studies.filter((s) => s.status === 'returned').length
  const importProcessing = importTasks.filter((t) => ['pending', 'importing', 'retry', 'matching'].includes(t.status)).length

  const renderWindow = () => {
    switch (activeWindow) {
      case 'worklist':
        return <WorklistWindow />
      case 'import':
        return <ImportWindow />
      case 'viewer':
        return <ViewerWindow />
      case 'report':
        return <ReportWindow />
      case 'print':
        return <PrintWindow />
      case 'settings':
        return <SettingsWindow />
      default:
        return <WorklistWindow />
    }
  }

  return (
    <AntApp message={{ maxCount: 3 }}>
      <div className="pacs-app">
        {/* Header */}
        <div className="pacs-header">
          <div className="pacs-header-logo">
            <div
              style={{
                width: 32,
                height: 32,
                borderRadius: 8,
                background: 'linear-gradient(135deg, #1890ff 0%, #0050b3 100%)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: 18,
              }}
            >
              <PictureOutlined />
            </div>
            PACS 阅片工作站
            <Tag color="processing" style={{ marginLeft: 8 }}>v1.0</Tag>
          </div>

          <div className="pacs-header-nav">
            {windowConfig.map((wc) => {
              const isActive = activeWindow === wc.key
              let badgeCount = 0
              let badgeColor = ''
              if (wc.key === 'worklist') {
                badgeCount = pendingCount + emergencyCount
                badgeColor = emergencyCount > 0 ? '#ff7a45' : '#1890ff'
              } else if (wc.key === 'import') {
                badgeCount = importProcessing
                badgeColor = '#1890ff'
              }
              return (
                <Tooltip key={wc.key} title={`${wc.label} (${wc.shortcut})`}>
                  <button
                    className={`pacs-nav-btn ${isActive ? 'active' : ''}`}
                    onClick={() => setActiveWindow(wc.key)}
                  >
                    <Badge
                      count={badgeCount || 0}
                      size="small"
                      offset={[-4, 2]}
                      style={{ backgroundColor: badgeColor || undefined }}
                    >
                      <span>{wc.icon}</span>
                    </Badge>
                    <span style={{ marginLeft: 2 }}>{wc.label}</span>
                  </button>
                </Tooltip>
              )
            })}
          </div>

          <div className="pacs-header-user">
            <Tooltip title="快捷键 (F1)">
              <Button
                type="text"
                icon={<QuestionCircleOutlined />}
                onClick={() => setShowShortcuts(true)}
              />
            </Tooltip>
            <Tooltip title="消息通知">
              <Badge count={returnedCount + emergencyCount} size="small">
                <Button type="text" icon={<BellOutlined />} onClick={() => setActiveWindow('worklist')} />
              </Badge>
            </Tooltip>
            <Divider type="vertical" style={{ height: 20 }} />
            <Dropdown
              menu={{
                items: [
                  { key: '1', icon: <UserOutlined />, label: '个人中心' },
                  {
                    key: '2',
                    icon: <EditOutlined />,
                    label: '修改密码',
                  },
                  { type: 'divider' as const },
                  {
                    key: '3',
                    icon: <SettingOutlined />,
                    label: '个人设置',
                    onClick: () => setActiveWindow('settings'),
                  },
                  { type: 'divider' as const },
                  {
                    key: '4',
                    icon: <LogoutOutlined />,
                    label: '退出登录',
                    danger: true,
                  },
                ],
              }}
            >
              <Space style={{ cursor: 'pointer', padding: '0 8px', borderRadius: 4, marginRight: -8 }}>
                <Avatar size={28} icon={<UserOutlined />} style={{ background: '#1890ff' }} />
                <div style={{ textAlign: 'left' }}>
                  <div style={{ fontSize: 12, fontWeight: 500 }}>李医生</div>
                  <div style={{ fontSize: 10, color: '#707070' }}>主治医师</div>
                </div>
              </Space>
            </Dropdown>
          </div>
        </div>

        {/* Main content */}
        <div className="pacs-main">
          <div className="pacs-content">{renderWindow()}</div>
        </div>

        {/* Status bar */}
        <div className="pacs-status-bar">
          <div className="status-bar-left">
            <span className="status-item">
              <span className="status-dot" />
              PACS Server 已连接
            </span>
            <span className="status-item">
              <span className="status-dot" style={{ background: '#52c41a' }} />
              HL7 接口正常
            </span>
            <span className="status-item">
              DICOM 存储: 78.2 TB / 100 TB
            </span>
          </div>
          <div className="status-bar-right">
            {emergencyCount > 0 && (
              <Tag color="#ff7a45" style={{ border: 'none' }}>
                急诊: {emergencyCount}
              </Tag>
            )}
            {pendingCount > 0 && (
              <Tag color="blue" style={{ border: 'none' }}>
                待诊: {pendingCount}
              </Tag>
            )}
            {returnedCount > 0 && (
              <Tag color="red" style={{ border: 'none' }}>
                退回: {returnedCount}
              </Tag>
            )}
            <span>患者: {studies.length}</span>
            <span>
              <span style={{ color: '#707070', fontFamily: 'Consolas, monospace' }}>{currentTime}</span>
            </span>
          </div>
        </div>

        {/* Shortcuts modal */}
        <Modal
          title="快捷键说明"
          open={showShortcuts}
          onCancel={() => setShowShortcuts(false)}
          footer={[
            <Button key="close" type="primary" onClick={() => setShowShortcuts(false)}>
              知道了
            </Button>,
          ]}
          width={640}
        >
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: '1fr 1fr',
              gap: '16px 24px',
            }}
          >
            {userSettings.shortcuts.map((sc) => (
              <div
                key={sc.id}
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  padding: '8px 12px',
                  borderRadius: 4,
                  background: '#1a1a1a',
                  border: '1px solid #303030',
                }}
              >
                <div>
                  <div style={{ fontSize: 13, fontWeight: 500 }}>{sc.action}</div>
                  <div style={{ fontSize: 11, color: '#707070', marginTop: 2 }}>{sc.description}</div>
                </div>
                <span
                  style={{
                    fontFamily: 'Consolas, monospace',
                    background: '#2a2a2a',
                    border: '1px solid #404040',
                    padding: '3px 10px',
                    borderRadius: 4,
                    fontSize: 12,
                    color: '#1890ff',
                  }}
                >
                  {sc.keys}
                </span>
              </div>
            ))}
          </div>
        </Modal>
      </div>
    </AntApp>
  )
}

export default App
