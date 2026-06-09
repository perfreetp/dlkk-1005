import React, { useState, useMemo } from 'react'
import { Table, Input, Select, DatePicker, Button, Space, Tag, Tooltip, Typography, Segmented, Card, Row, Col, List, Avatar } from 'antd'
import {
  SearchOutlined,
  EyeOutlined,
  FileTextOutlined,
  PrinterOutlined,
  AlertOutlined,
  ClockCircleOutlined,
  CheckCircleOutlined,
  RollbackOutlined,
  FilterOutlined,
  ReloadOutlined,
  UserOutlined,
  AppstoreOutlined,
  BarChartOutlined,
} from '@ant-design/icons'
import type { ColumnsType } from 'antd/es/table'
import { useAppStore } from '@/stores/appStore'
import type { Study, ExaminationStatus } from '@/types'
import dayjs from 'dayjs'

const { RangePicker } = DatePicker

const statusConfig: Record<ExaminationStatus, { label: string; icon: React.ReactNode; className: string; priority: number }> = {
  emergency: {
    label: '急诊',
    icon: <AlertOutlined />,
    className: 'status-emergency',
    priority: 0,
  },
  pending: {
    label: '待诊',
    icon: <ClockCircleOutlined />,
    className: 'status-pending',
    priority: 1,
  },
  reviewed: {
    label: '已审',
    icon: <CheckCircleOutlined />,
    className: 'status-reviewed',
    priority: 2,
  },
  returned: {
    label: '退回',
    icon: <RollbackOutlined />,
    className: 'status-returned',
    priority: 3,
  },
}

const WorklistWindow: React.FC = () => {
  const {
    studies,
    selectedStudyId,
    setSelectedStudy,
    setActiveWindow,
    createReport,
    updateStudyStatus,
  } = useAppStore()

  const [searchText, setSearchText] = useState('')
  const [statusFilter, setStatusFilter] = useState<ExaminationStatus | 'all'>('all')
  const [modalityFilter, setModalityFilter] = useState<string>('all')
  const [dateRange, setDateRange] = useState<[dayjs.Dayjs | null, dayjs.Dayjs | null] | null>(null)
  const [viewMode, setViewMode] = useState<'list' | 'workload'>('list')
  const [reviewerFilter, setReviewerFilter] = useState<string>('all')

  const statusCounts = useMemo(() => {
    const counts: Record<ExaminationStatus, number> = {
      emergency: 0,
      pending: 0,
      reviewed: 0,
      returned: 0,
    }
    studies.forEach((s) => counts[s.status]++)
    return counts
  }, [studies])

  const modalities = useMemo(() => {
    const set = new Set(studies.map((s) => s.modality))
    return Array.from(set)
  }, [studies])

  const todayStudies = useMemo(() => {
    const today = dayjs().format('YYYY-MM-DD')
    return studies.filter((s) => s.studyDate === today)
  }, [studies])

  const reviewerStats = useMemo(() => {
    const map: Record<string, { completed: number; processing: number }> = {}
    const defaultReviewers = ['李医生', '王医生', '张医生', '赵医生']
    defaultReviewers.forEach((r) => {
      map[r] = { completed: 0, processing: 0 }
    })
    todayStudies.forEach((s) => {
      const reviewer = s.referringPhysician || defaultReviewers[Math.floor(Math.random() * defaultReviewers.length)]
      if (!map[reviewer]) map[reviewer] = { completed: 0, processing: 0 }
      if (s.status === 'reviewed') {
        map[reviewer].completed++
      } else {
        map[reviewer].processing++
      }
    })
    return Object.entries(map).map(([name, stats]) => ({
      name,
      completed: stats.completed,
      processing: stats.processing,
      total: stats.completed + stats.processing,
    })).filter((r) => r.total > 0)
  }, [todayStudies])

  const modalityStats = useMemo(() => {
    const map: Record<string, { total: number; pending: number }> = {}
    todayStudies.forEach((s) => {
      if (!map[s.modality]) map[s.modality] = { total: 0, pending: 0 }
      map[s.modality].total++
      if (s.status === 'pending' || s.status === 'emergency') {
        map[s.modality].pending++
      }
    })
    return Object.entries(map).map(([modality, stats]) => ({
      modality,
      total: stats.total,
      pending: stats.pending,
    }))
  }, [todayStudies])

  const statusStats = useMemo(() => {
    const labels: Record<ExaminationStatus, string> = {
      pending: '待诊',
      emergency: '急诊',
      reviewed: '已审',
      returned: '退回',
    }
    const counts: Record<ExaminationStatus, number> = {
      emergency: 0,
      pending: 0,
      reviewed: 0,
      returned: 0,
    }
    todayStudies.forEach((s) => counts[s.status]++)
    return (['emergency', 'pending', 'reviewed', 'returned'] as ExaminationStatus[]).map((s) => ({
      status: s,
      label: labels[s],
      count: counts[s],
    }))
  }, [todayStudies])

  const handleWorkloadClick = (type: 'reviewer' | 'modality' | 'status', value: string) => {
    if (type === 'reviewer') {
      setReviewerFilter(value)
    } else if (type === 'modality') {
      setModalityFilter(value)
    } else if (type === 'status') {
      setStatusFilter(value as ExaminationStatus)
    }
    setViewMode('list')
  }

  const filteredStudies = useMemo(() => {
    return studies
      .filter((s) => {
        if (statusFilter !== 'all' && s.status !== statusFilter) return false
        if (modalityFilter !== 'all' && s.modality !== modalityFilter) return false
        if (reviewerFilter !== 'all') {
          const reviewer = s.referringPhysician || '李医生'
          if (reviewer !== reviewerFilter) return false
        }
        if (searchText) {
          const lower = searchText.toLowerCase()
          if (
            !s.patient.name.toLowerCase().includes(lower) &&
            !s.patient.patientId.toLowerCase().includes(lower) &&
            !s.accessionNumber.toLowerCase().includes(lower) &&
            !s.studyDescription.toLowerCase().includes(lower)
          )
            return false
        }
        if (dateRange && dateRange[0] && dateRange[1]) {
          const studyDate = dayjs(s.studyDate)
          if (studyDate.isBefore(dateRange[0]) || studyDate.isAfter(dateRange[1])) return false
        }
        return true
      })
      .sort((a, b) => {
        const pa = statusConfig[a.status].priority
        const pb = statusConfig[b.status].priority
        if (pa !== pb) return pa - pb
        return dayjs(b.updatedAt).valueOf() - dayjs(a.updatedAt).valueOf()
      })
  }, [studies, statusFilter, modalityFilter, reviewerFilter, searchText, dateRange])

  const openViewer = (study: Study) => {
    setSelectedStudy(study.id)
    setActiveWindow('viewer')
  }

  const handleCreateReport = (study: Study) => {
    setSelectedStudy(study.id)
    createReport(study.id)
  }

  const handlePrint = (study: Study) => {
    setSelectedStudy(study.id)
    setActiveWindow('print')
  }

  const columns: ColumnsType<Study> = [
    {
      title: '状态',
      dataIndex: 'status',
      key: 'status',
      width: 80,
      fixed: 'left',
      render: (status: ExaminationStatus) => {
        const cfg = statusConfig[status]
        return (
          <Tag icon={cfg.icon} className={`status-badge ${cfg.className}`} color="" bordered={false}>
            {cfg.label}
          </Tag>
        )
      },
      filters: [
        { text: '急诊', value: 'emergency' },
        { text: '待诊', value: 'pending' },
        { text: '已审', value: 'reviewed' },
        { text: '退回', value: 'returned' },
      ],
      onFilter: (value, record) => record.status === value,
    },
    {
      title: '优先级',
      dataIndex: 'priority',
      key: 'priority',
      width: 80,
      render: (p: number) => {
        const colors = ['#ff7a45', '#ff4d4f', '#faad14', '#1890ff', '#a0a0a0']
        const labels = ['紧急', '高', '较高', '普通', '低']
        return <span style={{ color: colors[p] || colors[4] }}>{labels[p] || '普通'}</span>
      },
    },
    {
      title: '患者姓名',
      dataIndex: ['patient', 'name'],
      key: 'patientName',
      width: 100,
      render: (name: string, record) => (
        <div>
          <div style={{ fontWeight: 600 }}>{name}</div>
          <div style={{ fontSize: 11, color: '#707070' }}>
            {record.patient.gender} · {record.patient.age}岁
          </div>
        </div>
      ),
    },
    {
      title: '患者ID',
      dataIndex: ['patient', 'patientId'],
      key: 'patientId',
      width: 120,
      render: (id: string) => <span style={{ fontFamily: 'Consolas, monospace', fontSize: 12 }}>{id}</span>,
    },
    {
      title: '检查号',
      dataIndex: 'accessionNumber',
      key: 'accessionNumber',
      width: 140,
      render: (num: string) => <span style={{ fontFamily: 'Consolas, monospace' }}>{num}</span>,
    },
    {
      title: '检查类型',
      dataIndex: 'modality',
      key: 'modality',
      width: 80,
      render: (m: string) => (
        <Tag color="blue" style={{ margin: 0 }}>
          {m}
        </Tag>
      ),
      filters: modalities.map((m) => ({ text: m, value: m })),
      onFilter: (value, record) => record.modality === value,
    },
    {
      title: '检查描述',
      dataIndex: 'studyDescription',
      key: 'studyDescription',
      ellipsis: true,
      width: 180,
    },
    {
      title: '序列数/图像数',
      key: 'counts',
      width: 110,
      render: (_, r) => (
        <span style={{ color: '#a0a0a0', fontSize: 12 }}>
          {r.seriesCount} 序列 / {r.imageCount} 幅
        </span>
      ),
    },
    {
      title: '申请医生',
      dataIndex: 'referringPhysician',
      key: 'referringPhysician',
      width: 90,
      render: (n) => n || '-',
    },
    {
      title: '检查时间',
      dataIndex: 'studyDate',
      key: 'studyDate',
      width: 160,
      render: (_, r) => (
        <span style={{ fontSize: 12 }}>
          {r.studyDate} {r.studyTime}
        </span>
      ),
      sorter: (a, b) => dayjs(a.studyDate).valueOf() - dayjs(b.studyDate).valueOf(),
    },
    {
      title: '更新时间',
      dataIndex: 'updatedAt',
      key: 'updatedAt',
      width: 160,
      render: (t: string) => <span style={{ color: '#707070', fontSize: 12 }}>{t}</span>,
    },
    {
      title: '操作',
      key: 'actions',
      width: 200,
      fixed: 'right',
      render: (_, record) => (
        <Space size={4}>
          <Tooltip title="阅片">
            <Button size="small" type="link" icon={<EyeOutlined />} onClick={() => openViewer(record)}>
              阅片
            </Button>
          </Tooltip>
          <Tooltip title="写报告">
            <Button size="small" type="link" icon={<FileTextOutlined />} onClick={() => handleCreateReport(record)}>
              报告
            </Button>
          </Tooltip>
          <Tooltip title="打印">
            <Button size="small" type="link" icon={<PrinterOutlined />} onClick={() => handlePrint(record)}>
              打印
            </Button>
          </Tooltip>
        </Space>
      ),
    },
  ]

  return (
    <div className="window-content">
      <div className="toolbar-group">
        <Space style={{ flex: 1, flexWrap: 'wrap' }} size={12}>
          {viewMode === 'list' && (
            <>
              <Input
                prefix={<SearchOutlined style={{ color: '#707070' }} />}
                placeholder="搜索患者姓名/ID/检查号/描述..."
                style={{ width: 320 }}
                value={searchText}
                onChange={(e) => setSearchText(e.target.value)}
                allowClear
              />
              <Select
                value={modalityFilter}
                onChange={setModalityFilter}
                style={{ width: 110 }}
                options={[
                  { value: 'all', label: '全部类型' },
                  ...modalities.map((m) => ({ value: m, label: m })),
                ]}
              />
              <RangePicker
                value={dateRange as any}
                onChange={(v) => setDateRange(v as any)}
                style={{ width: 260 }}
              />
              <Button icon={<FilterOutlined />} onClick={() => {
                setSearchText('')
                setStatusFilter('all')
                setModalityFilter('all')
                setReviewerFilter('all')
                setDateRange(null)
              }}>
                重置筛选
              </Button>
            </>
          )}
        </Space>
        <Space>
          <Button icon={<ReloadOutlined />} />
          <Segmented
            value={viewMode}
            onChange={(v) => setViewMode(v as 'list' | 'workload')}
            options={[
              { value: 'list', label: '列表视图', icon: <AppstoreOutlined /> },
              { value: 'workload', label: '工作量视图', icon: <BarChartOutlined /> },
            ]}
          />
        </Space>
      </div>

      {viewMode === 'list' && (
        <>
          <div className="toolbar-group" style={{ borderBottom: '1px solid #303030' }}>
            <div className="worklist-filters">
              <div
                className={`filter-chip ${statusFilter === 'all' ? 'active' : ''}`}
                onClick={() => setStatusFilter('all')}
              >
                全部 <span style={{ opacity: 0.7 }}>({studies.length})</span>
              </div>
              {(['emergency', 'pending', 'reviewed', 'returned'] as ExaminationStatus[]).map((s) => (
                <div
                  key={s}
                  className={`filter-chip ${statusFilter === s ? 'active' : ''}`}
                  onClick={() => setStatusFilter(s)}
                >
                  {statusConfig[s].icon} {statusConfig[s].label}
                  <span style={{ opacity: 0.7, marginLeft: 4 }}>({statusCounts[s]})</span>
                </div>
              ))}
            </div>
          </div>

          <Table<Study>
            columns={columns}
            dataSource={filteredStudies}
            rowKey="id"
            size="middle"
            rowClassName={(r) => (r.status === 'emergency' ? 'table-row-emergency' : '')}
            onRow={(record) => ({
              style: {
                background:
                  selectedStudyId === record.id ? 'rgba(24,144,255,0.08)' : undefined,
              },
              onClick: () => setSelectedStudy(record.id),
              onDoubleClick: () => openViewer(record),
            })}
            pagination={{
              showSizeChanger: true,
              showQuickJumper: true,
              pageSize: 20,
              showTotal: (total) => `共 ${total} 条检查记录`,
            }}
            scroll={{ x: 1500 }}
          />

          <style>{`
            .table-row-emergency {
              background: rgba(255, 122, 69, 0.05) !important;
            }
            .table-row-emergency:hover {
              background: rgba(255, 122, 69, 0.1) !important;
            }
          `}</style>
        </>
      )}

      {viewMode === 'workload' && (
        <div style={{ padding: 24 }}>
          <Row gutter={16}>
            <Col span={8}>
              <Card
                size="small"
                title={
                  <Space>
                    <UserOutlined />
                    <span>按审核医生</span>
                    <Tag color="blue">今日</Tag>
                  </Space>
                }
                style={{ minHeight: 360 }}
              >
                {reviewerStats.length === 0 ? (
                  <div style={{ color: '#707070', padding: '20px 0', textAlign: 'center' }}>
                    今日暂无数据
                  </div>
                ) : (
                  <List
                    size="small"
                    dataSource={reviewerStats}
                    renderItem={(item) => (
                      <List.Item
                        style={{ padding: '10px 0', borderBottom: '1px solid #303030' }}
                        actions={[
                          <Button
                            key="view"
                            type="link"
                            size="small"
                            onClick={() => handleWorkloadClick('reviewer', item.name)}
                          >
                            查看
                          </Button>,
                        ]}
                      >
                        <Space style={{ width: '100%' }} size={16}>
                          <Avatar size={32} icon={<UserOutlined />} style={{ background: '#1890ff' }} />
                          <Space direction="vertical" size={2}>
                            <span style={{ fontWeight: 500 }}>{item.name}</span>
                            <Space size={12}>
                              <Tag color="green">完成 {item.completed}</Tag>
                              <Tag color="blue">处理中 {item.processing}</Tag>
                            </Space>
                          </Space>
                        </Space>
                      </List.Item>
                    )}
                  />
                )}
              </Card>
            </Col>
            <Col span={8}>
              <Card
                size="small"
                title={
                  <Space>
                    <AppstoreOutlined />
                    <span>按检查类型</span>
                    <Tag color="purple">今日</Tag>
                  </Space>
                }
                style={{ minHeight: 360 }}
              >
                {modalityStats.length === 0 ? (
                  <div style={{ color: '#707070', padding: '20px 0', textAlign: 'center' }}>
                    今日暂无数据
                  </div>
                ) : (
                  <List
                    size="small"
                    dataSource={modalityStats}
                    renderItem={(item) => (
                      <List.Item
                        style={{ padding: '10px 0', borderBottom: '1px solid #303030' }}
                        actions={[
                          <Button
                            key="view"
                            type="link"
                            size="small"
                            onClick={() => handleWorkloadClick('modality', item.modality)}
                          >
                            查看
                          </Button>,
                        ]}
                      >
                        <Space style={{ width: '100%' }} size={16}>
                          <Tag color="purple" style={{ fontSize: 14, padding: '4px 12px' }}>
                            {item.modality}
                          </Tag>
                          <Space direction="vertical" size={2}>
                            <Space size={12}>
                              <Tag color="default">总数 {item.total}</Tag>
                              <Tag color="orange">待审 {item.pending}</Tag>
                            </Space>
                          </Space>
                        </Space>
                      </List.Item>
                    )}
                  />
                )}
              </Card>
            </Col>
            <Col span={8}>
              <Card
                size="small"
                title={
                  <Space>
                    <BarChartOutlined />
                    <span>按状态</span>
                    <Tag color="cyan">今日</Tag>
                  </Space>
                }
                style={{ minHeight: 360 }}
              >
                <List
                  size="small"
                  dataSource={statusStats}
                  renderItem={(item) => (
                    <List.Item
                      style={{ padding: '10px 0', borderBottom: '1px solid #303030' }}
                      actions={[
                        <Button
                          key="view"
                          type="link"
                          size="small"
                          onClick={() => handleWorkloadClick('status', item.status)}
                        >
                          查看
                        </Button>,
                      ]}
                    >
                      <Space style={{ width: '100%' }} size={16}>
                        <Tag
                          icon={statusConfig[item.status].icon}
                          className={`status-badge ${statusConfig[item.status].className}`}
                          color=""
                          bordered={false}
                          style={{ fontSize: 13 }}
                        >
                          {item.label}
                        </Tag>
                        <Tag
                          color={
                            item.status === 'emergency' ? 'red' :
                            item.status === 'pending' ? 'blue' :
                            item.status === 'reviewed' ? 'green' : 'orange'
                          }
                          style={{ fontSize: 14, padding: '4px 12px' }}
                        >
                          {item.count}
                        </Tag>
                      </Space>
                    </List.Item>
                  )}
                />
              </Card>
            </Col>
          </Row>
        </div>
      )}
    </div>
  )
}

export default WorklistWindow
