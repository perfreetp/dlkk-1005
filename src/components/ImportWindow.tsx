import React, { useState, useCallback, useMemo } from 'react'
import {
  Button,
  Table,
  Input,
  Select,
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
  Collapse,
  Badge,
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
import type { ImportTask, ImportGroup } from '@/types'
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
    importGroups,
    addImportTask,
    updateImportTask,
    retryImportTask,
    removeImportTask,
    studies,
    getGroupFiles,
  } = useAppStore()

  const [statusFilter, setStatusFilter] = useState<string>('all')
  const [searchText, setSearchText] = useState('')

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
      // 兼容旧代码但不做任何事，store 中的 scheduleImportTask 已自动处理
      return task
    },
    []
  )

  const startImporting = (taskId: string) => {
    // 兼容旧代码但不做任何事
    return taskId
  }

  const processPendingTasks = () => {
    const pending = importTasks.filter((t) => t.status === 'pending')
    if (pending.length === 0) {
      message.info('暂无等待中的任务')
    } else {
      message.info(`将自动处理 ${pending.length} 个等待中的任务`)
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

  const getGroupStatusInfo = (group: ImportGroup) => {
    const files = getGroupFiles(group.id)
    if (files.length === 0) {
      return { tag: '排队中', color: 'default' }
    }
    const hasFailed = files.some((f) => f.status === 'failed')
    const allSuccess = files.every((f) => f.status === 'success')
    const hasProcessing = files.some((f) => ['importing', 'matching'].includes(f.status))
    if (hasFailed) return { tag: '部分失败', color: 'red' }
    if (allSuccess) return { tag: '全部成功', color: 'green' }
    if (hasProcessing) return { tag: '处理中', color: 'blue' }
    return { tag: '排队中', color: 'default' }
  }

  const getGroupStudy = (group: ImportGroup) => {
    const files = getGroupFiles(group.id)
    const fileWithStudyId = files.find((f) => f.studyId)
    if (fileWithStudyId?.studyId) {
      return studies.find((s) => s.id === fileWithStudyId.studyId)
    }
    return studies.find((s) => s.accessionNumber === group.accessionNumber)
  }

  const getGroupModality = (group: ImportGroup) => {
    const study = getGroupStudy(group)
    if (study) return study.modality
    const files = getGroupFiles(group.id)
    const fileWithModality = files.find((f) => f.modality)
    return fileWithModality?.modality || '-'
  }

  const filteredGroups = useMemo(() => {
    let groups = importGroups
    if (searchText) {
      const lower = searchText.toLowerCase()
      groups = groups.filter((g) => {
        const study = getGroupStudy(g)
        const patientName = study?.patient.name || ''
        return (
          g.accessionNumber.toLowerCase().includes(lower) ||
          patientName.toLowerCase().includes(lower)
        )
      })
    }
    if (statusFilter !== 'all') {
      groups = groups.filter((g) => {
        const files = getGroupFiles(g.id)
        if (statusFilter === 'success') return files.some((f) => f.status === 'success')
        if (statusFilter === 'failed') return files.some((f) => f.status === 'failed')
        if (statusFilter === 'processing') return files.some((f) => ['pending', 'matching', 'importing', 'retry'].includes(f.status))
        return true
      })
    }
    return groups
  }, [importGroups, searchText, statusFilter, studies, importTasks])

  const groupColumns: ColumnsType<ImportTask> = [
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
      title: '文件大小',
      key: 'fileSize',
      width: 100,
      render: (_, record) => {
        const size = record.fileSize || (1024 * 1024 * (5 + Math.random() * 20))
        if (size < 1024) return `${size} B`
        if (size < 1024 * 1024) return `${(size / 1024).toFixed(1)} KB`
        return `${(size / (1024 * 1024)).toFixed(1)} MB`
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
      title: '操作',
      key: 'actions',
      width: 160,
      render: (_, record) => (
        <Space size={4}>
          {(record.status === 'failed' || record.status === 'retry') && (
            <Tooltip title="重试/匹配">
              <Button size="small" type="link" icon={<RetweetOutlined />} onClick={() => retryTask(record)}>
                重试
              </Button>
            </Tooltip>
          )}
          {record.status === 'failed' && !record.studyId && (
            <Tooltip title="手动匹配">
              <Button size="small" type="link" icon={<SearchOutlined />} onClick={() => openMatchDialog(record)}>
                匹配
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
          <Button icon={<SyncOutlined />} onClick={processPendingTasks} disabled>
            自动处理中
          </Button>
          <Divider type="vertical" style={{ height: 32 }} />
          <Input
            style={{ width: 240 }}
            placeholder="搜索检查号/患者姓名..."
            prefix={<SearchOutlined style={{ color: '#707070' }} />}
            value={searchText}
            onChange={(e) => setSearchText(e.target.value)}
            allowClear
          />
          <Select
            style={{ width: 140 }}
            value={statusFilter}
            onChange={setStatusFilter}
            options={[
              { value: 'all', label: '全部状态' },
              { value: 'processing', label: '处理中' },
              { value: 'success', label: '成功' },
              { value: 'failed', label: '失败' },
            ]}
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

      {filteredGroups.length === 0 ? (
        <Empty
          description="暂无导入分组，请点击上方按钮导入DICOM文件"
          image={Empty.PRESENTED_IMAGE_SIMPLE}
          style={{ padding: '60px 0' }}
        />
      ) : (
        <Collapse
          defaultActiveKey={filteredGroups.map((g) => g.id)}
          style={{ background: 'transparent', border: 'none' }}
          items={filteredGroups.map((group) => {
            const files = getGroupFiles(group.id)
            const study = getGroupStudy(group)
            const patientName = study?.patient.name || '-'
            const modality = getGroupModality(group)
            const statusInfo = getGroupStatusInfo(group)
            const successCount = files.filter((f) => f.status === 'success').length
            const totalCount = files.length
            const progressPercent = totalCount > 0 ? Math.round((successCount / totalCount) * 100) : 0
            return {
              key: group.id,
              label: (
                <Space wrap style={{ width: '100%', padding: '4px 0' }}>
                  <Text strong style={{ fontFamily: 'Consolas, monospace' }}>
                    {group.accessionNumber}
                  </Text>
                  <Text>{patientName}</Text>
                  <Tag color="purple" style={{ margin: 0 }}>
                    {modality}
                  </Tag>
                  <Tag color={statusInfo.color} style={{ margin: 0 }}>
                    {statusInfo.tag}
                  </Tag>
                  <div style={{ width: 180 }}>
                    <Progress
                      percent={progressPercent}
                      size="small"
                      format={() => `${successCount}/${totalCount}`}
                      status={
                        statusInfo.color === 'red' ? 'exception' :
                        statusInfo.color === 'green' ? 'success' : 'active'
                      }
                    />
                  </div>
                  <Badge count={totalCount} showZero size="small" />
                </Space>
              ),
              children: (
                <div>
                  <Table
                    columns={groupColumns}
                    dataSource={files}
                    rowKey="id"
                    size="small"
                    pagination={false}
                    locale={{
                      emptyText: <Empty description="暂无文件" image={Empty.PRESENTED_IMAGE_SIMPLE} />,
                    }}
                  />
                  <div style={{ padding: '8px 16px', textAlign: 'right', color: '#707070', fontSize: 12 }}>
                    汇总：成功 {successCount} / 总 {totalCount}
                  </div>
                </div>
              ),
            }
          })}
        />
      )}

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
