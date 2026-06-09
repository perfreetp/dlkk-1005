export type ExaminationStatus = 'pending' | 'emergency' | 'reviewed' | 'returned'

export interface Patient {
  id: string
  name: string
  gender: '男' | '女'
  age: number
  patientId: string
  phone?: string
  idCard?: string
}

export interface Study {
  id: string
  studyUid: string
  studyDate: string
  studyTime: string
  studyDescription: string
  modality: string
  accessionNumber: string
  patient: Patient
  status: ExaminationStatus
  priority: number
  seriesCount: number
  imageCount: number
  referringPhysician?: string
  reportId?: string
  createdAt: string
  updatedAt: string
}

export interface Series {
  id: string
  seriesUid: string
  seriesNumber: number
  seriesDescription: string
  modality: string
  studyId: string
  imageCount: number
  thickness?: number
  spacing?: number
  rows: number
  columns: number
  bitsAllocated: number
  windowWidth?: number
  windowCenter?: number
}

export interface ImageInstance {
  id: string
  sopInstanceUid: string
  instanceNumber: number
  seriesId: string
  imagePath: string
  rows: number
  columns: number
  sliceLocation?: number
  imagePositionPatient?: number[]
  imageOrientationPatient?: number[]
  pixelSpacing?: number[]
  windowWidth?: number
  windowCenter?: number
}

export interface ImportTask {
  id: string
  fileName: string
  filePath: string
  studyId?: string
  accessionNumber?: string
  status: 'pending' | 'matching' | 'importing' | 'success' | 'failed' | 'retry'
  progress: number
  errorMessage?: string
  retryCount: number
  maxRetries: number
  createdAt: string
  updatedAt: string
}

export type AnnotationTool =
  | 'none'
  | 'length'
  | 'angle'
  | 'area'
  | 'arrow'
  | 'text'
  | 'rectangle'
  | 'ellipse'
  | 'freehand'

export interface Annotation {
  id: string
  tool: AnnotationTool
  points: { x: number; y: number }[]
  text?: string
  color: string
  thickness: number
  fontSize?: number
  viewportId: string
  seriesId: string
  imageId: string
}

export interface ViewportState {
  id: string
  seriesId?: string
  imageIndex: number
  windowWidth: number
  windowCenter: number
  zoom: number
  panX: number
  panY: number
  rotation: number
  inverted: boolean
  flippedH: boolean
  flippedV: boolean
  magEnabled: boolean
  magPosition?: { x: number; y: number }
  magZoom: number
}

export interface LayoutPreset {
  id: string
  name: string
  rows: number
  columns: number
  viewports: ViewportState[]
}

export interface ReportTemplate {
  id: string
  name: string
  category: string
  content: string
  conclusion: string
}

export interface Report {
  id: string
  studyId: string
  templateId?: string
  findings: string
  conclusion: string
  status: 'draft' | 'submitted' | 'reviewing' | 'approved' | 'rejected'
  reportingDoctor: string
  reviewingDoctor?: string
  createdAt: string
  updatedAt: string
  submittedAt?: string
  approvedAt?: string
}

export interface PrintJob {
  id: string
  studyId: string
  type: 'film' | 'disc'
  layout: { rows: number; columns: number }
  seriesIds: string[]
  annotations: boolean
  patientInfo: boolean
  status: 'queued' | 'printing' | 'completed' | 'failed'
  copies: number
  createdAt: string
}

export type WindowName =
  | 'worklist'
  | 'import'
  | 'viewer'
  | 'report'
  | 'print'
  | 'settings'

export interface ShortcutConfig {
  id: string
  action: string
  keys: string
  description: string
}

export interface UserSettings {
  theme: 'dark' | 'light'
  defaultLayout: LayoutPreset
  defaultTool: AnnotationTool
  shortcuts: ShortcutConfig[]
  windowPresets: { name: string; width: number; center: number; modality?: string }[]
  autoSync: boolean
  measurementColor: string
  language: 'zh-CN' | 'en-US'
}
