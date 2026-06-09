import React, { useState, useMemo } from 'react'
import {
  Card,
  Button,
  Space,
  Typography,
  Select,
  InputNumber,
  Switch,
  Radio,
  Steps,
  Tag,
  Progress,
  Table,
  Empty,
  Checkbox,
  Modal,
  message,
  Tooltip,
  Divider,
  Tabs,
  Row,
  Col,
  Badge,
  List,
  Avatar,
  Input,
} from 'antd'
import {
  PrinterOutlined,
  PictureOutlined,
  FileImageOutlined,
  SaveOutlined,
  CheckCircleOutlined,
  LoadingOutlined,
  SafetyCertificateOutlined,
  FolderOpenOutlined,
  SettingOutlined,
  EyeOutlined,
  DeleteOutlined,
  PlayCircleOutlined,
  PauseCircleOutlined,
  DownloadOutlined,
  UploadOutlined,
  FileZipOutlined,
  UserOutlined,
  CalendarOutlined,
  FileTextOutlined,
} from '@ant-design/icons'
import { useAppStore } from '@/stores/appStore'
import type { Series, Study, PrintJob } from '@/types'
import dayjs from 'dayjs'

const { Title, Text, Paragraph } = Typography
const { Option } = Select

const layoutPresets = [
  { name: '1×1 (单幅大片)', rows: 1, cols: 1, film: '14×17"' },
  { name: '2×2 (四宫格)', rows: 2, cols: 2, film: '14×17"' },
  { name: '3×3 (九宫格)', rows: 3, cols: 3, film: '14×17"' },
  { name: '4×4 (十六格)', rows: 4, cols: 4, film: '14×17"' },
  { name: '2×3', rows: 2, cols: 3, film: '11×14"' },
  { name: '3×4', rows: 3, cols: 4, film: '11×14"' },
]

const filmSizes = [
  { label: '14 × 17 英寸 (35×43cm)', value: '14x17' },
  { label: '11 × 14 英寸 (28×35cm)', value: '11x14' },
  { label: '10 × 12 英寸 (25×30cm)', value: '10x12' },
  { label: '8 × 10 英寸 (20×25cm)', value: '8x10' },
  { label: 'A4 纸', value: 'A4' },
]

const PrintWindow: React.FC = () => {
  const {
    studies,
    series,
    selectedStudyId,
    selectedSeriesIds,
    addPrintJob,
    printJobs,
    updatePrintJob,
    setSelectedStudy,
    toggleSeriesSelection,
    setActiveWindow,
  } = useAppStore()

  const [activeTab, setActiveTab] = useState<'film' | 'disc'>('film')
  const [currentStep, setCurrentStep] = useState(0)
  const [filmSize, setFilmSize] = useState('14x17')
  const [layoutIdx, setLayoutIdx] = useState(1)
  const [copies, setCopies] = useState(1)
  const [showAnnotations, setShowAnnotations] = useState(true)
  const [showPatientInfo, setShowPatientInfo] = useState(true)
  const [showScale, setShowScale] = useState(false)
  const [colorMode, setColorMode] = useState<'grayscale' | 'color'>('grayscale')
  const [printer, setPrinter] = useState('干式激光打印机-01')
  const [paperOrientation, setPaperOrientation] = useState<'portrait' | 'landscape'>('landscape')
  const [selectedDiscType, setSelectedDiscType] = useState<'DVD' | 'CD' | 'BD'>('DVD')
  const [includeViewer, setIncludeViewer] = useState(true)
  const [includeReport, setIncludeReport] = useState(true)
  const [compressionLevel, setCompressionLevel] = useState('lossless')
  const [customLabel, setCustomLabel] = useState('')
  const [previewViewport, setPreviewViewport] = useState<number>(0)

  const study: Study | undefined = studies.find((s) => s.id === selectedStudyId) || studies[0]
  const studySeries: Series[] = study ? series.filter((s) => s.studyId === study.id) : []
  const layout = layoutPresets[layoutIdx]

  if (!study) {
    return (
      <div className="window-content">
        <div className="empty-state">
          <div className="empty-state-icon">
            <PrinterOutlined />
          </div>
          <div style={{ fontSize: 16, marginBottom: 8 }}>请先在工作列表中选择检查</div>
          <Button type="primary" size="large" onClick={() => setActiveWindow('worklist')}>
            打开工作列表
          </Button>
        </div>
      </div>
    )
  }

  const selectedSeriesData = studySeries.filter((s) => selectedSeriesIds.includes(s.id))
  const totalCells = layout.rows * layout.cols
  const filmCount = Math.ceil(Math.max(1, selectedSeriesData.length) / totalCells)
  const totalPrints = filmCount * copies

  const totalImageSizeMB = selectedSeriesData.reduce(
    (s, ser) => s + (ser.rows * ser.columns * ser.bitsAllocated * ser.imageCount) / (1024 * 1024 * 8),
    0
  )
  const discCapacity = selectedDiscType === 'CD' ? 700 : selectedDiscType === 'DVD' ? 4700 : 25000
  const needMultipleDiscs = totalImageSizeMB > discCapacity

  const handleCreateJob = (type: 'film' | 'disc') => {
    if (selectedSeriesData.length === 0) {
      message.error('请至少选择一个序列')
      return
    }
    addPrintJob({
      studyId: study.id,
      type,
      layout: { rows: layout.rows, columns: layout.cols },
      seriesIds: selectedSeriesIds,
      annotations: showAnnotations,
      patientInfo: showPatientInfo,
      copies,
    })
    message.success(
      type === 'film'
        ? `✅ 已添加 ${totalPrints} 张胶片到打印队列，开始自动处理`
        : `✅ 已创建光盘刻录任务，开始自动处理`
    )
  }

  // 渲染任务列表（分类型）
  const renderJobList = (list: PrintJob[], label: string) => {
    if (list.length === 0) {
      return (
        <Empty
          description={`暂无${label === 'film' ? '胶片打印' : label === 'disc' ? '光盘刻录' : ''}任务`}
          image={Empty.PRESENTED_IMAGE_SIMPLE}
          style={{ padding: '16px 0' }}
        />
      )
    }
    return list.map((job, idx) => {
      const statusMeta = {
        queued: { label: '排队中', color: 'default', icon: '⏳' },
        printing: { label: job.type === 'film' ? '打印中' : '刻录中', color: 'processing', icon: '⚡' },
        completed: { label: '完成', color: 'green', icon: '✅' },
        failed: { label: '失败', color: 'red', icon: '❌' },
      }[job.status]
      return (
        <div
          key={job.id}
          style={{
            padding: 10,
            marginBottom: 8,
            border: '1px solid #303030',
            borderRadius: 6,
            background: job.status === 'completed' ? '#0f1f14' : job.status === 'failed' ? '#1f1010' : '#1a1a1a',
            fontSize: 12,
            position: 'relative',
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <Space size={6}>
              <span>
                {job.type === 'film' ? <PictureOutlined /> : <SafetyCertificateOutlined />}
              </span>
              <span style={{ fontWeight: 500 }}>
                {statusMeta.icon} {job.type === 'film' ? '胶片打印' : '光盘刻录'} #{list.length - idx}
              </span>
              {job.type === 'film' && job.copies > 1 && (
                <Tag color="geekblue" style={{ margin: 0, fontSize: 10 }}>
                  {job.copies}份
                </Tag>
              )}
            </Space>
            <Tag color={statusMeta.color} style={{ margin: 0 }}>
              {statusMeta.label}
            </Tag>
          </div>
          {(job.status === 'printing' || job.status === 'queued') && (
            <Progress
              percent={job.progress || 0}
              size="small"
              style={{ marginTop: 8 }}
              status={job.status === 'printing' ? 'active' : 'normal'}
              showInfo
              strokeColor={job.status === 'printing' ? '#1890ff' : undefined}
            />
          )}
          <div style={{ marginTop: 6, color: '#707070', fontSize: 11, display: 'flex', justifyContent: 'space-between' }}>
            <span>创建: {job.createdAt}</span>
            <span>{job.completedAt ? `完成: ${job.completedAt}` : `序列数: ${job.seriesIds?.length || 0}`}</span>
          </div>
          {job.errorMessage && (
            <div style={{ marginTop: 4, color: '#ff4d4f', fontSize: 11 }}>错误: {job.errorMessage}</div>
          )}
        </div>
      )
    })
  }

  return (
    <div className="window-content">
      {/* Header */}
      <div
        style={{
          padding: '12px 24px',
          borderBottom: '1px solid #303030',
          background: '#141414',
          display: 'flex',
          alignItems: 'center',
          gap: 16,
        }}
      >
        <Space>
          <Avatar size={48} icon={<UserOutlined />} style={{ background: '#1890ff' }} />
          <div>
            <div style={{ fontSize: 15, fontWeight: 600 }}>{study.patient.name}</div>
            <div style={{ fontSize: 12, color: '#a0a0a0' }}>
              {study.patient.gender} · {study.patient.age}岁 · {study.patient.patientId}
            </div>
            <div style={{ fontSize: 12, color: '#707070' }}>
              {study.modality} · {study.studyDescription} · {study.accessionNumber}
            </div>
          </div>
        </Space>
        <div style={{ flex: 1 }} />
        <Radio.Group value={activeTab === 'film' ? 'film' : 'disc'} onChange={(e) => {
          setActiveTab(e.target.value)
          setCurrentStep(0)
        }} buttonStyle="solid" size="large">
          <Radio.Button value="film">
            <PictureOutlined /> 胶片打印
          </Radio.Button>
          <Radio.Button value="disc">
            <SafetyCertificateOutlined /> 光盘刻录
          </Radio.Button>
        </Radio.Group>
      </div>

      <div style={{ flex: 1, display: 'flex', overflow: 'hidden' }}>
        {/* Left: Series Selector */}
        <div
          style={{
            width: 280,
            borderRight: '1px solid #303030',
            background: '#141414',
            overflow: 'auto',
            flexShrink: 0,
          }}
        >
          <div className="panel-section">
            <div className="panel-title">
              选择序列
              <Tag style={{ marginLeft: 8 }}>{selectedSeriesData.length}/{studySeries.length}</Tag>
            </div>
            {studySeries.length === 0 ? (
              <Empty description="无序列" image={Empty.PRESENTED_IMAGE_SIMPLE} />
            ) : (
              studySeries.map((ser, idx) => {
                const isSelected = selectedSeriesIds.includes(ser.id)
                return (
                  <div
                    key={ser.id}
                    onClick={() => toggleSeriesSelection(ser.id)}
                    style={{
                      padding: 10,
                      marginBottom: 6,
                      borderRadius: 6,
                      cursor: 'pointer',
                      border: isSelected ? '1px solid #1890ff' : '1px solid #303030',
                      background: isSelected ? 'rgba(24,144,255,0.08)' : '#1a1a1a',
                      display: 'flex',
                      gap: 10,
                    }}
                  >
                    <Checkbox checked={isSelected} onClick={(e) => e.stopPropagation()} />
                    <div
                      style={{
                        width: 48,
                        height: 48,
                        borderRadius: 4,
                        background: `linear-gradient(135deg, hsl(${(idx * 50) % 360}, 30%, 20%) 0%, hsl(${(idx * 50 + 40) % 360}, 20%, 10%) 100%)`,
                        flexShrink: 0,
                        border: '1px solid #2a2a2a',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        fontSize: 16,
                        fontWeight: 700,
                        color: 'rgba(255,255,255,0.3)',
                      }}
                    >
                      {idx + 1}
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontWeight: 500, fontSize: 12, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                        {ser.seriesDescription}
                      </div>
                      <div style={{ fontSize: 11, color: '#707070', marginTop: 4 }}>
                        {ser.modality} · {ser.imageCount}幅
                      </div>
                      <div style={{ fontSize: 11, color: '#505050', marginTop: 2 }}>
                        {ser.rows}×{ser.columns} · {ser.thickness || 1}mm
                      </div>
                    </div>
                  </div>
                )
              })
            )}
            <div style={{ marginTop: 12 }}>
              <Space>
                <Button size="small" onClick={() => studySeries.forEach((s) => {
                  if (!selectedSeriesIds.includes(s.id)) toggleSeriesSelection(s.id)
                })}>
                  全选
                </Button>
                <Button size="small" onClick={() => {
                  [...selectedSeriesIds].forEach((id) => toggleSeriesSelection(id))
                }}>
                  清除
                </Button>
              </Space>
            </div>
          </div>

          <div className="panel-section">
            <div className="panel-title">
              <PrinterOutlined /> 打印 / 刻录 队列
              <Tag color="blue" style={{ marginLeft: 8 }}>{printJobs.length}</Tag>
            </div>
            {printJobs.length === 0 ? (
              <Empty description="暂无任务" image={Empty.PRESENTED_IMAGE_SIMPLE} style={{ padding: '16px 0' }} />
            ) : (
              <Tabs
                size="small"
                defaultActiveKey="all"
                style={{ marginTop: -4 }}
                items={[
                  {
                    key: 'all',
                    label: `全部 (${printJobs.length})`,
                    children: renderJobList(printJobs, 'all'),
                  },
                  {
                    key: 'film',
                    label: `胶片 (${printJobs.filter((j) => j.type === 'film').length})`,
                    children: renderJobList(printJobs.filter((j) => j.type === 'film'), 'film'),
                  },
                  {
                    key: 'disc',
                    label: `光盘 (${printJobs.filter((j) => j.type === 'disc').length})`,
                    children: renderJobList(printJobs.filter((j) => j.type === 'disc'), 'disc'),
                  },
                ]}
              />
            )}
          </div>
        </div>

        {/* Center: Steps & Options */}
        <div
          style={{
            flex: 1,
            overflow: 'auto',
            padding: 20,
          }}
        >
          <Steps
            size="small"
            current={currentStep}
            style={{ marginBottom: 24, maxWidth: 600, marginLeft: 'auto', marginRight: 'auto' }}
            items={
              activeTab === 'film'
                ? [{ title: '选择序列' }, { title: '设置参数' }, { title: '预览确认' }, { title: '完成输出' }]
                : [{ title: '选择内容' }, { title: '光盘设置' }, { title: '预览刻录' }, { title: '完成刻录' }]
            }
          />

          {/* Tab: Film */}
          {activeTab === 'film' && (
            <div>
              <Row gutter={16}>
                <Col span={12}>
                  <Card
                    size="small"
                    title={<span><SettingOutlined /> 胶片参数</span>}
                    style={{ marginBottom: 16 }}
                  >
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                      <div>
                        <Text type="secondary" style={{ fontSize: 12 }}>胶片规格</Text>
                        <Select
                          style={{ width: '100%', marginTop: 6 }}
                          value={filmSize}
                          onChange={setFilmSize}
                          options={filmSizes}
                        />
                      </div>
                      <div>
                        <Text type="secondary" style={{ fontSize: 12 }}>打印方向</Text>
                        <Radio.Group
                          style={{ marginTop: 6, width: '100%' }}
                          value={paperOrientation}
                          onChange={(e) => setPaperOrientation(e.target.value)}
                        >
                          <Radio.Button value="landscape" style={{ width: '50%', textAlign: 'center' }}>横向</Radio.Button>
                          <Radio.Button value="portrait" style={{ width: '50%', textAlign: 'center' }}>纵向</Radio.Button>
                        </Radio.Group>
                      </div>
                      <div>
                        <Text type="secondary" style={{ fontSize: 12 }}>
                          布局 <Tag color="blue">{layout.rows}×{layout.cols}</Tag>
                          <span style={{ color: '#707070', marginLeft: 8, fontSize: 11 }}>{layout.film}</span>
                        </Text>
                        <div style={{ marginTop: 6, display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 6 }}>
                          {layoutPresets.map((lp, idx) => (
                            <div
                              key={lp.name}
                              onClick={() => setLayoutIdx(idx)}
                              style={{
                                padding: 8,
                                border: layoutIdx === idx ? '1px solid #1890ff' : '1px solid #303030',
                                borderRadius: 6,
                                cursor: 'pointer',
                                background: layoutIdx === idx ? 'rgba(24,144,255,0.08)' : '#1a1a1a',
                                textAlign: 'center',
                              }}
                            >
                              <div
                                style={{
                                  display: 'grid',
                                  gridTemplateRows: `repeat(${lp.rows}, 10px)`,
                                  gridTemplateColumns: `repeat(${lp.cols}, 10px)`,
                                  gap: 2,
                                  margin: '0 auto 4px',
                                  width: 'fit-content',
                                }}
                              >
                                {Array.from({ length: lp.rows * lp.cols }).map((_, i) => (
                                  <div key={i} style={{ background: layoutIdx === idx ? '#1890ff' : '#303030', borderRadius: 1 }} />
                                ))}
                              </div>
                              <div style={{ fontSize: 10, color: '#a0a0a0' }}>{lp.rows}×{lp.cols}</div>
                            </div>
                          ))}
                        </div>
                      </div>
                      <div>
                        <Text type="secondary" style={{ fontSize: 12 }}>
                          输出色彩
                        </Text>
                        <Radio.Group
                          style={{ marginTop: 6, width: '100%' }}
                          value={colorMode}
                          onChange={(e) => setColorMode(e.target.value)}
                        >
                          <Radio.Button value="grayscale" style={{ width: '50%', textAlign: 'center' }}>灰度</Radio.Button>
                          <Radio.Button value="color" style={{ width: '50%', textAlign: 'center' }}>彩色</Radio.Button>
                        </Radio.Group>
                      </div>
                      <div>
                        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
                          <Text type="secondary" style={{ fontSize: 12 }}>打印份数</Text>
                          <span style={{ color: '#1890ff', fontWeight: 600 }}>{copies} 份</span>
                        </div>
                        <InputNumber
                          min={1}
                          max={20}
                          value={copies}
                          onChange={(v) => setCopies(v || 1)}
                          style={{ width: '100%' }}
                          addonBefore="份"
                        />
                      </div>
                      <div>
                        <Text type="secondary" style={{ fontSize: 12 }}>目标打印机</Text>
                        <Select
                          style={{ width: '100%', marginTop: 6 }}
                          value={printer}
                          onChange={setPrinter}
                          options={[
                            { value: '干式激光打印机-01', label: '干式激光打印机-01 (在线)' },
                            { value: '干式激光打印机-02', label: '干式激光打印机-02 (在线)' },
                            { value: '热敏胶片打印机', label: '热敏胶片打印机 (空闲)' },
                          ]}
                        />
                      </div>
                    </div>
                  </Card>
                </Col>

                <Col span={12}>
                  <Card
                    size="small"
                    title={<span><EyeOutlined /> 显示选项</span>}
                    style={{ marginBottom: 16 }}
                  >
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <span>显示患者信息</span>
                        <Switch checked={showPatientInfo} onChange={setShowPatientInfo} />
                      </div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <span>显示测量标注</span>
                        <Switch checked={showAnnotations} onChange={setShowAnnotations} />
                      </div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <span>显示比例尺</span>
                        <Switch checked={showScale} onChange={setShowScale} />
                      </div>
                      <Divider style={{ margin: '8px 0' }} />
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <span>胶片自动分割</span>
                        <Switch defaultChecked />
                      </div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <span>关键图像优先</span>
                        <Switch defaultChecked />
                      </div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <span>显示窗宽窗位</span>
                        <Switch defaultChecked />
                      </div>
                    </div>
                  </Card>

                  <Card
                    size="small"
                    title={<span><SaveOutlined /> 输出摘要</span>}
                    style={{ marginBottom: 16 }}
                    styles={{ body: { padding: 12 } }}
                  >
                    <List
                      size="small"
                      dataSource={[
                        { label: '患者', value: study.patient.name },
                        { label: '检查号', value: study.accessionNumber },
                        { label: '序列数', value: `${selectedSeriesData.length} / ${studySeries.length}` },
                        { label: '总图像数', value: selectedSeriesData.reduce((s, v) => s + v.imageCount, 0) },
                        { label: '布局', value: `${layout.rows}×${layout.cols}` },
                        { label: '胶片数', value: `${filmCount} × ${copies} = ${totalPrints} 张` },
                        { label: '胶片规格', value: filmSize },
                        { label: '预计用量', value: `${totalPrints * 0.15} m²` },
                      ]}
                      renderItem={(item) => (
                        <List.Item style={{ padding: '4px 0', borderBottom: 'none', fontSize: 12 }}>
                          <Text type="secondary">{item.label}</Text>
                          <span style={{ fontWeight: 500 }}>{item.value}</span>
                        </List.Item>
                      )}
                    />
                  </Card>
                </Col>
              </Row>

              {/* Preview */}
              <Card
                size="small"
                title={
                  <Space>
                    <FileImageOutlined />
                    <span>胶片预览</span>
                    <Tag color="blue" style={{ marginLeft: 8 }}>
                      第 {Math.min(previewViewport + 1, filmCount)} / {filmCount} 张
                    </Tag>
                    <Button.Group size="small" style={{ marginLeft: 12 }}>
                      <Button disabled={previewViewport === 0} onClick={() => setPreviewViewport(previewViewport - 1)}>
                        上一张
                      </Button>
                      <Button
                        disabled={previewViewport >= filmCount - 1}
                        onClick={() => setPreviewViewport(previewViewport + 1)}
                      >
                        下一张
                      </Button>
                    </Button.Group>
                  </Space>
                }
              >
                <div
                  className="print-preview"
                  style={{
                    position: 'relative',
                    aspectRatio: paperOrientation === 'landscape' ? '17/14' : '14/17',
                    maxWidth: paperOrientation === 'landscape' ? 800 : 500,
                    margin: '0 auto',
                  }}
                >
                  <div
                    style={{
                      position: 'absolute',
                      top: 0,
                      left: 0,
                      right: 0,
                      bottom: 0,
                      border: '2px dashed #303030',
                      borderRadius: 8,
                      padding: showPatientInfo ? 36 : 8,
                      background: '#0a0a0a',
                    }}
                  >
                    {showPatientInfo && (
                      <div
                        style={{
                          position: 'absolute',
                          top: 10,
                          left: 14,
                          right: 14,
                          display: 'flex',
                          justifyContent: 'space-between',
                          fontSize: 10,
                          color: '#c0c0c0',
                          fontFamily: 'Consolas, monospace',
                          borderBottom: '1px solid #303030',
                          paddingBottom: 6,
                        }}
                      >
                        <div>
                          {study.patient.name} | {study.patient.gender} | {study.patient.age}岁
                        </div>
                        <div>{study.patient.patientId}</div>
                        <div>{study.accessionNumber} | {study.studyDate}</div>
                      </div>
                    )}
                    <div
                      style={{
                        display: 'grid',
                        gridTemplateRows: `repeat(${layout.rows}, 1fr)`,
                        gridTemplateColumns: `repeat(${layout.cols}, 1fr)`,
                        gap: 4,
                        height: '100%',
                        padding: showPatientInfo ? '24px 0 24px' : 0,
                      }}
                    >
                      {Array.from({ length: totalCells }).map((_, idx) => {
                        const actualIdx = previewViewport * totalCells + idx
                        const ser = selectedSeriesData[actualIdx % Math.max(selectedSeriesData.length, 1)]
                        const seed = idx + previewViewport * 7
                        return (
                          <div
                            key={idx}
                            style={{
                              background: `radial-gradient(ellipse at center, hsl(${(seed * 35) % 360}, 25%, 18%) 0%, #050505 80%)`,
                              border: '1px solid #202020',
                              borderRadius: 2,
                              position: 'relative',
                              overflow: 'hidden',
                            }}
                          >
                            {ser && (
                              <>
                                <div
                                  style={{
                                    position: 'absolute',
                                    inset: 0,
                                    background: `radial-gradient(ellipse at 40% 50%, hsla(${(seed * 50 + 180) % 360}, 30%, 35%, 0.25) 0%, transparent 70%)`,
                                  }}
                                />
                                {showScale && (
                                  <div
                                    style={{
                                      position: 'absolute',
                                      left: 8,
                                      bottom: 6,
                                      width: 40,
                                      borderBottom: '2px solid #4a4a4a',
                                      fontSize: 8,
                                      color: '#808080',
                                      paddingBottom: 2,
                                    }}
                                  >
                                    5cm
                                  </div>
                                )}
                                <div
                                  style={{
                                    position: 'absolute',
                                    top: 4,
                                    right: 6,
                                    fontSize: 9,
                                    color: '#7cb342',
                                    fontFamily: 'Consolas, monospace',
                                  }}
                                >
                                  #{idx + 1}
                                </div>
                              </>
                            )}
                          </div>
                        )
                      })}
                    </div>
                    {showPatientInfo && (
                      <div
                        style={{
                          position: 'absolute',
                          bottom: 10,
                          left: 14,
                          right: 14,
                          display: 'flex',
                          justifyContent: 'space-between',
                          fontSize: 10,
                          color: '#c0c0c0',
                          fontFamily: 'Consolas, monospace',
                          borderTop: '1px solid #303030',
                          paddingTop: 6,
                        }}
                      >
                        <div>{study.modality} {study.studyDescription}</div>
                        <div>医院 PACS 工作站</div>
                        <div>{dayjs().format('YYYY-MM-DD HH:mm')}</div>
                      </div>
                    )}
                  </div>
                </div>
              </Card>
            </div>
          )}

          {/* Tab: Disc */}
          {activeTab === 'disc' && (
            <div>
              <Row gutter={16}>
                <Col span={12}>
                  <Card
                    size="small"
                    title={<span><SafetyCertificateOutlined /> 光盘参数</span>}
                    style={{ marginBottom: 16 }}
                  >
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                      <div>
                        <Text type="secondary" style={{ fontSize: 12 }}>光盘类型</Text>
                        <div style={{ marginTop: 6, display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 6 }}>
                          {(['CD', 'DVD', 'BD'] as const).map((t) => {
                            const cap = t === 'CD' ? '700MB' : t === 'DVD' ? '4.7GB' : '25GB'
                            return (
                              <div
                                key={t}
                                onClick={() => setSelectedDiscType(t)}
                                style={{
                                  padding: 10,
                                  border: selectedDiscType === t ? '1px solid #1890ff' : '1px solid #303030',
                                  borderRadius: 6,
                                  cursor: 'pointer',
                                  background: selectedDiscType === t ? 'rgba(24,144,255,0.08)' : '#1a1a1a',
                                  textAlign: 'center',
                                }}
                              >
                                <div style={{ fontSize: 16, fontWeight: 600 }}>{t}</div>
                                <div style={{ fontSize: 11, color: '#707070', marginTop: 2 }}>{cap}</div>
                              </div>
                            )
                          })}
                        </div>
                      </div>
                      <div>
                        <Text type="secondary" style={{ fontSize: 12 }}>
                          光盘自定义标签
                        </Text>
                        <div style={{ marginTop: 6, position: 'relative' }}>
                          <div
                            style={{
                              height: 60,
                              borderRadius: 30,
                              background: 'linear-gradient(135deg, #1e3a5f 0%, #0f1a2e 50%, #1a2f4f 100%)',
                              border: '1px solid #303030',
                              position: 'relative',
                              overflow: 'hidden',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                            }}
                          >
                            <div
                              style={{
                                position: 'absolute',
                                width: 20,
                                height: 20,
                                borderRadius: '50%',
                                background: '#0a0a0a',
                                border: '1px solid #404040',
                              }}
                            />
                            <div
                              style={{
                                color: 'rgba(255,255,255,0.5)',
                                fontFamily: 'Consolas, monospace',
                                fontSize: 10,
                                position: 'absolute',
                                top: 10,
                                left: 36,
                                right: 36,
                                textAlign: 'center',
                                whiteSpace: 'nowrap',
                                overflow: 'hidden',
                                textOverflow: 'ellipsis',
                              }}
                            >
                              {customLabel || `${study.patient.name}_${study.accessionNumber}`}
                            </div>
                            <div
                              style={{
                                color: 'rgba(255,255,255,0.3)',
                                fontSize: 9,
                                position: 'absolute',
                                bottom: 8,
                                left: 36,
                                right: 36,
                                textAlign: 'center',
                              }}
                            >
                              {study.modality} · {dayjs(study.studyDate).format('YYYY-MM-DD')}
                            </div>
                            <div
                              style={{
                                position: 'absolute',
                                inset: 0,
                                background: 'repeating-conic-gradient(from 0deg, rgba(255,255,255,0.02) 0deg 2deg, transparent 2deg 4deg)',
                              }}
                            />
                          </div>
                        </div>
                        <div style={{ marginTop: 6 }}>
                          <Input
                            style={{ width: '100%' }}
                            placeholder="自定义标签文字..."
                            value={customLabel}
                            onChange={(e) => setCustomLabel(e.target.value)}
                          />
                        </div>
                      </div>
                      <div>
                        <Text type="secondary" style={{ fontSize: 12 }}>
                          压缩方式
                        </Text>
                        <Radio.Group
                          style={{ marginTop: 6, width: '100%' }}
                          value={compressionLevel}
                          onChange={(e) => setCompressionLevel(e.target.value)}
                        >
                          <Radio.Button value="lossless" style={{ width: '33%', textAlign: 'center' }}>无损</Radio.Button>
                          <Radio.Button value="low" style={{ width: '34%', textAlign: 'center' }}>低压缩</Radio.Button>
                          <Radio.Button value="high" style={{ width: '33%', textAlign: 'center' }}>高压缩</Radio.Button>
                        </Radio.Group>
                      </div>
                    </div>
                  </Card>
                </Col>

                <Col span={12}>
                  <Card
                    size="small"
                    title={<span><FolderOpenOutlined /> 刻录内容</span>}
                    style={{ marginBottom: 16 }}
                  >
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <Space>
                          <FileZipOutlined />
                          <span>DICOM 原始影像</span>
                          <Tag color="purple">标准</Tag>
                        </Space>
                        <Text type="secondary">{totalImageSizeMB.toFixed(1)} MB</Text>
                      </div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <Space>
                          <PictureOutlined />
                          <span>包含图像浏览器</span>
                        </Space>
                        <Switch checked={includeViewer} onChange={setIncludeViewer} />
                      </div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <Space>
                          <FileTextOutlined />
                          <span>包含诊断报告(PDF)</span>
                        </Space>
                        <Switch checked={includeReport} onChange={setIncludeReport} />
                      </div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <Space>
                          <DownloadOutlined />
                          <span>包含 JPEG 导出</span>
                        </Space>
                        <Switch defaultChecked />
                      </div>

                      <Divider style={{ margin: '8px 0' }} />

                      <div>
                        <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                          <Text type="secondary" style={{ fontSize: 12 }}>容量估算</Text>
                          <Text type={needMultipleDiscs ? 'danger' : 'success'} style={{ fontSize: 12 }}>
                            {totalImageSizeMB.toFixed(1)} / {discCapacity} MB
                          </Text>
                        </div>
                        <Progress
                          percent={Math.min(100, (totalImageSizeMB / discCapacity) * 100)}
                          status={needMultipleDiscs ? 'exception' : undefined}
                          style={{ marginTop: 6 }}
                        />
                        {needMultipleDiscs && (
                          <div style={{ marginTop: 4, fontSize: 11, color: '#ff7875' }}>
                            容量不足，需要 {Math.ceil(totalImageSizeMB / discCapacity)} 张光盘
                          </div>
                        )}
                      </div>
                    </div>
                  </Card>

                  <Card
                    size="small"
                    title={<span><SaveOutlined /> 光盘目录</span>}
                    style={{ marginBottom: 16 }}
                  >
                    <div
                      style={{
                        background: '#0e1a2a',
                        border: '1px solid #1a3a5a',
                        borderRadius: 6,
                        padding: 12,
                        fontFamily: 'Consolas, monospace',
                        fontSize: 12,
                        color: '#b0c0d0',
                      }}
                    >
                      <div style={{ color: '#1890ff', marginBottom: 6 }}>
                        📀 {customLabel || `${study.accessionNumber}`}
                      </div>
                      <div style={{ paddingLeft: 16, lineHeight: 1.9 }}>
                        <div>├── 📁 DICOM/</div>
                        {selectedSeriesData.map((s, i) => (
                          <div key={s.id} style={{ paddingLeft: 16 }}>
                            │   ├── 📂 SERIES_{String(i + 1).padStart(3, '0')}_{s.modality}/
                            <span style={{ color: '#707070', marginLeft: 8 }}>
                              ({s.imageCount} images)
                            </span>
                          </div>
                        ))}
                        <div>├── 📁 REPORT/</div>
                        {includeReport && (
                          <div style={{ paddingLeft: 16 }}>
                            │   └── 📄 {study.accessionNumber}_Report.pdf
                          </div>
                        )}
                        {includeViewer && (
                          <>
                            <div>├── 📁 VIEWER/</div>
                            <div style={{ paddingLeft: 16 }}>│   ├── 📄 index.html (DICOM Viewer)</div>
                          </>
                        )}
                        <div>├── 📁 JPEG/</div>
                        <div>└── 📄 README.txt</div>
                      </div>
                    </div>
                  </Card>
                </Col>
              </Row>
            </div>
          )}
        </div>
      </div>

      {/* Footer */}
      <div
        style={{
          padding: '12px 24px',
          borderTop: '1px solid #303030',
          background: '#141414',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
        }}
      >
        <Space>
          <Button onClick={() => setCurrentStep(Math.max(0, currentStep - 1))} disabled={currentStep === 0}>
            上一步
          </Button>
          {currentStep < 3 && (
            <Button type="primary" onClick={() => setCurrentStep(Math.min(3, currentStep + 1))}>
              下一步
            </Button>
          )}
        </Space>
        <Space>
          <Button icon={<SaveOutlined />}>保存设置</Button>
          <Button icon={<EyeOutlined />}>全屏预览</Button>
          {currentStep === 3 ? (
            <Button
              type="primary"
              icon={activeTab === 'film' ? <PrinterOutlined /> : <SafetyCertificateOutlined />}
              size="large"
              style={{ background: activeTab === 'film' ? '#1890ff' : '#52c41a', borderColor: activeTab === 'film' ? '#1890ff' : '#52c41a' }}
              onClick={() => handleCreateJob(activeTab)}
            >
              {activeTab === 'film'
                ? `打印胶片 (${totalPrints}张)`
                : '开始刻录'}
            </Button>
          ) : null}
        </Space>
      </div>
    </div>
  )
}

export default PrintWindow
