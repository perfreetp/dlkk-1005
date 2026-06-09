import React, { useState, useRef, useCallback, useEffect } from 'react'
import {
  Button,
  Select,
  Space,
  Tooltip,
  Dropdown,
  Slider,
  Switch,
  Typography,
  Divider,
  Badge,
  Modal,
  Input,
  Popconfirm,
  message,
} from 'antd'
import {
  PictureOutlined,
  SyncOutlined,
  AimOutlined,
  ReloadOutlined,
  ZoomInOutlined,
  ZoomOutOutlined,
  ExperimentOutlined,
  ColumnHeightOutlined,
  RotateRightOutlined,
  SwapLeftOutlined,
  SwapOutlined,
  BarChartOutlined,
  EyeOutlined,
  FullscreenOutlined,
  BgColorsOutlined,
  ClearOutlined,
  MenuUnfoldOutlined,
  LineOutlined,
  NodeIndexOutlined,
  BorderOutlined,
  ScissorOutlined,
  FontSizeOutlined,
  ArrowUpOutlined,
  DeleteOutlined,
} from '@ant-design/icons'
import { useAppStore } from '@/stores/appStore'
import { defaultLayouts } from '@/data/mockData'
import type {
  Annotation,
  AnnotationTool,
  ViewportState,
  LayoutPreset,
  Series,
  Study,
} from '@/types'
import Viewport from './Viewport'

const { Text } = Typography

const toolConfig: { key: AnnotationTool; label: string; icon: React.ReactNode }[] = [
  { key: 'none', label: '浏览', icon: <EyeOutlined /> },
  { key: 'length', label: '长度', icon: <LineOutlined /> },
  { key: 'angle', label: '角度', icon: <NodeIndexOutlined /> },
  { key: 'area', label: '面积', icon: <BorderOutlined /> },
  { key: 'arrow', label: '箭头', icon: <ArrowUpOutlined /> },
  { key: 'text', label: '文字', icon: <FontSizeOutlined /> },
  { key: 'rectangle', label: '矩形', icon: <ScissorOutlined /> },
  { key: 'ellipse', label: '椭圆', icon: <ExperimentOutlined /> },
]

const windowPresets = [
  { name: '肺窗', width: 1500, center: -600 },
  { name: '纵隔窗', width: 350, center: 40 },
  { name: '骨窗', width: 2000, center: 500 },
  { name: '脑窗', width: 80, center: 40 },
  { name: '腹部窗', width: 400, center: 40 },
  { name: '软组织窗', width: 400, center: 50 },
]

const ViewerWindow: React.FC = () => {
  const {
    selectedStudyId,
    studies,
    series,
    currentLayout,
    setCurrentLayout,
    viewports,
    activeViewportId,
    setActiveViewport,
    updateViewport,
    resetViewport,
    resetAllViewports,
    syncScroll,
    setSyncScroll,
    assignSeriesToViewport,
    currentTool,
    setCurrentTool,
    annotations,
    addAnnotation,
    updateAnnotation,
    deleteAnnotation,
    clearAnnotations,
    setActiveWindow,
    createReport,
  } = useAppStore()

  const study: Study | undefined = studies.find((s) => s.id === selectedStudyId)
  const studySeries: Series[] = series.filter((s) => s.studyId === selectedStudyId)
  const activeVp: ViewportState | undefined = viewports.find((v) => v.id === activeViewportId)

  const [showLayoutPicker, setShowLayoutPicker] = useState(false)
  const [showWindowPicker, setShowWindowPicker] = useState(false)
  const [textInput, setTextInput] = useState('')
  const [showTextDialog, setShowTextDialog] = useState(false)
  const [pendingTextPos, setPendingTextPos] = useState<{ x: number; y: number; vpId: string } | null>(null)
  const [resetDrawingsCounter, setResetDrawingsCounter] = useState(0)

  const gridStyle: React.CSSProperties = {
    gridTemplateRows: `repeat(${currentLayout.rows}, 1fr)`,
    gridTemplateColumns: `repeat(${currentLayout.columns}, 1fr)`,
  }

  const handleLayoutChange = (layout: LayoutPreset) => {
    setCurrentLayout(layout)
    setShowLayoutPicker(false)
  }

  const applyWindowPreset = (preset: { width: number; center: number }) => {
    if (!activeViewportId) return
    updateViewport(activeViewportId, {
      windowWidth: preset.width,
      windowCenter: preset.center,
    })
  }

  const handleToolbarAction = useCallback(
    (action: string) => {
      if (!activeViewportId) return
      switch (action) {
        case 'zoom-in':
          updateViewport(activeViewportId, { zoom: (activeVp?.zoom || 1) * 1.25 })
          break
        case 'zoom-out':
          updateViewport(activeViewportId, { zoom: Math.max(0.1, (activeVp?.zoom || 1) / 1.25) })
          break
        case 'reset':
          resetViewport(activeViewportId)
          break
        case 'reset-all':
          resetAllViewports()
          break
        case 'invert':
          updateViewport(activeViewportId, { inverted: !activeVp?.inverted })
          break
        case 'rotate':
          updateViewport(activeViewportId, { rotation: ((activeVp?.rotation || 0) + 90) % 360 })
          break
        case 'flip-h':
          updateViewport(activeViewportId, { flippedH: !activeVp?.flippedH })
          break
        case 'flip-v':
          updateViewport(activeViewportId, { flippedV: !activeVp?.flippedV })
          break
        case 'magnifier':
          updateViewport(activeViewportId, { magEnabled: !activeVp?.magEnabled })
          break
      }
    },
    [activeViewportId, activeVp, updateViewport, resetViewport, resetAllViewports]
  )

  const handleWindowChange = (type: 'width' | 'center', value: number) => {
    if (!activeViewportId) return
    updateViewport(activeViewportId, {
      [type === 'width' ? 'windowWidth' : 'windowCenter']: value,
    })
  }

  const addTextAnnotation = (text: string) => {
    if (!pendingTextPos) return
    const newAnn: Annotation = {
      id: `ann_${Date.now()}`,
      tool: 'text',
      points: [pendingTextPos],
      text,
      color: '#ffeb3b',
      thickness: 2,
      fontSize: 16,
      viewportId: pendingTextPos.vpId,
      seriesId: viewports.find((v) => v.id === pendingTextPos.vpId)?.seriesId || '',
      imageId: String(viewports.find((v) => v.id === pendingTextPos.vpId)?.imageIndex || 0),
    }
    addAnnotation(newAnn)
    setShowTextDialog(false)
    setPendingTextPos(null)
    setTextInput('')
  }

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.target && (e.target as HTMLElement).tagName === 'INPUT') return
      switch (e.key.toLowerCase()) {
        case 'l':
          setCurrentTool('length')
          break
        case 'a':
          if (e.ctrlKey) return
          setCurrentTool('angle')
          break
        case 'm':
          setCurrentTool('area')
          break
        case 't':
          setCurrentTool('text')
          break
        case 'r':
          if (e.ctrlKey) return
          if (e.shiftKey) {
            handleToolbarAction('rotate')
          } else {
            setCurrentTool('arrow')
          }
          break
        case 'i':
          handleToolbarAction('invert')
          break
        case 'z':
          handleToolbarAction('magnifier')
          break
        case 's':
          setSyncScroll(!syncScroll)
          break
        case 'escape':
          setCurrentTool('none')
          setResetDrawingsCounter((c) => c + 1)
          break
        case 'f':
          handleToolbarAction('reset-all')
          break
        case '1':
        case '2':
        case '3':
        case '4':
          const idx = parseInt(e.key) - 1
          if (idx < studySeries.length && activeViewportId) {
            assignSeriesToViewport(activeViewportId, studySeries[idx].id)
          }
          break
        case 'ArrowUp':
        case 'ArrowLeft':
          e.preventDefault()
          if (activeViewportId) {
            updateViewport(activeViewportId, {
              imageIndex: Math.max(0, (activeVp?.imageIndex || 0) - 1),
            })
          }
          break
        case 'ArrowDown':
        case 'ArrowRight':
          e.preventDefault()
          if (activeViewportId) {
            updateViewport(activeViewportId, {
              imageIndex: Math.min(200, (activeVp?.imageIndex || 0) + 1),
            })
          }
          break
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [activeViewportId, activeVp, studySeries, syncScroll])

  if (!study) {
    return (
      <div className="window-content">
        <div className="empty-state">
          <div className="empty-state-icon">
            <PictureOutlined />
          </div>
          <div style={{ fontSize: 16, marginBottom: 12 }}>请先在工作列表中选择一个检查</div>
          <Button type="primary" size="large" onClick={() => setActiveWindow('worklist')}>
            打开工作列表
          </Button>
        </div>
      </div>
    )
  }

  return (
    <div className="window-content">
      {/* Top Toolbar */}
      <div className="toolbar-group" style={{ flexWrap: 'nowrap', overflowX: 'auto' }}>
        <Space size={2} wrap>
          <Dropdown
            trigger={['click']}
            open={showLayoutPicker}
            onOpenChange={setShowLayoutPicker}
            dropdownRender={() => (
              <div
                style={{
                  background: '#1f1f1f',
                  border: '1px solid #303030',
                  borderRadius: 8,
                  padding: 12,
                  width: 280,
                  boxShadow: '0 8px 32px rgba(0,0,0,0.5)',
                }}
              >
                <div style={{ marginBottom: 8, fontWeight: 600, fontSize: 12, color: '#a0a0a0' }}>选择布局</div>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8 }}>
                  {defaultLayouts.map((l) => (
                    <div
                      key={l.id}
                      onClick={() => handleLayoutChange(l)}
                      style={{
                        padding: 8,
                        border: currentLayout.id === l.id ? '1px solid #1890ff' : '1px solid #303030',
                        borderRadius: 6,
                        cursor: 'pointer',
                        background: currentLayout.id === l.id ? 'rgba(24,144,255,0.1)' : '#141414',
                        textAlign: 'center',
                      }}
                    >
                      <div
                        style={{
                          display: 'grid',
                          gridTemplateRows: `repeat(${l.rows}, 8px)`,
                          gridTemplateColumns: `repeat(${l.columns}, 8px)`,
                          gap: 2,
                          width: 'fit-content',
                          margin: '0 auto 6px',
                        }}
                      >
                        {l.viewports.map((_, i) => (
                          <div key={i} style={{ background: '#1890ff', opacity: 0.6, borderRadius: 1 }} />
                        ))}
                      </div>
                      <div style={{ fontSize: 11, color: '#a0a0a0' }}>{l.name}</div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          >
            <Button className="toolbar-btn" icon={<MenuUnfoldOutlined />}>
              布局 {currentLayout.rows}×{currentLayout.columns}
            </Button>
          </Dropdown>
          <Button
            className={`toolbar-btn ${syncScroll ? 'active' : ''}`}
            icon={<SyncOutlined />}
            onClick={() => setSyncScroll(!syncScroll)}
          >
            同步
          </Button>
          <Divider type="vertical" style={{ margin: '0 4px' }} />
          <Tooltip title="放大"><Button className="toolbar-btn" icon={<ZoomInOutlined />} onClick={() => handleToolbarAction('zoom-in')} /></Tooltip>
          <Tooltip title="缩小"><Button className="toolbar-btn" icon={<ZoomOutOutlined />} onClick={() => handleToolbarAction('zoom-out')} /></Tooltip>
          <Tooltip title="重置当前"><Button className="toolbar-btn" icon={<ReloadOutlined />} onClick={() => handleToolbarAction('reset')} /></Tooltip>
          <Tooltip title="重置全部"><Button className="toolbar-btn" icon={<AimOutlined />} onClick={() => handleToolbarAction('reset-all')} /></Tooltip>
          <Divider type="vertical" style={{ margin: '0 4px' }} />
          <Tooltip title="反色 (I)"><Button className={`toolbar-btn ${activeVp?.inverted ? 'active' : ''}`} icon={<BgColorsOutlined />} onClick={() => handleToolbarAction('invert')} /></Tooltip>
          <Tooltip title="旋转90° (R)"><Button className="toolbar-btn" icon={<RotateRightOutlined />} onClick={() => handleToolbarAction('rotate')} /></Tooltip>
          <Tooltip title="水平翻转"><Button className={`toolbar-btn ${activeVp?.flippedH ? 'active' : ''}`} icon={<SwapLeftOutlined />} onClick={() => handleToolbarAction('flip-h')} /></Tooltip>
          <Tooltip title="垂直翻转"><Button className={`toolbar-btn ${activeVp?.flippedV ? 'active' : ''}`} icon={<SwapOutlined />} onClick={() => handleToolbarAction('flip-v')} /></Tooltip>
          <Tooltip title="放大镜 (Z)"><Button className={`toolbar-btn ${activeVp?.magEnabled ? 'active' : ''}`} icon={<FullscreenOutlined />} onClick={() => handleToolbarAction('magnifier')} /></Tooltip>
          <Divider type="vertical" style={{ margin: '0 4px' }} />
          <Popconfirm
            title="确认清除所有标注？"
            description="所有视口中的长度、角度、面积等测量结果将一并清除，无法恢复。"
            okText="清除"
            cancelText="取消"
            placement="bottom"
            onConfirm={() => {
              clearAnnotations()
              setResetDrawingsCounter((c) => c + 1)
              message.success('已清除全部标注')
            }}
          >
            <Tooltip title="清除全部标注">
              <Button className="toolbar-btn" danger icon={<DeleteOutlined />} disabled={annotations.length === 0}>
                清除标注 ({annotations.length})
              </Button>
            </Tooltip>
          </Popconfirm>
        </Space>

        <div style={{ flex: 1 }} />

        <Space size={4} wrap>
          <Dropdown
            trigger={['click']}
            open={showWindowPicker}
            onOpenChange={setShowWindowPicker}
            dropdownRender={() => (
              <div
                style={{
                  background: '#1f1f1f',
                  border: '1px solid #303030',
                  borderRadius: 8,
                  padding: 12,
                  width: 300,
                  boxShadow: '0 8px 32px rgba(0,0,0,0.5)',
                }}
              >
                <div style={{ fontWeight: 600, marginBottom: 12, color: '#a0a0a0', fontSize: 12 }}>窗宽窗位预设</div>
                <div style={{ display: 'grid', gap: 6, marginBottom: 16 }}>
                  {windowPresets.map((p) => (
                    <div
                      key={p.name}
                      onClick={() => applyWindowPreset(p)}
                      style={{
                        padding: '6px 12px',
                        borderRadius: 4,
                        cursor: 'pointer',
                        display: 'flex',
                        justifyContent: 'space-between',
                        fontSize: 12,
                        background: '#141414',
                        border: '1px solid #303030',
                      }}
                      onMouseEnter={(e) => (e.currentTarget.style.borderColor = '#1890ff')}
                      onMouseLeave={(e) => (e.currentTarget.style.borderColor = '#303030')}
                    >
                      <span>{p.name}</span>
                      <span style={{ color: '#707070' }}>W:{p.width} / L:{p.center}</span>
                    </div>
                  ))}
                </div>
                <Divider style={{ margin: '8px 0' }} />
                <div style={{ padding: '4px 0' }}>
                  <div style={{ fontSize: 11, color: '#707070', marginBottom: 4 }}>
                    窗宽: {activeVp?.windowWidth || 0}
                  </div>
                  <Slider
                    min={1}
                    max={4000}
                    value={activeVp?.windowWidth || 0}
                    onChange={(v) => handleWindowChange('width', v)}
                  />
                  <div style={{ fontSize: 11, color: '#707070', marginTop: 8, marginBottom: 4 }}>
                    窗位: {activeVp?.windowCenter || 0}
                  </div>
                  <Slider
                    min={-2000}
                    max={2000}
                    value={activeVp?.windowCenter || 0}
                    onChange={(v) => handleWindowChange('center', v)}
                  />
                </div>
              </div>
            )}
          >
            <Button className="toolbar-btn" icon={<ColumnHeightOutlined />}>
              WW/WL
            </Button>
          </Dropdown>

          <Button
            type="primary"
            icon={<BarChartOutlined />}
            onClick={() => {
              createReport(study.id)
            }}
            style={{ background: '#1890ff' }}
          >
            写报告
          </Button>
        </Space>
      </div>

      <div className="toolbar-group">
        <Space size={2} wrap>
          <Text type="secondary" style={{ fontSize: 12, marginRight: 8 }}>工具：</Text>
          {toolConfig.map((t) => (
            <Tooltip key={t.key} title={t.label}>
              <Button
                className={`toolbar-btn ${currentTool === t.key ? 'active' : ''}`}
                icon={t.icon}
                onClick={() => setCurrentTool(t.key)}
              >
                {t.label}
              </Button>
            </Tooltip>
          ))}
          <Divider type="vertical" style={{ margin: '0 4px' }} />
          <Button
            className="toolbar-btn"
            icon={<ClearOutlined />}
            onClick={() => clearAnnotations(activeViewportId || undefined)}
            danger
          >
            清除标注
          </Button>
        </Space>
        <div style={{ flex: 1 }} />
        <Space size={16}>
          <span style={{ fontSize: 12, color: '#707070' }}>
            标注: {annotations.filter((a) => a.viewportId === activeViewportId).length} 项
          </span>
        </Space>
      </div>

      {/* Main viewer area */}
      <div style={{ flex: 1, display: 'flex', overflow: 'hidden' }}>
        {/* Left: Series list */}
        <div
          style={{
            width: 220,
            background: '#141414',
            borderRight: '1px solid #303030',
            padding: 12,
            overflow: 'auto',
          }}
        >
          <div className="patient-info-card" style={{ marginBottom: 16 }}>
            <div className="patient-name">{study.patient.name}</div>
            <div className="patient-details">
              <div className="patient-detail-row">
                <span className="patient-detail-label">ID:</span>
                <span>{study.patient.patientId}</span>
              </div>
              <div className="patient-detail-row">
                <span className="patient-detail-label">性别年龄:</span>
                <span>{study.patient.gender} · {study.patient.age}岁</span>
              </div>
              <div className="patient-detail-row">
                <span className="patient-detail-label">检查号:</span>
                <span style={{ fontFamily: 'Consolas', fontSize: 11 }}>{study.accessionNumber}</span>
              </div>
              <div className="patient-detail-row">
                <span className="patient-detail-label">类型:</span>
                <span>{study.modality} · {study.studyDescription}</span>
              </div>
              <div className="patient-detail-row">
                <span className="patient-detail-label">时间:</span>
                <span style={{ fontSize: 11 }}>{study.studyDate}</span>
              </div>
            </div>
          </div>

          <div className="panel-title">序列列表 ({studySeries.length})</div>
          {studySeries.length === 0 ? (
            <div style={{ color: '#707070', fontSize: 12, textAlign: 'center', padding: 24 }}>
              暂无序列数据
            </div>
          ) : (
            studySeries.map((ser, idx) => {
              const assigned = viewports.some((v) => v.seriesId === ser.id)
              return (
                <div
                  key={ser.id}
                  className={`series-item ${assigned ? 'selected' : ''}`}
                  onDragStart={(e) => {
                    e.dataTransfer.setData('seriesId', ser.id)
                  }}
                  draggable
                  onClick={() => {
                    if (activeViewportId) assignSeriesToViewport(activeViewportId, ser.id)
                  }}
                  title="点击分配到当前窗口 / 拖拽到任意窗口"
                >
                  <div className="series-thumb">
                    {ser.rows > 0 && (
                      <div
                        style={{
                          width: 48,
                          height: 48,
                          borderRadius: 2,
                          background: `linear-gradient(135deg, hsl(${(idx * 40) % 360}, 30%, 20%) 0%, hsl(${(idx * 40 + 60) % 360}, 20%, 12%) 100%)`,
                        }}
                      />
                    )}
                  </div>
                  <div className="series-meta">
                    <div className="series-desc">
                      <Badge count={idx + 1} size="small" style={{ marginRight: 4 }} />
                      {ser.seriesDescription}
                    </div>
                    <div className="series-info">
                      {ser.modality} · {ser.imageCount}幅 ·{' '}
                      {ser.thickness ? `${ser.thickness}mm` : '-'}
                    </div>
                  </div>
                </div>
              )
            })
          )}
        </div>

        {/* Center: Viewport grid */}
        <div className="viewer-container">
          <div className="viewport-grid" style={gridStyle}>
            {viewports.map((vp) => (
              <Viewport
                key={vp.id}
                viewport={vp}
                isActive={activeViewportId === vp.id}
                onClick={() => setActiveViewport(vp.id)}
                onAssignSeries={(sid) => assignSeriesToViewport(vp.id, sid)}
                studySeries={studySeries}
                currentTool={currentTool}
                annotations={annotations.filter((a) => a.viewportId === vp.id)}
                resetDrawingsCounter={resetDrawingsCounter}
                onAddAnnotation={(ann) => {
                  if (ann.tool === 'text' && !ann.text) {
                    setPendingTextPos({ ...ann.points[0], vpId: vp.id })
                    setShowTextDialog(true)
                  } else {
                    addAnnotation({
                      id: `ann_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
                      ...ann,
                      viewportId: vp.id,
                      seriesId: vp.seriesId || '',
                      imageId: String(vp.imageIndex),
                      color: ann.color || '#ffeb3b',
                      thickness: ann.thickness || 2,
                      fontSize: ann.fontSize || 14,
                    })
                  }
                }}
                onDeleteAnnotation={(id) => deleteAnnotation(id)}
                onUpdateAnnotation={updateAnnotation}
              />
            ))}
          </div>
        </div>

        {/* Right: Study info */}
        <div
          style={{
            width: 200,
            background: '#141414',
            borderLeft: '1px solid #303030',
            padding: 12,
            overflow: 'auto',
            fontSize: 12,
          }}
        >
          <div className="panel-title">当前窗口</div>
          {activeVp ? (
            <div style={{ padding: '0 4px' }}>
              <div className="patient-detail-row" style={{ padding: '4px 0' }}>
                <span className="patient-detail-label">窗宽:</span>
                <span>{activeVp.windowWidth}</span>
              </div>
              <div className="patient-detail-row" style={{ padding: '4px 0' }}>
                <span className="patient-detail-label">窗位:</span>
                <span>{activeVp.windowCenter}</span>
              </div>
              <div className="patient-detail-row" style={{ padding: '4px 0' }}>
                <span className="patient-detail-label">缩放:</span>
                <span>{activeVp.zoom.toFixed(2)}x</span>
              </div>
              <div className="patient-detail-row" style={{ padding: '4px 0' }}>
                <span className="patient-detail-label">旋转:</span>
                <span>{activeVp.rotation}°</span>
              </div>
              <div className="patient-detail-row" style={{ padding: '4px 0' }}>
                <span className="patient-detail-label">层号:</span>
                <span>{activeVp.imageIndex + 1}</span>
              </div>
              <div className="patient-detail-row" style={{ padding: '4px 0' }}>
                <span className="patient-detail-label">反色:</span>
                <span>{activeVp.inverted ? '是' : '否'}</span>
              </div>
              <div className="patient-detail-row" style={{ padding: '4px 0' }}>
                <span className="patient-detail-label">放大镜:</span>
                <span>{activeVp.magEnabled ? '开启' : '关闭'}</span>
              </div>
            </div>
          ) : null}

          <div className="panel-title" style={{ marginTop: 16 }}>检查统计</div>
          <div style={{ padding: '0 4px' }}>
            <div className="patient-detail-row" style={{ padding: '4px 0' }}>
              <span className="patient-detail-label">序列数:</span>
              <span>{study.seriesCount}</span>
            </div>
            <div className="patient-detail-row" style={{ padding: '4px 0' }}>
              <span className="patient-detail-label">总图像:</span>
              <span>{study.imageCount}</span>
            </div>
            <div className="patient-detail-row" style={{ padding: '4px 0' }}>
              <span className="patient-detail-label">标注数:</span>
              <span>{annotations.length}</span>
            </div>
          </div>

          <div className="panel-title" style={{ marginTop: 16 }}>快捷键</div>
          <div style={{ padding: '0 4px', fontSize: 11, color: '#707070', lineHeight: 1.8 }}>
            <div>翻页: ↑↓←→ / 滚轮</div>
            <div>窗宽窗位: 右键拖动</div>
            <div>缩放: Ctrl+滚轮</div>
            <div>测量: L/A/M/T/R</div>
            <div>反色: I · 放大镜: Z</div>
            <div>同步: S · 重置: Esc</div>
          </div>
        </div>
      </div>

      <Modal
        title="添加文字标注"
        open={showTextDialog}
        onOk={() => addTextAnnotation(textInput)}
        onCancel={() => {
          setShowTextDialog(false)
          setPendingTextPos(null)
          setCurrentTool('none')
        }}
        okText="确定"
      >
        <Input.TextArea
          rows={4}
          placeholder="请输入标注文字..."
          value={textInput}
          onChange={(e) => setTextInput(e.target.value)}
          autoFocus
        />
      </Modal>
    </div>
  )
}

export default ViewerWindow
