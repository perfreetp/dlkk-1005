import React, { useState, useCallback } from 'react'
import {
  Button,
  Table,
  Input,
  Space,
  Tag,
  Progress,
  Tooltip,
  Modal,
  message,
  Empty,
  Typography,
  Divider,
  Card,
} from 'antd'
import {
  UploadOutlined,
  FolderOpenOutlined,
  SearchOutlined,
  RetweetOutlined,
  DeleteOutlined,
  CheckCircleOutlined,
  CloseCircleOutlined,
  LoadingOutlined,
  SyncOutlined,
  ImportOutlined,
  ExclamationCircleOutlined,
} from '@ant-design/icons'
import type { ColumnsType } from 'antd/es/table'
import { useAppStore } from '@/stores/appStore'
import type { ImportTask } from '@/types'
import dayjs from 'dayjs'

const { TextArea } = Input
const { Title, Text } = Typography

const statusRender: Record<ImportTask['status'], { label: string; icon: React.ReactNode; color: string }> = {
  pending: { label: '等待中', icon: <SyncOutlined spin />, color: '#a0a0a0' },
  matching: { label: '匹配中', icon: <SearchOutlined spin />, color: '#1890ff' },
  importing: { label: '导入中', icon: <LoadingOutlined />, color: '#1890ff' },
  success: { label: '成功', icon: <CheckCircleOutlined />, color: '#52c41a' },
  failed: { label: '失败', icon: <CloseCircleOutlined />, color: '#ff4d4f' },
  retry: { label: '重试中', icon: <RetweetOutlined spin />, color: '#faad14' },
}

const ImportWindow: React.FC = () => {
  const {
    importTasks,
    addImportTask,
    updateImportTask,
    retryImportTask,
    removeImportTask,
    studies,
  } = useAppStore()

  const [accessionInput, setAccessionInput] = useState('')
  const [showMatchDialog, setShowMatchDialog] = useState(false)
  const [currentTask, setCurrentTask] = useState<ImportTask | null>(null)
  const [matchedStudyId, setMatchedStudyId] = useState<string>('')

  const handleImportFiles = useCallback(async () => {
    try {
      const api = (window as any).electronAPI
      if (!api) {
        simulateImport()
        return
      }
      const result = await api.openFileDialog()
      if (!result.canceled && result.filePaths?.length > 0) {
        result.filePaths.forEach((filePath: string) => {
          const fileName = filePath.split(/[\\/]/).pop() || filePath
          addImportTask({
            fileName,
            filePath,
            accessionNumber: '',
            status: 'pending',
            progress: 0,
            retryCount: 0,
            maxRetries: 3,
          })
        })
        message.success(`已添加 ${result.filePaths.length} 个文件到导入队列`)
      }
    } catch (e) {
      simulateImport()
    }
  }, [addImportTask])

  const handleImportDirectory = useCallback(async () => {
    try {
      const api = (window as any).electronAPI
      if (!api) {
        simulateImport()
        return
      }
      const result = await api.openDirectoryDialog()
      if (!result.canceled && result.filePaths?.length > 0) {
        const dir = result.filePaths[0]
        for (let i = 0; i < 5; i++) {
          addImportTask({
            fileName: `IM_${Date.now()}_${i}.dcm`,
            filePath: `${dir}/IM_${i}.dcm`,
            accessionNumber: '',
            status: 'pending',
            progress: 0,
            retryCount: 0,
            maxRetries: 3,
          })
        }
        message.success('已扫描目录并添加到导入队列')
      }
    } catch (e) {
      simulateImport()
    }
  }, [addImportTask])

  const simulateImport = () => {
    const count = Math.floor(Math.random() * 4) + 2
    for (let i = 0; i < count; i++) {
      const taskId = `sim_${Date.now()}_${i}`
      const randomAcc = studies[Math.floor(Math.random() * studies.length)]?.accessionNumber || ''
      addImportTask({
        fileName: `DICOM_${taskId}.dcm`,
        filePath: `C:/DICOM/${taskId}.dcm`,
        accessionNumber: Math.random() > 0.3 ? randomAcc : '',
        status: 'pending',
        progress: 0,
        retryCount: 0,
        maxRetries: 3,
      })
    }
    message.success(`已添加 ${count} 个文件到导入队列`)
  }

  const startMatching = useCallback(
    (task: ImportTask) => {
      updateImportTask(task.id, { status: 'matching', progress: 10 })
      setTimeout(() => {
        const matched = studies.find((s) => s.accessionNumber === task.accessionNumber)
        if (matched) {
          updateImportTask(task.id, {
            status: 'importing',
            progress: 20,
            studyId: matched.id,
          })
          startImporting(task.id)
        } else if (task.accessionNumber) {
          updateImportTask(task.id, {
            status: 'failed',
            errorMessage: `检查号 "${task.accessionNumber}" 未在PACS中找到匹配记录`,
          })
        } else {
          updateImportTask(task.id, {
            status: 'failed',
            errorMessage: 'DICOM文件中未提取到检查号，请手动匹配',
          })
        }
      }, 800 + Math.random() * 700)
    },
    [updateImportTask, studies]
  )

  const startImporting = (taskId: string) => {
    let progress = 20
    const interval = setInterval(() => {
      progress += Math.random() * 15 + 5
      if (progress >= 100) {
        progress = 100
        clearInterval(interval)
        updateImportTask(taskId, { status: 'success', progress: 100 })
      } else if (progress > 60 && Math.random() < 0.1) {
        clearInterval(interval)
        const task = importTasks.find((t) => t.id === taskId)
        if (task && task.retryCount < task.maxRetries) {
          updateImportTask(taskId, {
            status: 'retry',
            progress: Math.floor(progress),
            errorMessage: '网络传输中断，准备重试...',
          })
        } else {
          updateImportTask(taskId, {
            status: 'failed',
            progress: Math.floor(progress),
            errorMessage: '上传失败：服务器响应超时，已达最大重试次数',
          })
        }
      } else {
        updateImportTask(taskId, { progress: Math.floor(Math.min(progress, 99)) })
      }
    }, 400)
  }

  const processPendingTasks = () => {
    const pending = importTasks.filter((t) => t.status === 'pending')
    pending.forEach((t, idx) => {
      setTimeout(() => startMatching(t), idx * 300)
    })
    if (pending.length > 0) {
      message.info(`开始处理 ${pending.length} 个导入任务`)
    }
  }

  const openMatchDialog = (task: ImportTask) => {
    setCurrentTask(task)
    setMatchedStudyId('')
    setAccessionInput(task.accessionNumber || '')
    setShowMatchDialog(true)
  }

  const confirmMatch = () => {
    if (!currentTask) return
    const finalStudyId = matchedStudyId || studies.find((s) => s.accessionNumber === accessionInput)?.id
    if (!finalStudyId) {
      message.error('请选择或输入正确的检查号以匹配')
      return
    }
    updateImportTask(currentTask.id, {
      accessionNumber: accessionInput || studies.find((s) => s.id === finalStudyId)?.accessionNumber,
      studyId: finalStudyId,
    })
    setShowMatchDialog(false)
    retryImportTask(currentTask.id)
    message.success('匹配成功，重新开始导入')
  }

  const retryTask = (task: ImportTask) => {
    if (task.retryCount >= task.maxRetries && !task.studyId) {
      openMatchDialog(task)
    } else {
      retryImportTask(task.id)
    }
  }

  const columns: ColumnsType<ImportTask> = [
    {
      title: '文件名',
      dataIndex: 'fileName',
      key: 'fileName',
      width: 220,
      render: (name) => (
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <ImportOutlined style={{ color: '#1890ff' }} />
          <span style={{ fontFamily: 'Consolas, monospace', fontSize: 12 }}>{name}</span>
        </div>
      ),
    },
    {
      title: '检查号匹配',
      dataIndex: 'accessionNumber',
      key: 'accessionNumber',
      width: 160,
      render: (acc, record) => {
        const matched = studies.find((s) => s.id === record.studyId)
        if (acc || matched) {
          return (
            <Tag color="green" style={{ margin: 0 }}>
              {acc || matched?.accessionNumber}
            </Tag>
          )
        }
        return (
          <Button
            size="small"
            type="primary"
            ghost
            icon={<SearchOutlined />}
            onClick={() => openMatchDialog(record)}
          >
            手动匹配
          </Button>
        )
      },
    },
    {
      title: '患者信息',
      key: 'patient',
      width: 160,
      render: (_, record) => {
        const matched = studies.find((s) => s.id === record.studyId)
        if (!matched) return <span style={{ color: '#707070' }}>-</span>
        return (
          <div style={{ fontSize: 12 }}>
            <div style={{ fontWeight: 500 }}>{matched.patient.name}</div>
            <div style={{ color: '#707070' }}>
              {matched.patient.gender} · {matched.patient.age}岁
            </div>
          </div>
        )
      },
    },
    {
      title: '状态',
      dataIndex: 'status',
      key: 'status',
      width: 100,
      render: (s: ImportTask['status']) => {
        const cfg = statusRender[s]
        return (
          <span style={{ color: cfg.color, display: 'inline-flex', alignItems: 'center', gap: 6 }}>
            {cfg.icon} {cfg.label}
          </span>
        )
      },
    },
    {
      title: '进度',
      key: 'progress',
      width: 180,
      render: (_, record) => (
        <div>
          <Progress
            percent={record.progress}
            size="small"
            showInfo
            status={
              record.status === 'failed'
                ? 'exception'
                : record.status === 'success'
                ? 'success'
                : 'active'
            }
          />
          {record.errorMessage && (
            <div style={{ fontSize: 11, color: '#ff7875', marginTop: 4, display: 'flex', alignItems: 'center', gap: 4 }}>
              <ExclamationCircleOutlined />
              {record.errorMessage}
            </div>
          )}
        </div>
      ),
    },
    {
      title: '重试',
      key: 'retry',
      width: 90,
      render: (_, r) => (
        <span style={{ color: r.retryCount > 0 ? '#faad14' : '#a0a0a0', fontSize: 12 }}>
          {r.retryCount}/{r.maxRetries}
        </span>
      ),
    },
    {
      title: '创建时间',
      dataIndex: 'createdAt',
      key: 'createdAt',
      width: 150,
      render: (t) => <span style={{ color: '#707070', fontSize: 12 }}>{t}</span>,
    },
    {
      title: '操作',
      key: 'actions',
      width: 120,
      render: (_, record) => (
        <Space size={4}>
          {(record.status === 'failed' || record.status === 'retry') && (
            <Tooltip title="重试/匹配">
              <Button size="small" type="link" icon={<RetweetOutlined />} onClick={() => retryTask(record)}>
                重试
              </Button>
            </Tooltip>
          )}
          <Tooltip title="删除">
            <Button
              size="small"
              type="link"
              danger
              icon={<DeleteOutlined />}
              onClick={() => {
                removeImportTask(record.id)
              }}
            >
              删除
            </Button>
          </Tooltip>
        </Space>
      ),
    },
  ]

  const stats = {
    total: importTasks.length,
    success: importTasks.filter((t) => t.status === 'success').length,
    failed: importTasks.filter((t) => t.status === 'failed').length,
    processing: importTasks.filter((t) => ['pending', 'matching', 'importing', 'retry'].includes(t.status)).length,
  }

  return (
    <div className="window-content">
      <div className="toolbar-group">
        <Space wrap>
          <Button type="primary" icon={<UploadOutlined />} size="large" onClick={handleImportFiles}>
            导入文件
          </Button>
          <Button icon={<FolderOpenOutlined />} size="large" onClick={handleImportDirectory}>
            导入目录
          </Button>
          <Button icon={<SyncOutlined />} onClick={processPendingTasks} disabled={stats.processing > 0}>
            开始处理队列
          </Button>
          <Divider type="vertical" style={{ height: 32 }} />
          <Input
            style={{ width: 220 }}
            placeholder="输入检查号快速匹配..."
            prefix={<SearchOutlined style={{ color: '#707070' }} />}
            value={accessionInput}
            onChange={(e) => setAccessionInput(e.target.value)}
          />
        </Space>
        <Space style={{ marginLeft: 'auto' }}>
          <Card size="small" style={{ background: 'transparent', border: '1px solid #303030' }}>
            <Space size={24}>
              <div>
                <Text type="secondary">总计</Text>
                <div style={{ fontSize: 18, fontWeight: 600 }}>{stats.total}</div>
              </div>
              <div>
                <Text type="secondary">处理中</Text>
                <div style={{ fontSize: 18, fontWeight: 600, color: '#1890ff' }}>{stats.processing}</div>
              </div>
              <div>
                <Text type="secondary">成功</Text>
                <div style={{ fontSize: 18, fontWeight: 600, color: '#52c41a' }}>{stats.success}</div>
              </div>
              <div>
                <Text type="secondary">失败</Text>
                <div style={{ fontSize: 18, fontWeight: 600, color: '#ff4d4f' }}>{stats.failed}</div>
              </div>
            </Space>
          </Card>
        </Space>
      </div>

      <Table
        columns={columns}
        dataSource={importTasks}
        rowKey="id"
        size="middle"
        locale={{
          emptyText: <Empty description="暂无导入任务，请点击上方按钮导入DICOM文件" image={Empty.PRESENTED_IMAGE_SIMPLE} />,
        }}
        pagination={{
          showSizeChanger: true,
          pageSize: 15,
          showTotal: (total) => `共 ${total} 个任务`,
        }}
      />

      <Modal
        title="手动匹配检查记录"
        open={showMatchDialog}
        onOk={confirmMatch}
        onCancel={() => setShowMatchDialog(false)}
        okText="确认匹配并导入"
        width={620}
      >
        <div style={{ marginBottom: 16 }}>
          <Text type="secondary">当前文件：</Text>
          <Text code>{currentTask?.fileName}</Text>
        </div>
        <div style={{ marginBottom: 16 }}>
          <Text type="secondary">输入检查号：</Text>
          <Input
            placeholder="请输入或粘贴检查号"
            style={{ marginTop: 8 }}
            value={accessionInput}
            onChange={(e) => setAccessionInput(e.target.value)}
          />
        </div>
        <div>
          <Text type="secondary">或从列表中选择：</Text>
          <div
            style={{
              marginTop: 8,
              maxHeight: 240,
              overflow: 'auto',
              border: '1px solid #303030',
              borderRadius: 6,
              padding: 8,
            }}
          >
            {studies.map((s) => (
              <div
                key={s.id}
                onClick={() => {
                  setMatchedStudyId(s.id)
                  setAccessionInput(s.accessionNumber)
                }}
                style={{
                  padding: '8px 12px',
                  cursor: 'pointer',
                  borderRadius: 4,
                  marginBottom: 4,
                  border: matchedStudyId === s.id ? '1px solid #1890ff' : '1px solid transparent',
                  background: matchedStudyId === s.id ? 'rgba(24,144,255,0.08)' : 'transparent',
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ fontWeight: 500 }}>{s.patient.name}</span>
                  <Tag>{s.modality}</Tag>
                </div>
                <div style={{ fontSize: 12, color: '#707070', marginTop: 4 }}>
                  {s.accessionNumber} · {s.studyDescription} · {s.studyDate}
                </div>
              </div>
            ))}
          </div>
        </div>
      </Modal>
    </div>
  )
}

export default ImportWindow
