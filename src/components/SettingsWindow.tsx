import React, { useState } from 'react'
import {
  Card,
  Tabs,
  Input,
  Button,
  Switch,
  Select,
  Slider,
  ColorPicker,
  Space,
  Row,
  Col,
  Typography,
  Divider,
  Tag,
  Table,
  Modal,
  message,
  Radio,
  List,
  Empty,
  Tooltip,
  Popconfirm,
  Alert,
  Avatar,
  Form,
  Input as AntInput,
  App as AntApp,
} from 'antd'
import {
  SettingOutlined,
  ThunderboltOutlined,
  PictureOutlined,
  BgColorsOutlined,
  UserOutlined,
  SaveOutlined,
  ReloadOutlined,
  EditOutlined,
  DeleteOutlined,
  PlusOutlined,
  EyeOutlined,
  EyeInvisibleOutlined,
  CheckCircleOutlined,
  GlobalOutlined,
  LayoutOutlined,
} from '@ant-design/icons'
import type { TabsProps } from 'antd'
import { useAppStore } from '@/stores/appStore'
import { defaultLayouts } from '@/data/mockData'
import type { LayoutPreset, ShortcutConfig } from '@/types'

const { Title, Text, Paragraph } = Typography

const SettingsWindow: React.FC = () => {
  const {
    userSettings,
    updateUserSettings,
    resetUserSettings,
    currentLayout,
    setCurrentLayout,
    reports,
    reportVersions,
    importTasks,
    printJobs,
    clearReportVersions,
    clearImportData,
    clearPrintJobs,
    clearReports,
  } = useAppStore()
  const { message: antMessage } = AntApp.useApp()

  const [editingShortcut, setEditingShortcut] = useState<ShortcutConfig | null>(null)
  const [newKeys, setNewKeys] = useState('')
  const [showShortcutModal, setShowShortcutModal] = useState(false)
  const [capturingKeys, setCapturingKeys] = useState(false)
  const [capturedKeys, setCapturedKeys] = useState<string[]>([])
  const captureRef = React.useRef<HTMLDivElement>(null)

  const tabItems: TabsProps['items'] = [
    {
      key: 'general',
      label: <span><SettingOutlined /> 通用设置</span>,
      children: (
        <div className="settings-grid">
          <Card title="显示设置" size="small" style={{ maxWidth: 800 }}>
            <Row gutter={24}>
              <Col span={12}>
                <Form layout="vertical">
                  <Form.Item label="主题风格">
                    <Radio.Group
                      value={userSettings.theme}
                      onChange={(e) => updateUserSettings({ theme: e.target.value })}
                      buttonStyle="solid"
                      style={{ width: '100%' }}
                    >
                      <Radio.Button value="dark" style={{ width: '50%', textAlign: 'center' }}>
                        🌙 暗色
                      </Radio.Button>
                      <Radio.Button value="light" style={{ width: '50%', textAlign: 'center' }}>
                        ☀️ 亮色
                      </Radio.Button>
                    </Radio.Group>
                  </Form.Item>
                  <Form.Item label="界面语言">
                    <Select
                      value={userSettings.language}
                      onChange={(v) => updateUserSettings({ language: v })}
                      style={{ width: '100%' }}
                      options={[
                        { value: 'zh-CN', label: '简体中文' },
                        { value: 'en-US', label: 'English' },
                      ]}
                    />
                  </Form.Item>
                  <Form.Item
                    label={
                      <Space>
                        <BgColorsOutlined />
                        默认测量颜色
                      </Space>
                    }
                  >
                    <ColorPicker
                      value={userSettings.measurementColor}
                      onChange={(color) => updateUserSettings({ measurementColor: color.toHexString() })}
                      showText
                    />
                  </Form.Item>
                </Form>
              </Col>
              <Col span={12}>
                <Form layout="vertical">
                  <Form.Item
                    label={
                      <Space>
                        <LayoutOutlined />
                        默认布局
                      </Space>
                    }
                  >
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8 }}>
                      {defaultLayouts.map((l) => (
                        <div
                          key={l.id}
                          onClick={() => {
                            updateUserSettings({ defaultLayout: l })
                          }}
                          style={{
                            padding: 8,
                            border:
                              userSettings.defaultLayout.id === l.id
                                ? '1px solid #1890ff'
                                : '1px solid #303030',
                            borderRadius: 6,
                            cursor: 'pointer',
                            background:
                              userSettings.defaultLayout.id === l.id
                                ? 'rgba(24,144,255,0.08)'
                                : '#1a1a1a',
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
                              margin: '0 auto 4px',
                            }}
                          >
                            {l.viewports.map((_, i) => (
                              <div
                                key={i}
                                style={{
                                  background:
                                    userSettings.defaultLayout.id === l.id ? '#1890ff' : '#303030',
                                  borderRadius: 1,
                                }}
                              />
                            ))}
                          </div>
                          <div style={{ fontSize: 11, color: '#a0a0a0' }}>{l.name}</div>
                        </div>
                      ))}
                    </div>
                  </Form.Item>
                  <Form.Item label="阅片窗口设置">
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                        <span>多序列同步滚动</span>
                        <Switch
                          checked={userSettings.autoSync}
                          onChange={(c) => updateUserSettings({ autoSync: c })}
                        />
                      </div>
                      <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                        <span>默认工具为长度测量</span>
                        <Switch
                          checked={userSettings.defaultTool === 'length'}
                          onChange={(c) => updateUserSettings({ defaultTool: c ? 'length' : 'none' })}
                        />
                      </div>
                    </div>
                  </Form.Item>
                </Form>
              </Col>
            </Row>
          </Card>

          <Card
            title={
              <Space>
                <UserOutlined />
                用户信息
              </Space>
            }
            size="small"
            style={{ maxWidth: 800 }}
          >
            <Row gutter={24}>
              <Col span={8} style={{ textAlign: 'center', borderRight: '1px solid #303030' }}>
                <Avatar size={96} icon={<UserOutlined />} style={{ background: '#1890ff', marginBottom: 12 }} />
                <div style={{ fontSize: 15, fontWeight: 600, marginBottom: 4 }}>李医生</div>
                <Tag color="blue">主治医师</Tag>
                <div style={{ marginTop: 8, fontSize: 12, color: '#707070' }}>工号: DOC00123</div>
              </Col>
              <Col span={16}>
                <Form layout="vertical">
                  <Row gutter={12}>
                    <Col span={12}>
                      <Form.Item label="所属科室">
                        <Select
                          defaultValue="radiology"
                          options={[
                            { value: 'radiology', label: '放射科' },
                            { value: 'cardiology', label: '心内科' },
                            { value: 'neurology', label: '神经内科' },
                          ]}
                          style={{ width: '100%' }}
                        />
                      </Form.Item>
                    </Col>
                    <Col span={12}>
                      <Form.Item label="职称">
                        <Select
                          defaultValue="attending"
                          options={[
                            { value: 'intern', label: '住院医师' },
                            { value: 'residing', label: '主治医师' },
                            { value: 'chief', label: '主任医师' },
                          ]}
                          style={{ width: '100%' }}
                        />
                      </Form.Item>
                    </Col>
                    <Col span={24}>
                      <Form.Item label="联系邮箱">
                        <Input defaultValue="doctor@hospital.com" />
                      </Form.Item>
                    </Col>
                  </Row>
                </Form>
              </Col>
            </Row>
          </Card>
        </div>
      ),
    },
    {
      key: 'shortcuts',
      label: (
        <span>
          <ThunderboltOutlined /> 快捷键设置
        </span>
      ),
      children: (
        <div style={{ padding: 20, maxWidth: 1000, margin: '0 auto' }}>
          <Alert
            type="info"
            showIcon
            message="快捷键说明"
            description="点击右侧编辑按钮可修改快捷键，保存后立即生效。请避免与系统快捷键冲突。"
            style={{ marginBottom: 16 }}
          />
          <Card size="small" title={`快捷键列表 (${userSettings.shortcuts.length})`}>
            <div style={{ maxHeight: 600, overflow: 'auto' }}>
              {userSettings.shortcuts.map((sc) => (
                <div
                  key={sc.id}
                  className="shortcut-row"
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    padding: '10px 14px',
                    borderBottom: '1px solid #303030',
                  }}
                >
                  <div style={{ flex: 1 }}>
                    <div style={{ fontWeight: 500, marginBottom: 2 }}>{sc.action}</div>
                    <div style={{ fontSize: 11, color: '#707070' }}>{sc.description}</div>
                  </div>
                  <Space align="center">
                    <span className="shortcut-key" style={{ fontFamily: 'Consolas, monospace', fontSize: 12, background: '#1a1a1a', border: '1px solid #404040', padding: '2px 10px', borderRadius: 4, color: '#1890ff' }}>
                      {sc.keys}
                    </span>
                    <Tooltip title="修改">
                      <Button
                        type="link"
                        size="small"
                        icon={<EditOutlined />}
                        onClick={() => {
                          setEditingShortcut(sc)
                          setNewKeys(sc.keys)
                          setShowShortcutModal(true)
                        }}
                      />
                    </Tooltip>
                  </Space>
                </div>
              ))}
            </div>
          </Card>

          <Modal
            title={`修改快捷键: ${editingShortcut?.action}`}
            open={showShortcutModal}
            onOk={() => {
              if (!editingShortcut) return
              updateUserSettings({
                shortcuts: userSettings.shortcuts.map((s) =>
                  s.id === editingShortcut.id ? { ...s, keys: newKeys } : s
                ),
              })
              setShowShortcutModal(false)
              message.success('快捷键已更新')
            }}
            onCancel={() => {
              setShowShortcutModal(false)
              setCapturingKeys(false)
              setCapturedKeys([])
            }}
            okText="保存"
          >
            <div style={{ marginBottom: 16 }}>
              <Text type="secondary">当前快捷键：</Text>
              <Tag style={{ marginLeft: 8 }}>{editingShortcut?.keys}</Tag>
            </div>
            <div
              ref={captureRef}
              tabIndex={0}
              onClick={() => {
                setCapturingKeys(true)
                setCapturedKeys([])
                captureRef.current?.focus()
              }}
              onKeyDown={(e) => {
                if (!capturingKeys) return
                e.preventDefault()
                const keys: string[] = []
                if (e.ctrlKey) keys.push('Ctrl')
                if (e.altKey) keys.push('Alt')
                if (e.shiftKey) keys.push('Shift')
                if (e.metaKey) keys.push('Win')
                if (
                  !['Control', 'Alt', 'Shift', 'Meta'].includes(e.key) &&
                  !keys.includes(e.key)
                ) {
                  const displayKey =
                    e.key === ' '
                      ? 'Space'
                      : e.key.length === 1
                      ? e.key.toUpperCase()
                      : e.key
                  keys.push(displayKey)
                }
                setCapturedKeys(keys)
                if (e.key && !['Control', 'Alt', 'Shift', 'Meta'].includes(e.key)) {
                  setTimeout(() => {
                    setNewKeys(keys.join('+'))
                    setCapturingKeys(false)
                  }, 300)
                }
              }}
              style={{
                padding: 20,
                border: capturingKeys ? '2px dashed #1890ff' : '2px solid #303030',
                borderRadius: 8,
                background: capturingKeys ? 'rgba(24,144,255,0.05)' : '#141414',
                textAlign: 'center',
                cursor: 'pointer',
                outline: 'none',
                minHeight: 80,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              {capturingKeys ? (
                capturedKeys.length > 0 ? (
                  <div>
                    <div style={{ fontSize: 24, fontWeight: 600, color: '#1890ff' }}>
                      {capturedKeys.join(' + ')}
                    </div>
                    <div style={{ fontSize: 12, color: '#707070', marginTop: 6 }}>请松开按键...</div>
                  </div>
                ) : (
                  <div style={{ color: '#1890ff' }}>
                    <ThunderboltOutlined style={{ fontSize: 24, marginBottom: 4 }} />
                    <div>正在捕获按键组合...</div>
                    <div style={{ fontSize: 11, color: '#707070', marginTop: 4 }}>
                      按下目标按键组合
                    </div>
                  </div>
                )
              ) : newKeys ? (
                <div>
                  <div style={{ fontSize: 20, fontWeight: 600 }}>{newKeys}</div>
                  <div style={{ fontSize: 11, color: '#707070', marginTop: 6 }}>
                    点击此处重新捕获
                  </div>
                </div>
              ) : (
                <div style={{ color: '#a0a0a0' }}>
                  点击此处开始捕获按键
                </div>
              )}
            </div>
            <Alert
              style={{ marginTop: 16 }}
              type="warning"
              showIcon
              description="建议使用 Ctrl / Alt + 字母组合，避免使用单独字母键，否则会与文字输入冲突。"
            />
          </Modal>
        </div>
      ),
    },
    {
      key: 'windowing',
      label: (
        <span>
          <EyeOutlined />
          窗宽窗位预设
        </span>
      ),
      children: (
        <div style={{ padding: 20, maxWidth: 900, margin: '0 auto' }}>
          <Alert
            type="info"
            showIcon
            message="窗宽窗位预设管理"
            description="为不同检查类型设置常用的窗宽窗位预设，阅片时可一键切换。"
            style={{ marginBottom: 16 }}
          />
          <Row gutter={16}>
            <Col span={8}>
              <Card size="small" title="CT 预设" style={{ minHeight: 240 }}>
                {userSettings.windowPresets
                  .filter((p) => p.modality === 'CT')
                  .map((preset, idx) => (
                    <div
                      key={idx}
                      style={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                        padding: '8px 10px',
                        marginBottom: 6,
                        borderRadius: 4,
                        background: '#1a1a1a',
                        border: '1px solid #303030',
                      }}
                    >
                      <div>
                        <div style={{ fontWeight: 500, fontSize: 13 }}>{preset.name}</div>
                        <div style={{ fontSize: 11, color: '#707070' }}>
                          W: {preset.width} / L: {preset.center}
                        </div>
                      </div>
                      <Button type="link" size="small" icon={<EditOutlined />} />
                    </div>
                  ))}
                <Button type="dashed" style={{ width: '100%', marginTop: 8 }} icon={<PlusOutlined />}>
                  添加预设
                </Button>
              </Card>
            </Col>
            <Col span={8}>
              <Card size="small" title="MRI 预设" style={{ minHeight: 240 }}>
                {userSettings.windowPresets
                  .filter((p) => p.modality === 'MR')
                  .map((preset, idx) => (
                    <div
                      key={idx}
                      style={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                        padding: '8px 10px',
                        marginBottom: 6,
                        borderRadius: 4,
                        background: '#1a1a1a',
                        border: '1px solid #303030',
                      }}
                    >
                      <div>
                        <div style={{ fontWeight: 500, fontSize: 13 }}>{preset.name}</div>
                        <div style={{ fontSize: 11, color: '#707070' }}>
                          W: {preset.width} / L: {preset.center}
                        </div>
                      </div>
                      <Button type="link" size="small" icon={<EditOutlined />} />
                    </div>
                  ))}
                <Button type="dashed" style={{ width: '100%', marginTop: 8 }} icon={<PlusOutlined />}>
                  添加预设
                </Button>
              </Card>
            </Col>
            <Col span={8}>
              <Card size="small" title="自定义预设编辑器" style={{ minHeight: 240 }}>
                <Form layout="vertical" size="small">
                  <Form.Item label="预设名称">
                    <Input placeholder="例如：肝脏双期" />
                  </Form.Item>
                  <Form.Item label="适用于">
                    <Select
                      defaultValue="CT"
                      options={[
                        { value: 'CT', label: 'CT' },
                        { value: 'MR', label: 'MRI' },
                        { value: 'DR', label: 'DR' },
                        { value: '通用', label: '通用' },
                      ]}
                    />
                  </Form.Item>
                  <Form.Item label={`窗宽 (WW)`}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                      <Slider style={{ flex: 1 }} min={1} max={4000} defaultValue={1500} />
                      <Tag>1500</Tag>
                    </div>
                  </Form.Item>
                  <Form.Item label={`窗位 (WL)`}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                      <Slider style={{ flex: 1 }} min={-2000} max={2000} defaultValue={-500} />
                      <Tag>-500</Tag>
                    </div>
                  </Form.Item>
                  <Button
                    type="primary"
                    block
                    icon={<SaveOutlined />}
                    onClick={() => message.success('预设已保存')}
                  >
                    保存预设
                  </Button>
                </Form>
              </Card>
            </Col>
          </Row>
        </div>
      ),
    },
    {
      key: 'layout',
      label: (
        <span>
          <LayoutOutlined />
          布局管理
        </span>
      ),
      children: (
        <div style={{ padding: 20, maxWidth: 1000, margin: '0 auto' }}>
          <Card size="small" title="常用布局预设">
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 16 }}>
              {defaultLayouts.map((l) => (
                <Card
                  key={l.id}
                  size="small"
                  hoverable
                  style={{
                    border: currentLayout.id === l.id ? '1px solid #1890ff' : '1px solid #303030',
                    background: currentLayout.id === l.id ? 'rgba(24,144,255,0.05)' : '#141414',
                  }}
                  title={l.name}
                  extra={
                    currentLayout.id === l.id ? (
                      <Tag color="blue">当前使用</Tag>
                    ) : null
                  }
                >
                  <div
                    style={{
                      display: 'grid',
                      gridTemplateRows: `repeat(${l.rows}, 1fr)`,
                      gridTemplateColumns: `repeat(${l.columns}, 1fr)`,
                      gap: 3,
                      height: 120,
                      background: '#0a0a0a',
                      borderRadius: 4,
                      padding: 3,
                      marginBottom: 10,
                    }}
                  >
                    {l.viewports.map((_, i) => (
                      <div
                        key={i}
                        style={{
                          background: `linear-gradient(135deg, #1a2535 0%, #050a10 100%)`,
                          borderRadius: 2,
                          border: '1px solid #1a1a1a',
                        }}
                      />
                    ))}
                  </div>
                  <Space>
                    <Button
                      size="small"
                      type={currentLayout.id === l.id ? 'primary' : 'default'}
                      onClick={() => {
                        setCurrentLayout(l)
                        message.success(`已切换到 ${l.name}`)
                      }}
                      block
                    >
                      {currentLayout.id === l.id ? '当前' : '应用'}
                    </Button>
                    <Button size="small" icon={<EditOutlined />} />
                    <Popconfirm
                      title="确定删除此布局？"
                      onConfirm={() => message.success('已删除')}
                    >
                      <Button size="small" danger icon={<DeleteOutlined />} />
                    </Popconfirm>
                  </Space>
                </Card>
              ))}
              <Card
                size="small"
                style={{
                  border: '1px dashed #303030',
                  background: 'transparent',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
                bodyStyle={{
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  justifyContent: 'center',
                  minHeight: 160,
                  color: '#707070',
                  gap: 8,
                  cursor: 'pointer',
                }}
                onClick={() => message.info('自定义布局开发中')}
              >
                <PlusOutlined style={{ fontSize: 32 }} />
                <div>创建自定义布局</div>
              </Card>
            </div>
          </Card>
        </div>
      ),
    },
    {
      key: 'data',
      label: (
        <span>
          <DeleteOutlined />
          本机数据管理
        </span>
      ),
      children: (
        <div style={{ padding: 20, maxWidth: 900, margin: '0 auto' }}>
          <Alert
            type="warning"
            showIcon
            message="以下操作会清理本地存储的数据，删除后无法恢复，请谨慎操作"
            style={{ marginBottom: 24 }}
          />

          <Row gutter={16} style={{ marginBottom: 24 }}>
            <Col span={6}>
              <Card size="small" style={{ textAlign: 'center' }}>
                <div style={{ fontSize: 28, fontWeight: 600, color: '#1890ff' }}>
                  {reports.length}
                </div>
                <Text type="secondary" style={{ fontSize: 12 }}>报告总数</Text>
              </Card>
            </Col>
            <Col span={6}>
              <Card size="small" style={{ textAlign: 'center' }}>
                <div style={{ fontSize: 28, fontWeight: 600, color: '#52c41a' }}>
                  {reportVersions.length}
                </div>
                <Text type="secondary" style={{ fontSize: 12 }}>历史版本数</Text>
              </Card>
            </Col>
            <Col span={6}>
              <Card size="small" style={{ textAlign: 'center' }}>
                <div style={{ fontSize: 28, fontWeight: 600, color: '#722ed1' }}>
                  {importTasks.length}
                </div>
                <Text type="secondary" style={{ fontSize: 12 }}>导入任务数</Text>
              </Card>
            </Col>
            <Col span={6}>
              <Card size="small" style={{ textAlign: 'center' }}>
                <div style={{ fontSize: 28, fontWeight: 600, color: '#fa8c16' }}>
                  {printJobs.length}
                </div>
                <Text type="secondary" style={{ fontSize: 12 }}>打印任务数</Text>
              </Card>
            </Col>
          </Row>

          <Card size="small" title="清理操作">
            <List
              size="large"
              dataSource={[
                {
                  key: 'versions',
                  title: '清理历史版本',
                  desc: '删除所有报告的历史版本记录，当前报告内容不受影响',
                  btnText: '清理版本',
                  btnType: 'default' as const,
                  action: () => {
                    clearReportVersions()
                    message.success('已清理全部历史版本')
                  },
                  confirmTitle: '确认清理所有历史版本？',
                  confirmDesc: '版本记录将被永久删除，当前报告保持不变',
                },
                {
                  key: 'import',
                  title: '清理导入记录',
                  desc: '删除所有导入任务记录和分组，已导入的检查数据不受影响',
                  btnText: '清理导入',
                  btnType: 'default' as const,
                  action: () => {
                    clearImportData()
                    message.success('已清理全部导入记录')
                  },
                  confirmTitle: '确认清理所有导入记录？',
                  confirmDesc: '任务记录将被永久删除，已导入的检查数据不会被删除',
                },
                {
                  key: 'print',
                  title: '清理打印记录',
                  desc: '删除所有打印/刻录任务记录，不影响已完成的胶片和光盘',
                  btnText: '清理打印',
                  btnType: 'default' as const,
                  action: () => {
                    clearPrintJobs()
                    message.success('已清理全部打印记录')
                  },
                  confirmTitle: '确认清理所有打印记录？',
                  confirmDesc: '任务记录将被永久删除',
                },
                {
                  key: 'reports',
                  title: '清理全部报告（含版本）',
                  desc: '删除所有诊断报告及历史版本，工作列表中的检查不会被删除',
                  btnText: '清理全部报告',
                  btnType: 'danger' as const,
                  action: () => {
                    clearReports()
                    message.success('已清理全部报告及版本')
                  },
                  confirmTitle: '⚠️ 确认删除全部报告？',
                  confirmDesc: '所有诊断报告和历史版本将被永久删除，此操作无法撤销！',
                },
              ]}
              renderItem={(item) => (
                <List.Item
                  style={{ padding: '12px 0', borderBottom: '1px solid #303030' }}
                  actions={[
                    <Popconfirm
                      key={item.key}
                      title={item.confirmTitle}
                      description={item.confirmDesc}
                      okText="确认删除"
                      okButtonProps={item.btnType === 'danger' ? { danger: true } : {}}
                      cancelText="取消"
                      onConfirm={item.action}
                    >
                      <Button
                        type={item.btnType === 'danger' ? 'default' : item.btnType}
                        danger={item.btnType === 'danger'}
                        icon={<DeleteOutlined />}
                      >
                        {item.btnText}
                      </Button>
                    </Popconfirm>,
                  ]}
                >
                  <List.Item.Meta
                    avatar={
                      <Avatar
                        icon={<DeleteOutlined />}
                        style={{
                          background: item.btnType === 'danger' ? '#ff4d4f' : '#1890ff',
                        }}
                      />
                    }
                    title={item.title}
                    description={<span style={{ color: '#707070' }}>{item.desc}</span>}
                  />
                </List.Item>
              )}
            />
          </Card>
        </div>
      ),
    },
    {
      key: 'about',
      label: (
        <span>
          <GlobalOutlined />
          关于系统
        </span>
      ),
      children: (
        <div style={{ padding: 20, maxWidth: 700, margin: '0 auto' }}>
          <Card size="small" style={{ textAlign: 'center', padding: '40px 20px' }}>
            <Avatar size={80} style={{ background: 'linear-gradient(135deg, #1890ff, #0050b3)', marginBottom: 16 }}>
              <PictureOutlined style={{ fontSize: 40 }} />
            </Avatar>
            <Title level={3} style={{ margin: 0, marginBottom: 4 }}>
              PACS 阅片工作站
            </Title>
            <Tag color="blue" style={{ marginBottom: 20 }}>版本 1.0.0 (Build 20240609)</Tag>
            <Paragraph style={{ color: '#a0a0a0', maxWidth: 480, margin: '0 auto 24px' }}>
              医疗影像归档与通信系统 (Picture Archiving and Communication System) 桌面阅片工作站，
              为影像科医生提供专业的医学影像阅片、测量标注、诊断报告撰写一体化解决方案。
            </Paragraph>
          </Card>

          <Card size="small" style={{ marginTop: 16 }} title="系统组件">
            <List
              size="small"
              dataSource={[
                { name: '渲染引擎', version: 'Cornerstone.js 1.88', status: 'ok' },
                { name: 'DICOM 解析', version: 'dicom-parser 1.8', status: 'ok' },
                { name: 'UI 框架', version: 'React 18 + Ant Design 5', status: 'ok' },
                { name: '桌面容器', version: 'Electron 29', status: 'ok' },
                { name: 'PACS Server', version: 'DCM4CHEE 5.x', status: 'ok' },
                { name: '数据库', version: 'PostgreSQL 15', status: 'ok' },
                { name: 'HL7 接口', version: 'v2.5.1', status: 'ok' },
              ]}
              renderItem={(item) => (
                <List.Item>
                  <Space>
                    <CheckCircleOutlined style={{ color: '#52c41a' }} />
                    <span>{item.name}</span>
                  </Space>
                  <Tag color="blue">{item.version}</Tag>
                </List.Item>
              )}
            />
          </Card>

          <Card size="small" style={{ marginTop: 16 }} title="许可证与版权">
            <div style={{ fontSize: 12, color: '#707070', lineHeight: 1.8 }}>
              <div>© 2024 医院信息科 · 保留所有权利</div>
              <div>本软件受著作权法和国际著作权条约以及其他知识产权法和条约的保护。</div>
              <div style={{ marginTop: 8 }}>
                <Tag>MIT License</Tag>
                <Tag color="green">GPL v3</Tag>
                <Tag color="purple">BSD 3-Clause</Tag>
              </div>
            </div>
          </Card>
        </div>
      ),
    },
  ]

  return (
    <div className="window-content" style={{ overflow: 'auto' }}>
      <div
        style={{
          padding: '12px 24px',
          borderBottom: '1px solid #303030',
          background: '#141414',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
        }}
      >
        <Space>
          <Title level={4} style={{ margin: 0 }}>
            <SettingOutlined /> 个人设置
          </Title>
          <Tag color="blue">{userSettings.language === 'zh-CN' ? '简体中文' : 'English'}</Tag>
        </Space>
        <Space>
          <Button
            icon={<ReloadOutlined />}
            onClick={() => {
              Modal.confirm({
                title: '确认恢复默认设置？',
                content: '所有自定义设置（快捷键、布局、窗宽窗位预设等）将恢复为默认值。',
                okText: '确认恢复',
                okButtonProps: { danger: true },
                onOk: () => {
                  resetUserSettings()
                  message.success('已恢复默认设置')
                },
              })
            }}
          >
            恢复默认
          </Button>
          <Button
            type="primary"
            icon={<SaveOutlined />}
            onClick={() => message.success('所有设置已保存')}
          >
            保存设置
          </Button>
        </Space>
      </div>

      <div style={{ padding: '16px 24px' }}>
        <Tabs items={tabItems} size="large" />
      </div>
    </div>
  )
}

export default SettingsWindow
