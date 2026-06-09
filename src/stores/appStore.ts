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
        const newTask: ImportTask = {
          ...task,
          id: `imp${Date.now()}`,
          createdAt: dayjs().format('YYYY-MM-DD HH:mm:ss'),
          updatedAt: dayjs().format('YYYY-MM-DD HH:mm:ss'),
        }
        set((state) => ({ importTasks: [newTask, ...state.importTasks] }))
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
        const { updateImportTask } = get()
        updateImportTask(taskId, {
          status: 'retry',
          progress: 0,
          retryCount: (get().importTasks.find((t) => t.id === taskId)?.retryCount || 0) + 1,
        })
        setTimeout(() => {
          updateImportTask(taskId, { status: 'importing' })
          let progress = 0
          const interval = setInterval(() => {
            progress += Math.random() * 20
            if (progress >= 100) {
              progress = 100
              clearInterval(interval)
              updateImportTask(taskId, { status: 'success', progress: 100, errorMessage: undefined })
            } else {
              updateImportTask(taskId, { progress })
            }
          }, 500)
        }, 500)
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
      currentReport: null,
      setCurrentReport: (report) => set({ currentReport: report }),
      createReport: (studyId) => {
        const newReport: Report = {
          id: `rpt${Date.now()}`,
          studyId,
          findings: '',
          conclusion: '',
          status: 'draft',
          reportingDoctor: '当前医生',
          createdAt: dayjs().format('YYYY-MM-DD HH:mm:ss'),
          updatedAt: dayjs().format('YYYY-MM-DD HH:mm:ss'),
        }
        set({ currentReport: newReport, activeWindow: 'report' })
      },
      updateReport: (updates) => {
        set((state) => ({
          currentReport: state.currentReport
            ? {
                ...state.currentReport,
                ...updates,
                updatedAt: dayjs().format('YYYY-MM-DD HH:mm:ss'),
              }
            : null,
        }))
      },
      submitReport: () => {
        const { currentReport } = get()
        if (currentReport) {
          set((state) => ({
            currentReport: {
              ...currentReport,
              status: 'submitted',
              submittedAt: dayjs().format('YYYY-MM-DD HH:mm:ss'),
              updatedAt: dayjs().format('YYYY-MM-DD HH:mm:ss'),
            },
            studies: state.studies.map((s) =>
              s.id === currentReport.studyId
                ? { ...s, status: 'pending', updatedAt: dayjs().format('YYYY-MM-DD HH:mm:ss') }
                : s
            ),
          }))
        }
      },
      approveReport: (reportId) => {
        set((state) => ({
          studies: state.studies.map((s) =>
            s.id === reportId
              ? { ...s, status: 'reviewed', updatedAt: dayjs().format('YYYY-MM-DD HH:mm:ss') }
              : s
          ),
        }))
      },
      rejectReport: (reportId, reason) => {
        set((state) => ({
          studies: state.studies.map((s) =>
            s.id === reportId
              ? { ...s, status: 'returned', updatedAt: dayjs().format('YYYY-MM-DD HH:mm:ss') }
              : s
          ),
        }))
      },

      printJobs: [],
      addPrintJob: (job) => {
        const newJob: PrintJob = {
          ...job,
          id: `job${Date.now()}`,
          status: 'queued',
          createdAt: dayjs().format('YYYY-MM-DD HH:mm:ss'),
        }
        set((state) => ({ printJobs: [newJob, ...state.printJobs] }))
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
