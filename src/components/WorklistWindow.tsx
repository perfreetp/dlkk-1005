import React, { useState, useMemo } from 'react'
import { Table, Input, Select, DatePicker, Button, Space, Tag, Tooltip, Typography } from 'antd'
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

  const filteredStudies = useMemo(() => {
    return studies
      .filter((s) => {
        if (statusFilter !== 'all' && s.status !== statusFilter) return false
        if (modalityFilter !== 'all' && s.modality !== modalityFilter) return false
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
  }, [studies, statusFilter, modalityFilter, searchText, dateRange])

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
            setDateRange(null)
          }}>
            重置筛选
          </Button>
        </Space>
      </div>

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
    </div>
  )
}

export default WorklistWindow
