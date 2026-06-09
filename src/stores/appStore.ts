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
  ReportVersion,
  ImportGroup,
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

  reportVersions: ReportVersion[]
  addReportVersion: (version: Omit<ReportVersion, 'id' | 'createdAt'>) => void
  getVersionsByReportId: (reportId: string) => ReportVersion[]

  printJobs: PrintJob[]
  addPrintJob: (job: Omit<PrintJob, 'id' | 'createdAt' | 'status'>) => void
  updatePrintJob: (jobId: string, updates: Partial<PrintJob>) => void
  retryPrintJob: (jobId: string) => string | null

  importGroups: ImportGroup[]
  getGroupByAccession: (accession: string) => ImportGroup | undefined
  getGroupFiles: (groupId: string) => ImportTask[]

  clearReportVersions: () => void
  clearImportData: () => void
  clearPrintJobs: () => void
  clearReports: () => void
  exportBackupData: (types: Array<'reports' | 'importTasks' | 'printJobs'>) => { version: number; exportedAt: string; reports: Report[]; importTasks: ImportTask[]; printJobs: PrintJob[] }
  getBackupPreview: (data: any) => { reports: number; importTasks: number; printJobs: number }
  restoreBackupData: (data: any) => { merged: number; skipped: number }

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
      importGroups: [],
      addImportTask: (task) => {
        // 尝试从文件名提取检查号（DICOM 文件常包含），保留 ACC/CHK/STUDY 前缀
        let extractedAcc = task.accessionNumber
        if (!extractedAcc) {
          const nameMatch = task.fileName.match(/(ACC|CHK|STUDY)?[-_]?(\d{6,12})/i)
          if (nameMatch) {
            const prefix = nameMatch[1] ? nameMatch[1].toUpperCase() : ''
            extractedAcc = `${prefix}${nameMatch[2]}`
          }
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
        set((state) => {
          // 归组：根据 accessionNumber 找已有组或创建新组
          let newGroups = [...state.importGroups]
          const acc = finalTask.accessionNumber || `unk-${Date.now()}`
          let group = newGroups.find((g) => g.accessionNumber === acc)
          if (!group) {
            group = {
              id: `grp_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
              accessionNumber: acc,
              fileIds: [],
              createdAt: dayjs().format('YYYY-MM-DD HH:mm:ss'),
              updatedAt: dayjs().format('YYYY-MM-DD HH:mm:ss'),
            }
            newGroups = [group, ...newGroups]
          }
          group.fileIds = [...new Set([...group.fileIds, finalTask.id])]
          group.updatedAt = dayjs().format('YYYY-MM-DD HH:mm:ss')
          return {
            importTasks: [finalTask, ...state.importTasks],
            importGroups: newGroups.map((g) => (g.id === group!.id ? { ...group! } : g)),
          }
        })
        scheduleImportTask(finalTask.id, { manualMatch: false })
      },
      updateImportTask: (taskId, updates) => {
        set((state) => {
          const updatedTasks = state.importTasks.map((t) =>
            t.id === taskId
              ? { ...t, ...updates, updatedAt: dayjs().format('YYYY-MM-DD HH:mm:ss') }
              : t
          )
          // 如果任务成功，有 studyId 和 imageCount，同步到 study
          let updatedStudies = state.studies
          const t = updatedTasks.find((x) => x.id === taskId)
          if (t && t.status === 'success' && t.studyId && t.imageCount && t.imageCount > 0) {
            updatedStudies = state.studies.map((s) =>
              s.id === t.studyId
                ? {
                    ...s,
                    imageCount: s.imageCount + (t.imageCount || 0),
                    updatedAt: dayjs().format('YYYY-MM-DD HH:mm:ss'),
                  }
                : s
            )
          }
          return {
            importTasks: updatedTasks,
            studies: updatedStudies,
          }
        })
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
        const nextCount = (task.retryCount || 0) + 1
        st.updateImportTask(taskId, {
          // 立即切到明确状态：手动匹配→importing；自动匹配→matching（不再是含糊的 pending）
          status: manual ? 'importing' : 'matching',
          progress: manual ? 20 : 10,
          errorMessage: `正在第${nextCount}次重试...`,
          retryCount: nextCount,
        })
        scheduleImportTask(taskId, { manualMatch: manual })
      },
      removeImportTask: (taskId) => {
        set((state) => {
          const remaining = state.importTasks.filter((t) => t.id !== taskId)
          // 从所有组里移除这个 taskId；如该组变空，也一起删除
          const newGroups = state.importGroups
            .map((g) => ({ ...g, fileIds: g.fileIds.filter((fid) => fid !== taskId) }))
            .filter((g) => g.fileIds.length > 0)
          return { importTasks: remaining, importGroups: newGroups }
        })
      },
      getGroupByAccession: (accession) => {
        return get().importGroups.find((g) => g.accessionNumber === accession)
      },
      getGroupFiles: (groupId) => {
        const g = get().importGroups.find((x) => x.id === groupId)
        if (!g) return []
        return g.fileIds
          .map((fid) => get().importTasks.find((t) => t.id === fid))
          .filter(Boolean) as ImportTask[]
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
      reportVersions: [],
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
          // 找前一个同报告的最新版本，计算字符数变更摘要
          const prev = [...state.reportVersions]
            .filter((v) => v.reportId === updatedReport.id)
            .sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1))[0]
          const calc = (cur: string, prevStr: string) => {
            const c = cur || ''
            const p = prevStr || ''
            let added = 0
            let removed = 0
            if (c.length > p.length) added = c.length - p.length
            else if (c.length < p.length) removed = p.length - c.length
            if (c !== p && added === 0 && removed === 0) added = Math.max(c.length, p.length)
            return { added, removed }
          }
          const findingsDiff = calc(updatedReport.findings, prev?.findings || '')
          const conclusionDiff = calc(updatedReport.conclusion, prev?.conclusion || '')
          const changesSummary: ReportVersion['changesSummary'] = {
            findings: findingsDiff.added + findingsDiff.removed > 0 ? findingsDiff : undefined,
            conclusion: conclusionDiff.added + conclusionDiff.removed > 0 ? conclusionDiff : undefined,
          }
          const newVersion: ReportVersion = {
            id: `ver_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
            reportId: updatedReport.id,
            studyId: updatedReport.studyId,
            action: 'save-draft',
            findings: updatedReport.findings,
            conclusion: updatedReport.conclusion,
            status: updatedReport.status,
            reviewer: updatedReport.reviewer,
            rejectReason: updatedReport.rejectReason,
            operatorName: updatedReport.reportingDoctor || '李医生',
            createdAt: dayjs().format('YYYY-MM-DD HH:mm:ss'),
            changesSummary,
            snapshot: { ...updatedReport },
          }
          return {
            currentReport: updatedReport,
            reports: state.reports.map((r) => (r.id === updatedReport.id ? updatedReport : r)),
            reportVersions: [...state.reportVersions, newVersion],
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
            const newVersion: ReportVersion = {
              id: `ver_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
              reportId: updatedReport.id,
              studyId: updatedReport.studyId,
              action: 'submit',
              findings: updatedReport.findings,
              conclusion: updatedReport.conclusion,
              status: updatedReport.status,
              reviewer: updatedReport.reviewer,
              rejectReason: updatedReport.rejectReason,
              operatorName: updatedReport.reportingDoctor || '李医生',
              createdAt: dayjs().format('YYYY-MM-DD HH:mm:ss'),
              snapshot: { ...updatedReport },
            }
            return {
              currentReport: updatedReport,
              reports: state.reports.map((r) => (r.id === updatedReport.id ? updatedReport : r)),
              reportVersions: [...state.reportVersions, newVersion],
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
          const newVersion: ReportVersion = {
            id: `ver_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
            reportId: updatedReport.id,
            studyId: updatedReport.studyId,
            action: 'approve',
            findings: updatedReport.findings,
            conclusion: updatedReport.conclusion,
            status: updatedReport.status,
            reviewer: updatedReport.reviewer,
            rejectReason: updatedReport.rejectReason,
            operatorName: updatedReport.reviewer || updatedReport.reportingDoctor || '李医生',
            createdAt: dayjs().format('YYYY-MM-DD HH:mm:ss'),
            snapshot: { ...updatedReport },
          }
          return {
            reports: state.reports.map((r) => (r.id === updatedReport.id ? updatedReport : r)),
            reportVersions: [...state.reportVersions, newVersion],
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
          const newVersion: ReportVersion = {
            id: `ver_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
            reportId: updatedReport.id,
            studyId: updatedReport.studyId,
            action: 'reject',
            findings: updatedReport.findings,
            conclusion: updatedReport.conclusion,
            status: updatedReport.status,
            reviewer: updatedReport.reviewer,
            rejectReason: reason,
            operatorName: updatedReport.reviewer || updatedReport.reportingDoctor || '李医生',
            createdAt: dayjs().format('YYYY-MM-DD HH:mm:ss'),
            snapshot: { ...updatedReport },
          }
          return {
            reports: state.reports.map((r) => (r.id === updatedReport.id ? updatedReport : r)),
            reportVersions: [...state.reportVersions, newVersion],
            currentReport: state.currentReport && state.currentReport.id === updatedReport.id ? updatedReport : state.currentReport,
            studies: state.studies.map((s) =>
              s.id === updatedReport.studyId
                ? { ...s, status: 'returned', updatedAt: dayjs().format('YYYY-MM-DD HH:mm:ss') }
                : s
            ),
          }
        })
      },
      addReportVersion: (version) => {
        const v: ReportVersion = {
          ...version,
          id: `ver_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
          createdAt: dayjs().format('YYYY-MM-DD HH:mm:ss'),
        }
        set((s) => ({ reportVersions: [...s.reportVersions, v] }))
      },
      getVersionsByReportId: (reportId) => {
        return get()
          .reportVersions.filter((v) => v.reportId === reportId)
          .sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1))
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
        schedulePrintJob(newJob.id)
      },
      updatePrintJob: (jobId, updates) => {
        set((state) => ({
          printJobs: state.printJobs.map((j) => (j.id === jobId ? { ...j, ...updates } : j)),
        }))
      },
      retryPrintJob: (jobId) => {
        const old = get().printJobs.find((j) => j.id === jobId)
        if (!old) return null
        const { id, status, progress, createdAt, startedAt, completedAt, errorMessage, sourceJobId, ...rest } = old
        const newJob: PrintJob = {
          ...rest,
          id: `job${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
          status: 'queued',
          progress: 0,
          createdAt: dayjs().format('YYYY-MM-DD HH:mm:ss'),
          sourceJobId: old.id,
        }
        set((s) => ({ printJobs: [newJob, ...s.printJobs] }))
        schedulePrintJob(newJob.id)
        return newJob.id
      },

      // ============ 本机数据清理 ============
      clearReportVersions: () => set({ reportVersions: [] }),
      clearImportData: () => set({ importTasks: [], importGroups: [] }),
      clearPrintJobs: () => set({ printJobs: [] }),
      clearReports: () => set({ reports: [], currentReport: null, reportVersions: [] }),

      // ============ 本机数据备份 & 恢复 ============
      exportBackupData: (types) => {
        const s = get()
        return {
          version: 1,
          exportedAt: dayjs().format('YYYY-MM-DD HH:mm:ss'),
          reports: types.includes('reports') ? s.reports : [],
          importTasks: types.includes('importTasks') ? s.importTasks : [],
          printJobs: types.includes('printJobs') ? s.printJobs : [],
        }
      },
      getBackupPreview: (data) => {
        return {
          reports: Array.isArray(data?.reports) ? data.reports.length : 0,
          importTasks: Array.isArray(data?.importTasks) ? data.importTasks.length : 0,
          printJobs: Array.isArray(data?.printJobs) ? data.printJobs.length : 0,
        }
      },
      restoreBackupData: (data) => {
        if (!data || typeof data !== 'object') return { merged: 0, skipped: 0 }
        let merged = 0
        let skipped = 0
        set((state) => {
          const existingReportIds = new Set(state.reports.map((r) => r.id))
          const existingImportIds = new Set(state.importTasks.map((t) => t.id))
          const existingPrintIds = new Set(state.printJobs.map((j) => j.id))
          const incomingReports = (data.reports || []).filter((r: Report) => !existingReportIds.has(r.id))
          const incomingImports = (data.importTasks || []).filter((t: ImportTask) => !existingImportIds.has(t.id))
          const incomingPrints = (data.printJobs || []).filter((j: PrintJob) => !existingPrintIds.has(j.id))
          merged = incomingReports.length + incomingImports.length + incomingPrints.length
          skipped =
            (data.reports?.length || 0) +
            (data.importTasks?.length || 0) +
            (data.printJobs?.length || 0) -
            merged
          // 导入报告时同时导入其版本（版本数据在 snapshot 里保留）
          let newGroups = [...state.importGroups]
          const nowTs = dayjs().format('YYYY-MM-DD HH:mm:ss')
          incomingImports.forEach((task: ImportTask) => {
            const acc = task.accessionNumber || `unk-${Date.now()}`
            let g = newGroups.find((x) => x.accessionNumber === acc)
            if (!g) {
              g = { id: `grp_${Date.now()}_${Math.random().toString(36).slice(2, 5)}`, accessionNumber: acc, fileIds: [], createdAt: nowTs, updatedAt: nowTs }
              newGroups = [g, ...newGroups]
            }
            g.fileIds = [...new Set([...g.fileIds, task.id])]
            g.updatedAt = nowTs
          })
          return {
            reports: [...state.reports, ...incomingReports],
            importTasks: [...state.importTasks, ...incomingImports],
            printJobs: [...state.printJobs, ...incomingPrints],
            importGroups: newGroups,
          }
        })
        return { merged, skipped }
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
        reports: state.reports,
        currentReport: state.currentReport,
        studies: state.studies,
        printJobs: state.printJobs,
        importTasks: state.importTasks,
        reportVersions: state.reportVersions,
        importGroups: state.importGroups,
      }),
      onRehydrateStorage: () => (state, error) => {
        if (error || !state) return
        // ========== hydration 后：清理悬空组引用 + 未分组任务自动归组 ==========
        const nowTs = dayjs().format('YYYY-MM-DD HH:mm:ss')
        const taskIdSet = new Set(state.importTasks.map((t) => t.id))
        const existingGrouped = new Set<string>()
        // 1. 清掉已经被删除 taskId 的引用，同时记录哪些 task 已经在组里
        const cleanedGroups = state.importGroups
          .map((g) => ({ ...g, fileIds: g.fileIds.filter((fid) => taskIdSet.has(fid)) }))
          .filter((g) => g.fileIds.length > 0)
        cleanedGroups.forEach((g) => g.fileIds.forEach((fid) => existingGrouped.add(fid)))
        // 2. 还不在任何组里的 task → 按 accessionNumber 归组
        let finalGroups = [...cleanedGroups]
        const orphans = state.importTasks.filter((t) => !existingGrouped.has(t.id))
        orphans.forEach((task) => {
          const acc = task.accessionNumber || `unk-${Date.now()}`
          let g = finalGroups.find((x) => x.accessionNumber === acc)
          if (!g) {
            g = {
              id: `grp_${Date.now()}_${Math.random().toString(36).slice(2, 5)}`,
              accessionNumber: acc,
              fileIds: [],
              createdAt: nowTs,
              updatedAt: nowTs,
            }
            finalGroups = [g, ...finalGroups]
          }
          g.fileIds.push(task.id)
          g.updatedAt = nowTs
        })
        state.importGroups = finalGroups
      },
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
// 加超时保护：matching ≤3s，importing ≤ 15s，超时立即失败不一直转圈
export function scheduleImportTask(taskId: string, { manualMatch = false }: { manualMatch?: boolean } = {}) {
  const MATCHING_TIMEOUT_MS = 3000
  const IMPORTING_TIMEOUT_MS = 15000

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

      s.updateImportTask(taskId, { status: 'matching', progress: 10, errorMessage: '正在匹配检查号...' })

      // 超时保护：3s 还没匹配结果就判失败
      let finished = false
      const timer = setTimeout(() => {
        if (finished) return
        finished = true
        const sTime = useAppStore.getState()
        const tTime = sTime.importTasks.find((x) => x.id === taskId)
        if (!tTime || ['success', 'failed'].includes(tTime.status)) return
        sTime.updateImportTask(taskId, {
          status: 'failed',
          progress: 10,
          matchSuccess: false,
          errorMessage: '匹配超时：PACS服务器响应慢，可重试或手动匹配',
        })
      }, MATCHING_TIMEOUT_MS)

      // 匹配：先根据 studyId，再根据 accessionNumber
      setTimeout(() => {
        if (finished) return
        finished = true
        clearTimeout(timer)
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
            progress: 20,
            errorMessage: undefined,
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

    // Step 2: 导入（进度递增 + 整体超时15s）
    const goImporting = () => {
      const s = useAppStore.getState()
      const t = s.importTasks.find((x) => x.id === taskId)
      if (!t || ['success', 'failed'].includes(t.status)) return
      s.updateImportTask(taskId, { status: 'importing', progress: 20, errorMessage: undefined })
      let p = 20
      let finished = false

      // 超时保护：15秒强制结束
      const timer = setTimeout(() => {
        if (finished) return
        finished = true
        const sTime = useAppStore.getState()
        const tTime = sTime.importTasks.find((x) => x.id === taskId)
        if (!tTime || ['success', 'failed'].includes(tTime.status)) return
        sTime.updateImportTask(taskId, {
          status: 'failed',
          progress: Math.round(p),
          errorMessage: '导入超时：网络不稳定，已自动停止，请重试',
          retryCount: (tTime.retryCount || 0) + 1,
        })
      }, IMPORTING_TIMEOUT_MS)

      const tick = () => {
        if (finished) return
        const s2 = useAppStore.getState()
        const t2 = s2.importTasks.find((x) => x.id === taskId)
        if (!t2 || ['success', 'failed'].includes(t2.status)) { finished = true; clearTimeout(timer); return }
        p += Math.random() * 12 + 4
        if (p >= 100) {
          finished = true
          clearTimeout(timer)
          // 手动匹配一定成功；非手动且没有studyId的，第一次失败（15%），后面重试都成功
          const willFail = !manualMatch && !t2.studyId && Math.random() < 0.15 && (t2.retryCount || 0) < 1
          if (willFail) {
            s2.updateImportTask(taskId, {
              status: 'failed',
              progress: 85,
              errorMessage: '网络中断：上传超时，可点击重试',
              retryCount: (t2.retryCount || 0) + 1,
            })
          } else {
            s2.updateImportTask(taskId, {
              status: 'success',
              progress: 100,
              imageCount: 120 + Math.floor(Math.random() * 200),
              completedAt: dayjs().format('YYYY-MM-DD HH:mm:ss'),
              errorMessage: undefined,
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
      goImporting()
    } else if (task.studyId) {
      goImporting()
    } else {
      goMatching()
    }
  }, 200)
}
