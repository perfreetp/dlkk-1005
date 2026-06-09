import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type {
  Study,
  Series,
  ImageInstance,
  ImportTask,
  Annotation,
  ViewportState,
  LayoutPreset,
  ReportTemplate,
  Report,
  PrintJob,
  WindowName,
  UserSettings,
  AnnotationTool,
} from '@/types'
import {
  mockStudies,
  mockSeries,
  mockImages,
  mockImportTasks,
  mockReportTemplates,
  defaultLayouts,
  defaultUserSettings,
} from '@/data/mockData'
import dayjs from 'dayjs'

interface AppState {
  activeWindow: WindowName
  setActiveWindow: (window: WindowName) => void

  studies: Study[]
  selectedStudyId: string | null
  selectedSeriesIds: string[]
  setSelectedStudy: (studyId: string | null) => void
  toggleSeriesSelection: (seriesId: string) => void
  updateStudyStatus: (studyId: string, status: Study['status']) => void

  series: Series[]
  images: ImageInstance[]

  importTasks: ImportTask[]
  addImportTask: (task: Omit<ImportTask, 'id' | 'createdAt' | 'updatedAt'>) => void
  updateImportTask: (taskId: string, updates: Partial<ImportTask>) => void
  retryImportTask: (taskId: string) => void
  removeImportTask: (taskId: string) => void

  currentLayout: LayoutPreset
  viewports: ViewportState[]
  activeViewportId: string | null
  syncScroll: boolean
  setCurrentLayout: (layout: LayoutPreset) => void
  setActiveViewport: (id: string) => void
  updateViewport: (id: string, updates: Partial<ViewportState>) => void
  resetViewport: (id: string) => void
  resetAllViewports: () => void
  setSyncScroll: (sync: boolean) => void
  assignSeriesToViewport: (viewportId: string, seriesId: string) => void

  currentTool: AnnotationTool
  annotations: Annotation[]
  setCurrentTool: (tool: AnnotationTool) => void
  addAnnotation: (annotation: Annotation) => void
  updateAnnotation: (id: string, updates: Partial<Annotation>) => void
  deleteAnnotation: (id: string) => void
  clearAnnotations: (viewportId?: string) => void

  reportTemplates: ReportTemplate[]
  reports: Report[]
  currentReport: Report | null
  setCurrentReport: (report: Report | null) => void
  createReport: (studyId: string) => void
  updateReport: (updates: Partial<Report>) => void
  submitReport: () => void
  approveReport: (reportId: string) => void
  rejectReport: (reportId: string, reason: string) => void

  printJobs: PrintJob[]
  addPrintJob: (job: Omit<PrintJob, 'id' | 'createdAt' | 'status'>) => void
  updatePrintJob: (jobId: string, updates: Partial<PrintJob>) => void

  userSettings: UserSettings
  updateUserSettings: (settings: Partial<UserSettings>) => void
  resetUserSettings: () => void

  showShortcuts: boolean
  setShowShortcuts: (show: boolean) => void

  showImportWindow: boolean
  setShowImportWindow: (show: boolean) => void
}

export const useAppStore = create<AppState>()(
  persist(
    (set, get) => ({
      activeWindow: 'worklist',
      setActiveWindow: (window) => set({ activeWindow: window }),

      studies: mockStudies,
      selectedStudyId: null,
      selectedSeriesIds: [],
      setSelectedStudy: (studyId) => {
        const { series } = get()
        const studySeries = studyId
          ? series.filter((s) => s.studyId === studyId).map((s) => s.id)
          : []
        set({
          selectedStudyId: studyId,
          selectedSeriesIds: studySeries,
        })
      },
      toggleSeriesSelection: (seriesId) => {
        const { selectedSeriesIds } = get()
        const exists = selectedSeriesIds.includes(seriesId)
        set({
          selectedSeriesIds: exists
            ? selectedSeriesIds.filter((id) => id !== seriesId)
            : [...selectedSeriesIds, seriesId],
        })
      },
      updateStudyStatus: (studyId, status) => {
        set((state) => ({
          studies: state.studies.map((s) =>
            s.id === studyId ? { ...s, status, updatedAt: dayjs().format('YYYY-MM-DD HH:mm:ss') } : s
          ),
        }))
      },

      series: mockSeries,
      images: mockImages,

      importTasks: mockImportTasks,
      addImportTask: (task) => {
        // 尝试从文件名提取检查号（DICOM 文件常包含）
        let extractedAcc = task.accessionNumber
        if (!extractedAcc) {
          const nameMatch = task.fileName.match(/(ACC|CHK|STUDY)?[-_]?(\d{6,12})/i)
          if (nameMatch) extractedAcc = nameMatch[2]
        }
        const finalTask: ImportTask = {
          ...task,
          accessionNumber: extractedAcc || task.accessionNumber,
          id: `imp${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
          status: 'pending',
          progress: 0,
          retryCount: 0,
          maxRetries: task.maxRetries || 3,
          createdAt: dayjs().format('YYYY-MM-DD HH:mm:ss'),
          updatedAt: dayjs().format('YYYY-MM-DD HH:mm:ss'),
        }
        set((state) => ({ importTasks: [finalTask, ...state.importTasks] }))
        // 自动调度（非手动匹配模式）
        scheduleImportTask(finalTask.id, { manualMatch: false })
      },
      updateImportTask: (taskId, updates) => {
        set((state) => ({
          importTasks: state.importTasks.map((t) =>
            t.id === taskId
              ? { ...t, ...updates, updatedAt: dayjs().format('YYYY-MM-DD HH:mm:ss') }
              : t
          ),
        }))
      },
      retryImportTask: (taskId) => {
        const st = get()
        const task = st.importTasks.find((t) => t.id === taskId)
        if (!task) return
        // 重试上限控制
        if ((task.retryCount || 0) >= task.maxRetries && !task.studyId) {
          st.updateImportTask(taskId, {
            status: 'failed',
            errorMessage: `已达最大重试次数(${task.maxRetries})，请手动匹配检查号后再导入`,
          })
          return
        }
        const manual = !!task.studyId
        st.updateImportTask(taskId, {
          status: manual ? 'importing' : 'pending',
          progress: 0,
          errorMessage: undefined,
          retryCount: (task.retryCount || 0) + 1,
        })
        scheduleImportTask(taskId, { manualMatch: manual })
      },
      removeImportTask: (taskId) => {
        set((state) => ({
          importTasks: state.importTasks.filter((t) => t.id !== taskId),
        }))
      },

      currentLayout: defaultLayouts[3],
      viewports: defaultLayouts[3].viewports,
      activeViewportId: defaultLayouts[3].viewports[0]?.id || null,
      syncScroll: true,
      setCurrentLayout: (layout) => {
        const { series, selectedStudyId, selectedSeriesIds } = get()
        const studySeries = series.filter((s) => s.studyId === selectedStudyId)
        const seriesIdsToAssign = selectedSeriesIds.length > 0 ? selectedSeriesIds : studySeries.map((s) => s.id)
        
        const newViewports = layout.viewports.map((vp, idx) => {
          const series = studySeries[idx % Math.max(studySeries.length, 1)]
          return {
            ...vp,
            seriesId: seriesIdsToAssign[idx] || series?.id,
            windowWidth: series?.windowWidth || vp.windowWidth,
            windowCenter: series?.windowCenter || vp.windowCenter,
          }
        })
        set({
          currentLayout: layout,
          viewports: newViewports,
          activeViewportId: newViewports[0]?.id || null,
        })
      },
      setActiveViewport: (id) => set({ activeViewportId: id }),
      updateViewport: (id, updates) => {
        const { viewports, syncScroll, currentLayout, images } = get()
        
        if (syncScroll && updates.imageIndex !== undefined) {
          const currentIndex = viewports.find((v) => v.id === id)?.imageIndex || 0
          const delta = (updates.imageIndex ?? currentIndex) - currentIndex
          
          set((state) => ({
            viewports: state.viewports.map((vp) => {
              const seriesImages = images.filter((i) => i.seriesId === vp.seriesId)
              if (seriesImages.length === 0) return { ...vp, ...(vp.id === id ? updates : {}) }
              
              let newIndex = vp.id === id ? (updates.imageIndex ?? vp.imageIndex) : vp.imageIndex + delta
              newIndex = Math.max(0, Math.min(seriesImages.length - 1, newIndex))
              
              return {
                ...vp,
                ...(vp.id === id ? updates : {}),
                imageIndex: newIndex,
              }
            }),
          }))
        } else {
          set((state) => ({
            viewports: state.viewports.map((vp) => (vp.id === id ? { ...vp, ...updates } : vp)),
          }))
        }
      },
      resetViewport: (id) => {
        const { currentLayout } = get()
        const defaultVp = currentLayout.viewports.find((v) => v.id === id)
        if (defaultVp) {
          set((state) => ({
            viewports: state.viewports.map((vp) =>
              vp.id === id
                ? {
                    ...vp,
                    imageIndex: 0,
                    zoom: 1,
                    panX: 0,
                    panY: 0,
                    rotation: 0,
                    inverted: false,
                    flippedH: false,
                    flippedV: false,
                    magEnabled: false,
                  }
                : vp
            ),
          }))
        }
      },
      resetAllViewports: () => {
        set((state) => ({
          viewports: state.viewports.map((vp) => ({
            ...vp,
            imageIndex: 0,
            zoom: 1,
            panX: 0,
            panY: 0,
            rotation: 0,
            inverted: false,
            flippedH: false,
            flippedV: false,
            magEnabled: false,
          })),
        }))
      },
      setSyncScroll: (sync) => set({ syncScroll: sync }),
      assignSeriesToViewport: (viewportId, seriesId) => {
        const { series } = get()
        const matched = series.find((s) => s.id === seriesId)
        set((state) => ({
          viewports: state.viewports.map((vp) =>
            vp.id === viewportId
              ? {
                  ...vp,
                  seriesId,
                  imageIndex: 0,
                  windowWidth: matched?.windowWidth || vp.windowWidth,
                  windowCenter: matched?.windowCenter || vp.windowCenter,
                }
              : vp
          ),
        }))
      },

      currentTool: 'none',
      annotations: [],
      setCurrentTool: (tool) => set({ currentTool: tool }),
      addAnnotation: (annotation) => {
        set((state) => ({ annotations: [...state.annotations, annotation] }))
      },
      updateAnnotation: (id, updates) => {
        set((state) => ({
          annotations: state.annotations.map((a) => (a.id === id ? { ...a, ...updates } : a)),
        }))
      },
      deleteAnnotation: (id) => {
        set((state) => ({ annotations: state.annotations.filter((a) => a.id !== id) }))
      },
      clearAnnotations: (viewportId) => {
        if (viewportId) {
          set((state) => ({
            annotations: state.annotations.filter((a) => a.viewportId !== viewportId),
          }))
        } else {
          set({ annotations: [] })
        }
      },

      reportTemplates: mockReportTemplates,
      reports: [],
      currentReport: null,
      setCurrentReport: (report) => set({ currentReport: report }),
      createReport: (studyId) => {
        const { reports, studies } = get()
        const study = studies.find((s) => s.id === studyId)
        if (!study) return
        // 1. 已有报告则直接打开
        const existing = reports.find((r) => r.studyId === studyId)
        if (existing) {
          set({ currentReport: existing, activeWindow: 'report', selectedStudyId: studyId })
          return
        }
        // 2. 否则创建新报告并存入 reports 数组
        const newReport: Report = {
          id: `rpt${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
          studyId,
          accessionNumber: study.accessionNumber,
          patientName: study.patient.name,
          patientGender: study.patient.gender,
          patientAge: `${study.patient.age}岁`,
          modality: study.modality,
          findings: '',
          conclusion: '',
          status: 'draft',
          reviewer: '李医生',
          reportingDoctor: '李医生',
          createdAt: dayjs().format('YYYY-MM-DD HH:mm:ss'),
          updatedAt: dayjs().format('YYYY-MM-DD HH:mm:ss'),
        }
        set((s) => ({
          reports: [...s.reports, newReport],
          currentReport: newReport,
          activeWindow: 'report',
          selectedStudyId: studyId,
        }))
      },
      updateReport: (updates) => {
        set((state) => {
          if (!state.currentReport) return state
          const updatedReport: Report = {
            ...state.currentReport,
            ...updates,
            updatedAt: dayjs().format('YYYY-MM-DD HH:mm:ss'),
          }
          return {
            currentReport: updatedReport,
            reports: state.reports.map((r) => (r.id === updatedReport.id ? updatedReport : r)),
          }
        })
      },
      submitReport: () => {
        const { currentReport } = get()
        if (currentReport) {
          set((state) => {
            const updatedReport: Report = {
              ...currentReport,
              status: 'submitted',
              submittedAt: dayjs().format('YYYY-MM-DD HH:mm:ss'),
              updatedAt: dayjs().format('YYYY-MM-DD HH:mm:ss'),
            }
            return {
              currentReport: updatedReport,
              reports: state.reports.map((r) => (r.id === updatedReport.id ? updatedReport : r)),
              studies: state.studies.map((s) =>
                s.id === currentReport.studyId
                  ? { ...s, status: 'pending', updatedAt: dayjs().format('YYYY-MM-DD HH:mm:ss') }
                  : s
              ),
            }
          })
        }
      },
      approveReport: (reportId) => {
        set((state) => {
          const targetReport = state.reports.find((r) => r.id === reportId) || state.currentReport
          if (!targetReport) return state
          const updatedReport: Report = {
            ...targetReport,
            status: 'approved',
            approvedAt: dayjs().format('YYYY-MM-DD HH:mm:ss'),
            updatedAt: dayjs().format('YYYY-MM-DD HH:mm:ss'),
          }
          return {
            reports: state.reports.map((r) => (r.id === updatedReport.id ? updatedReport : r)),
            currentReport: state.currentReport && state.currentReport.id === updatedReport.id ? updatedReport : state.currentReport,
            studies: state.studies.map((s) =>
              s.id === updatedReport.studyId
                ? { ...s, status: 'reviewed', updatedAt: dayjs().format('YYYY-MM-DD HH:mm:ss') }
                : s
            ),
          }
        })
      },
      rejectReport: (reportId, reason) => {
        set((state) => {
          const targetReport = state.reports.find((r) => r.id === reportId) || state.currentReport
          if (!targetReport) return state
          const updatedReport: Report = {
            ...targetReport,
            status: 'rejected',
            rejectReason: reason,
            rejectedAt: dayjs().format('YYYY-MM-DD HH:mm:ss'),
            updatedAt: dayjs().format('YYYY-MM-DD HH:mm:ss'),
          }
          return {
            reports: state.reports.map((r) => (r.id === updatedReport.id ? updatedReport : r)),
            currentReport: state.currentReport && state.currentReport.id === updatedReport.id ? updatedReport : state.currentReport,
            studies: state.studies.map((s) =>
              s.id === updatedReport.studyId
                ? { ...s, status: 'returned', updatedAt: dayjs().format('YYYY-MM-DD HH:mm:ss') }
                : s
            ),
          }
        })
      },

      printJobs: [],
      addPrintJob: (job) => {
        const newJob: PrintJob = {
          ...job,
          id: `job${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
          status: 'queued',
          progress: 0,
          createdAt: dayjs().format('YYYY-MM-DD HH:mm:ss'),
        }
        set((state) => ({ printJobs: [newJob, ...state.printJobs] }))
        // 立即调度执行状态流转
        schedulePrintJob(newJob.id)
      },
      updatePrintJob: (jobId, updates) => {
        set((state) => ({
          printJobs: state.printJobs.map((j) => (j.id === jobId ? { ...j, ...updates } : j)),
        }))
      },

      userSettings: defaultUserSettings,
      updateUserSettings: (settings) => {
        set((state) => ({
          userSettings: { ...state.userSettings, ...settings },
        }))
      },
      resetUserSettings: () => set({ userSettings: defaultUserSettings }),

      showShortcuts: false,
      setShowShortcuts: (show) => set({ showShortcuts: show }),

      showImportWindow: false,
      setShowImportWindow: (show) => set({ showImportWindow: show }),
    }),
    {
      name: 'pacs-viewer-storage',
      partialize: (state) => ({
        userSettings: state.userSettings,
        currentLayout: state.currentLayout,
      }),
    }
  )
)

// ============================================
// 任务调度器：打印任务 / 导入任务 状态流转
// ============================================
function schedulePrintJob(jobId: string) {
  setTimeout(() => {
    const st = useAppStore.getState()
    const job = st.printJobs.find((j) => j.id === jobId)
    if (!job || job.status === 'completed' || job.status === 'failed') return

    // 1. queued → printing
    if (job.status === 'queued') {
      st.updatePrintJob(jobId, { status: 'printing', progress: 5 })
    }

    // 2. printing 进度递增 0 → 100，10秒
    let progress = job.status === 'printing' ? (job.progress || 0) : 5
    const tick = () => {
      const s2 = useAppStore.getState()
      const j2 = s2.printJobs.find((j) => j.id === jobId)
      if (!j2) return
      if (j2.status === 'completed' || j2.status === 'failed') return

      progress += Math.random() * 8 + 5
      if (progress >= 100) {
        s2.updatePrintJob(jobId, {
          status: 'completed',
          progress: 100,
          completedAt: dayjs().format('YYYY-MM-DD HH:mm:ss'),
        })
        return
      }
      s2.updatePrintJob(jobId, { status: 'printing', progress: Math.round(progress) })
      setTimeout(tick, 500 + Math.random() * 600)
    }
    setTimeout(tick, 400)
  }, 600 + Math.random() * 400)
}

// 导入任务调度器：pending → matching → importing → success / failed
export function scheduleImportTask(taskId: string, { manualMatch = false }: { manualMatch?: boolean } = {}) {
  setTimeout(() => {
    const st = useAppStore.getState()
    const task = st.importTasks.find((t) => t.id === taskId)
    if (!task) return
    if (['success', 'failed'].includes(task.status)) return

    // Step 1: 匹配检查号（根据 accessionNumber 找 study）
    const goMatching = () => {
      const s = useAppStore.getState()
      const t = s.importTasks.find((x) => x.id === taskId)
      if (!t || ['success', 'failed'].includes(t.status)) return

      s.updateImportTask(taskId, { status: 'matching', progress: 10 })

      // 匹配：先根据 studyId，再根据 accessionNumber
      setTimeout(() => {
        const s2 = useAppStore.getState()
        const t2 = s2.importTasks.find((x) => x.id === taskId)
        if (!t2 || ['success', 'failed'].includes(t2.status)) return

        const foundStudy =
          (t2.studyId && s2.studies.find((st2) => st2.id === t2.studyId)) ||
          (t2.accessionNumber && s2.studies.find((st2) => st2.accessionNumber === t2.accessionNumber))

        if (foundStudy) {
          // 匹配成功，记录患者信息和studyId
          s2.updateImportTask(taskId, {
            studyId: foundStudy.id,
            accessionNumber: foundStudy.accessionNumber,
            patientName: foundStudy.patient.name,
            modality: foundStudy.modality,
            matchSuccess: true,
          })
          goImporting()
        } else {
          // 匹配失败，给用户重试/手动匹配
          s2.updateImportTask(taskId, {
            status: 'failed',
            progress: 0,
            matchSuccess: false,
            errorMessage:
              t2.accessionNumber
                ? `检查号"${t2.accessionNumber}"未找到记录，请手动匹配或重试`
                : 'DICOM文件中未提取到检查号，请手动匹配',
          })
        }
      }, 700 + Math.random() * 500)
    }

    // Step 2: 导入（进度递增）
    const goImporting = () => {
      const s = useAppStore.getState()
      const t = s.importTasks.find((x) => x.id === taskId)
      if (!t || ['success', 'failed'].includes(t.status)) return
      s.updateImportTask(taskId, { status: 'importing', progress: 20, errorMessage: undefined })
      let p = 20
      const tick = () => {
        const s2 = useAppStore.getState()
        const t2 = s2.importTasks.find((x) => x.id === taskId)
        if (!t2 || ['success', 'failed'].includes(t2.status)) return
        p += Math.random() * 12 + 4
        if (p >= 100) {
          // 完成：手动匹配一定成功，非手动有小概率失败
          const willFail = !manualMatch && !t2.studyId && Math.random() < 0.1 && (t2.retryCount || 0) < 1
          if (willFail) {
            s2.updateImportTask(taskId, {
              status: 'failed',
              progress: 85,
              errorMessage: '网络中断：上传超时，可点击重试',
              retryCount: (t2.retryCount || 0),
            })
          } else {
            s2.updateImportTask(taskId, {
              status: 'success',
              progress: 100,
              imageCount: 120 + Math.floor(Math.random() * 200),
              completedAt: dayjs().format('YYYY-MM-DD HH:mm:ss'),
            })
          }
          return
        }
        s2.updateImportTask(taskId, { status: 'importing', progress: Math.round(Math.min(p, 99)) })
        setTimeout(tick, 250 + Math.random() * 350)
      }
      setTimeout(tick, 300)
    }

    // 起点
    if (manualMatch) {
      // 手动匹配：直接进入导入，跳过匹配
      goImporting()
    } else if (task.studyId) {
      // 已经有匹配过的studyId，也直接导入
      goImporting()
    } else {
      // 普通流程：先匹配
      goMatching()
    }
  }, 300)
}
