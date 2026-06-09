import React, { useState, useMemo, useEffect } from 'react'
import type { StepsProps } from 'antd'
import {
  Button,
  Card,
  Typography,
  Space,
  Divider,
  Tag,
  Select,
  Input,
  Modal,
  message,
  Steps,
  Rate,
  Tooltip,
  List,
  Avatar,
  Empty,
} from 'antd'
import {
  FileTextOutlined,
  SaveOutlined,
  SendOutlined,
  PrinterOutlined,
  HistoryOutlined,
  CheckCircleOutlined,
  CloseCircleOutlined,
  ExclamationCircleOutlined,
  ClockCircleOutlined,
  UserOutlined,
  CalendarOutlined,
  CopyOutlined,
} from '@ant-design/icons'
import { useAppStore } from '@/stores/appStore'
import type { ReportTemplate, Study } from '@/types'
import dayjs from 'dayjs'

const { Title, Text, Paragraph } = Typography
const { TextArea } = Input

const ReportWindow: React.FC = () => {
  const {
    currentReport,
    studies,
    reportTemplates,
    createReport,
    setCurrentReport,
    updateReport,
    submitReport,
    approveReport,
    rejectReport,
    selectedStudyId,
    setActiveWindow,
  } = useAppStore()

  const [selectedTemplateId, setSelectedTemplateId] = useState<string>('')
  const [showApplyConfirm, setShowApplyConfirm] = useState(false)
  const [reviewNote, setReviewNote] = useState('')
  const [showReviewModal, setShowReviewModal] = useState<'approve' | 'reject' | null>(null)

  // 当选中检查变化时，自动加载/创建对应报告，保证进入同一检查能看到之前的报告
  useEffect(() => {
    if (!selectedStudyId) return
    if (currentReport && currentReport.studyId === selectedStudyId) return
    createReport(selectedStudyId)
  }, [selectedStudyId, currentReport?.studyId])

  const study: Study | undefined = studies.find((s) => s.id === currentReport?.studyId || selectedStudyId)
  const patient = study?.patient

  const selectedTemplate = reportTemplates.find((t) => t.id === selectedTemplateId)

  const statusSteps: StepsProps['items'] = [
    { title: '草稿', status: currentReport?.status === 'draft' ? 'process' : currentReport && ['submitted', 'reviewing', 'approved', 'rejected'].includes(currentReport.status) ? 'finish' : 'wait' },
    { title: '已提交', status: currentReport && ['submitted', 'reviewing', 'approved', 'rejected'].includes(currentReport.status) ? (currentReport.status === 'submitted' ? 'process' : 'finish') : 'wait' },
    { title: '审核中', status: currentReport && ['reviewing', 'approved', 'rejected'].includes(currentReport.status) ? (currentReport.status === 'reviewing' ? 'process' : 'finish') : 'wait' },
    { title: currentReport?.status === 'rejected' ? '已退回' : '已审核', status: currentReport && ['approved', 'rejected'].includes(currentReport.status) ? (currentReport.status === 'rejected' ? 'error' : 'finish') : 'wait' },
  ]

  const applyTemplate = (template: ReportTemplate) => {
    if ((currentReport?.findings || currentReport?.conclusion) && !showApplyConfirm) {
      setSelectedTemplateId(template.id)
      setShowApplyConfirm(true)
      return
    }
    updateReport({
      templateId: template.id,
      findings: template.content,
      conclusion: template.conclusion,
    })
    setSelectedTemplateId(template.id)
    setShowApplyConfirm(false)
    message.success(`已应用模板: ${template.name}`)
  }

  const handleSubmit = () => {
    if (!currentReport?.findings?.trim() || !currentReport?.conclusion?.trim()) {
      message.error('请填写影像所见和诊断结论后再提交')
      return
    }
    submitReport()
    message.success('报告已提交审核')
  }

  const handleReviewAction = (action: 'approve' | 'reject') => {
    if (!currentReport) return
    if (action === 'approve') {
      approveReport(currentReport.id)
      message.success('✅ 报告已审核通过，工作列表状态已同步')
    } else {
      if (!reviewNote.trim()) {
        message.error('请填写退回原因')
        return
      }
      rejectReport(currentReport.id, reviewNote)
      message.warning('⚠️ 报告已退回，工作列表状态已同步为"退回"')
    }
    setShowReviewModal(null)
    setReviewNote('')
  }

  const saveDraft = async () => {
    try {
      const api = (window as any).electronAPI
      const content = `
========================================
         PACS 影像诊断报告
========================================

【患者信息】
姓名: ${patient?.name || '-'}
性别: ${patient?.gender || '-'}
年龄: ${patient?.age || '-'}岁
患者ID: ${patient?.patientId || '-'}

【检查信息】
检查号: ${study?.accessionNumber || '-'}
检查类型: ${study?.modality || '-'}
检查描述: ${study?.studyDescription || '-'}
检查时间: ${study?.studyDate || '-'} ${study?.studyTime || '-'}

【报告状态】
状态: ${currentReport?.status || '草稿'}
报告医生: ${currentReport?.reportingDoctor || '-'}
创建时间: ${currentReport?.createdAt || '-'}

========================================
              影像所见
========================================
${currentReport?.findings || '（未填写）'}

========================================
              诊断结论
========================================
${currentReport?.conclusion || '（未填写）'}
========================================
      `
      if (api) {
        const result = await api.saveReport({
          content,
          fileName: `report_${study?.accessionNumber || Date.now()}.txt`,
        })
        if (result.success) {
          message.success(`报告已保存到: ${result.path}`)
        }
      } else {
        const blob = new Blob([content], { type: 'text/plain;charset=utf-8' })
        const url = URL.createObjectURL(blob)
        const a = document.createElement('a')
        a.href = url
        a.download = `report_${study?.accessionNumber || Date.now()}.txt`
        a.click()
        URL.revokeObjectURL(url)
        message.success('报告已下载')
      }
    } catch (e) {
      message.error('保存失败')
    }
  }

  const templatesByCategory = useMemo(() => {
    const map: Record<string, ReportTemplate[]> = {}
    reportTemplates.forEach((t) => {
      if (!map[t.category]) map[t.category] = []
      map[t.category].push(t)
    })
    return map
  }, [reportTemplates])

  if (!study) {
    return (
      <div className="window-content">
        <div className="empty-state">
          <div className="empty-state-icon">
            <FileTextOutlined />
          </div>
          <div style={{ fontSize: 16, marginBottom: 8 }}>请先选择一个检查以编写报告</div>
          <div style={{ color: '#707070', marginBottom: 20 }}>
            在工作列表中选择检查后，点击"写报告"按钮
          </div>
          <Space>
            <Button type="primary" size="large" onClick={() => setActiveWindow('worklist')}>
              打开工作列表
            </Button>
            {selectedStudyId && (
              <Button size="large" onClick={() => createReport(selectedStudyId)}>
                为当前检查创建报告
              </Button>
            )}
          </Space>
        </div>
      </div>
    )
  }

  return (
    <div className="window-content" style={{ display: 'flex', flexDirection: 'row' }}>
      {/* Left: Templates */}
      <div
        style={{
          width: 280,
          borderRight: '1px solid #303030',
          background: '#141414',
          overflow: 'auto',
          padding: 16,
          flexShrink: 0,
        }}
      >
        <div className="panel-title">报告模板库</div>
        {Object.entries(templatesByCategory).map(([cat, tpls]) => (
          <div key={cat} style={{ marginBottom: 20 }}>
            <Tag color="blue" style={{ marginBottom: 8 }}>
              {cat}
            </Tag>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              {tpls.map((tpl) => (
                <div
                  key={tpl.id}
                  className={`template-card ${
                    selectedTemplateId === tpl.id || currentReport?.templateId === tpl.id
                      ? 'selected'
                      : ''
                  }`}
                  onClick={() => applyTemplate(tpl)}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span style={{ fontWeight: 500, fontSize: 13 }}>{tpl.name}</span>
                    <Tooltip title="应用此模板">
                      <CopyOutlined style={{ color: '#707070', fontSize: 12 }} />
                    </Tooltip>
                  </div>
                  <div
                    style={{
                      fontSize: 11,
                      color: '#707070',
                      marginTop: 4,
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      display: '-webkit-box',
                      WebkitLineClamp: 2,
                      WebkitBoxOrient: 'vertical',
                    }}
                  >
                    {tpl.conclusion}
                  </div>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>

      {/* Center: Patient Info + Report Editor */}
      <div
        style={{
          flex: 1,
          overflow: 'auto',
          display: 'flex',
          flexDirection: 'column',
        }}
      >
        {/* Patient & Study header */}
        <div
          style={{
            padding: '16px 24px',
            borderBottom: '1px solid #303030',
            background: '#141414',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 20 }}>
            <Avatar size={56} icon={<UserOutlined />} style={{ background: '#1890ff' }} />
            <div style={{ flex: 1 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                <span style={{ fontSize: 18, fontWeight: 600 }}>{patient?.name}</span>
                <Tag>
                  {patient?.gender} · {patient?.age}岁
                </Tag>
                <Tag color="purple">
                  {patient?.patientId}
                </Tag>
                {currentReport && (
                  <Tag
                    color={
                      currentReport.status === 'approved'
                        ? 'green'
                        : currentReport.status === 'rejected'
                        ? 'red'
                        : currentReport.status === 'reviewing'
                        ? 'orange'
                        : currentReport.status === 'submitted'
                        ? 'blue'
                        : 'default'
                    }
                  >
                    {currentReport.status === 'draft'
                      ? '草稿'
                      : currentReport.status === 'submitted'
                      ? '已提交'
                      : currentReport.status === 'reviewing'
                      ? '审核中'
                      : currentReport.status === 'approved'
                      ? '已审核'
                      : '已退回'}
                  </Tag>
                )}
              </div>
              <div style={{ marginTop: 8, color: '#a0a0a0', fontSize: 13, display: 'flex', gap: 24 }}>
                <span>
                  <CalendarOutlined /> 检查: {study?.modality} {study?.studyDescription}
                </span>
                <span>
                  检查号: {study?.accessionNumber}
                </span>
                <span>
                  申请医生: {study?.referringPhysician || '-'}
                </span>
              </div>
            </div>
            <Space>
              <Button icon={<PrinterOutlined />} onClick={() => setActiveWindow('print')}>
                打印胶片
              </Button>
              <Button icon={<FileTextOutlined />} onClick={() => setActiveWindow('viewer')}>
                返回阅片
              </Button>
            </Space>
          </div>

          {currentReport && (
            <div style={{ marginTop: 16 }}>
              <Steps
                current={
                  currentReport.status === 'approved' || currentReport.status === 'rejected'
                    ? 3
                    : currentReport.status === 'reviewing'
                    ? 2
                    : currentReport.status === 'submitted'
                    ? 1
                    : 0
                }
                size="small"
                status={currentReport.status === 'rejected' ? 'error' : undefined}
                items={statusSteps}
              />
            </div>
          )}
        </div>

        {/* Toolbar */}
        <div className="toolbar-group" style={{ padding: '8px 24px' }}>
          <Space>
            <Select
              placeholder="选择模板"
              style={{ width: 220 }}
              value={selectedTemplateId || undefined}
              onChange={(v) => {
                const tpl = reportTemplates.find((t) => t.id === v)
                if (tpl) applyTemplate(tpl)
              }}
              options={reportTemplates.map((t) => ({ value: t.id, label: t.name }))}
              allowClear
            />
            <Button
              icon={<HistoryOutlined />}
              onClick={() => {
                if (currentReport?.createdAt) {
                  message.info('此报告创建于: ' + currentReport.createdAt)
                }
              }}
            >
              历史版本
            </Button>
          </Space>
          <div style={{ flex: 1 }} />
          <Space>
            <Button icon={<SaveOutlined />} onClick={saveDraft}>
              导出报告
            </Button>
            <Button icon={<SaveOutlined />} type="primary" ghost onClick={() => message.info('草稿已自动保存')}>
              保存草稿
            </Button>
            {currentReport?.status === 'draft' && (
              <Button type="primary" icon={<SendOutlined />} onClick={handleSubmit}>
                提交审核
              </Button>
            )}
            {currentReport?.status === 'submitted' && (
              <Space>
                <Button
                  icon={<CheckCircleOutlined />}
                  type="primary"
                  onClick={() => setShowReviewModal('approve')}
                  style={{ background: '#52c41a', borderColor: '#52c41a' }}
                >
                  审核通过
                </Button>
                <Button
                  danger
                  icon={<CloseCircleOutlined />}
                  onClick={() => setShowReviewModal('reject')}
                >
                  退回修改
                </Button>
              </Space>
            )}
          </Space>
        </div>

        {/* Editor */}
        <div className="report-editor" style={{ flex: 1 }}>
          <Card
            size="small"
            title={
              <Space>
                <FileTextOutlined />
                <span>影像所见</span>
                <Text type="secondary" style={{ fontSize: 12 }}>
                  (必填)
                </Text>
              </Space>
            }
            style={{ flex: 1, display: 'flex', flexDirection: 'column' }}
            bodyStyle={{ flex: 1, display: 'flex', flexDirection: 'column' }}
            extra={
              <Text type="secondary" style={{ fontSize: 12 }}>
                {currentReport?.findings?.length || 0} 字
              </Text>
            }
          >
            <TextArea
              className="report-textarea"
              style={{ flex: 1, minHeight: 280 }}
              placeholder="请详细描述影像所见..."
              value={currentReport?.findings || ''}
              onChange={(e) => updateReport({ findings: e.target.value })}
              disabled={currentReport?.status === 'approved'}
            />
          </Card>

          <Card
            size="small"
            title={
              <Space>
                <ExclamationCircleOutlined style={{ color: '#1890ff' }} />
                <span>诊断结论</span>
                <Text type="secondary" style={{ fontSize: 12 }}>
                  (必填)
                </Text>
              </Space>
            }
            bodyStyle={{ display: 'flex', flexDirection: 'column' }}
            extra={
              <Space>
                <Text type="secondary" style={{ fontSize: 12 }}>
                  诊断信心:
                </Text>
                <Rate allowHalf count={5} defaultValue={4} />
              </Space>
            }
          >
            <TextArea
              className="report-textarea"
              style={{ minHeight: 140 }}
              placeholder="请给出诊断结论..."
              value={currentReport?.conclusion || ''}
              onChange={(e) => updateReport({ conclusion: e.target.value })}
              disabled={currentReport?.status === 'approved'}
            />
          </Card>

          <Card
            size="small"
            title={
              <Space>
                <CheckCircleOutlined />
                <span>报告签名</span>
              </Space>
            }
          >
            <div style={{ display: 'flex', gap: 32 }}>
              <div>
                <Text type="secondary">报告医生</Text>
                <div style={{ marginTop: 4, fontWeight: 500 }}>
                  {currentReport?.reportingDoctor || '当前医生'}
                </div>
                <Text type="secondary" style={{ fontSize: 12 }}>
                  {currentReport?.createdAt || dayjs().format('YYYY-MM-DD HH:mm:ss')}
                </Text>
              </div>
              <div>
                <Text type="secondary">审核医生</Text>
                <div style={{ marginTop: 4, fontWeight: 500 }}>
                  {currentReport?.reviewingDoctor || '-'}
                </div>
                <Text type="secondary" style={{ fontSize: 12 }}>
                  {currentReport?.approvedAt || (currentReport?.status === 'approved' ? dayjs().format('YYYY-MM-DD HH:mm:ss') : '-')}
                </Text>
              </div>
              <div style={{ flex: 1 }}>
                <Text type="secondary">科室</Text>
                <div style={{ marginTop: 4, fontWeight: 500 }}>放射科</div>
                <div style={{ marginTop: 8 }}>
                  <Tag color="green">
                    <ClockCircleOutlined /> 报告时效符合规定
                  </Tag>
                </div>
              </div>
            </div>
          </Card>
        </div>
      </div>

      {/* Right: Quick snippets + similar cases */}
      <div
        style={{
          width: 260,
          borderLeft: '1px solid #303030',
          background: '#141414',
          overflow: 'auto',
          padding: 16,
          flexShrink: 0,
        }}
      >
        <div className="panel-title">常用短语</div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginBottom: 20 }}>
          {[
            '未见明显异常',
            '建议复查',
            '建议进一步检查',
            '结合临床',
            '随访观察',
            '考虑炎症性病变',
            '未见明确占位性病变',
            '建议增强扫描',
          ].map((phrase, idx) => (
            <Tag
              key={idx}
              style={{
                cursor: 'pointer',
                padding: '4px 10px',
                borderRadius: 4,
              }}
              onClick={() => {
                const current = currentReport?.findings || ''
                updateReport({
                  findings: current + (current.endsWith('\n') || current === '' ? '' : '\n') + phrase + '。',
                })
              }}
            >
              {phrase}
            </Tag>
          ))}
        </div>

        <Divider style={{ margin: '16px 0' }} />

        <div className="panel-title">相似病例参考</div>
        {[
          { id: 1, title: '类似胸部CT平扫病例', match: 87 },
          { id: 2, title: '肺部结节鉴别诊断', match: 74 },
          { id: 3, title: '纵隔窗分析报告', match: 69 },
        ].map((item) => (
          <Card
            key={item.id}
            size="small"
            style={{ marginBottom: 8, background: 'transparent', border: '1px solid #303030' }}
            hoverable
          >
            <div style={{ fontSize: 12 }}>{item.title}</div>
            <div
              style={{
                marginTop: 4,
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
              }}
            >
              <Text type="secondary" style={{ fontSize: 11 }}>
                匹配度
              </Text>
              <Tag color={item.match > 80 ? 'green' : item.match > 70 ? 'blue' : 'default'}>
                {item.match}%
              </Tag>
            </div>
          </Card>
        ))}
      </div>

      <Modal
        title={showApplyConfirm ? '确认应用模板' : ''}
        open={showApplyConfirm}
        onOk={() => {
          if (selectedTemplate) applyTemplate(selectedTemplate)
        }}
        onCancel={() => {
          setShowApplyConfirm(false)
          setSelectedTemplateId('')
        }}
        okText="确认覆盖"
        okButtonProps={{ danger: true }}
      >
        <div>
          <ExclamationCircleOutlined style={{ color: '#faad14', fontSize: 20, marginRight: 8 }} />
          当前已有报告内容，应用模板将覆盖现有的影像所见和结论。是否继续？
        </div>
      </Modal>

      <Modal
        title={showReviewModal === 'approve' ? '审核通过确认' : '退回报告'}
        open={!!showReviewModal}
        onOk={() => handleReviewAction(showReviewModal as 'approve' | 'reject')}
        onCancel={() => setShowReviewModal(null)}
        okText={showReviewModal === 'approve' ? '确认通过' : '确认退回'}
        okButtonProps={showReviewModal === 'approve' ? { style: { background: '#52c41a', borderColor: '#52c41a' } } : { danger: true }}
      >
        {showReviewModal === 'approve' ? (
          <div>确认审核通过此报告？审核通过后报告将不可修改。</div>
        ) : (
          <div>
            <div style={{ marginBottom: 12 }}>请填写退回原因：</div>
            <TextArea
              rows={4}
              placeholder="请输入退回修改的原因..."
              value={reviewNote}
              onChange={(e) => setReviewNote(e.target.value)}
            />
          </div>
        )}
      </Modal>
    </div>
  )
}

export default ReportWindow
