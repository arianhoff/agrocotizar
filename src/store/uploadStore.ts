import { create } from 'zustand'
import type { CatalogDiff, ExtractedPaymentCondition, ExtractionProgress } from '@/lib/ai/catalogExtraction'

export interface UploadDiff {
  catalog: CatalogDiff
  paymentConditions: ExtractedPaymentCondition[]
}

interface UploadStore {
  listId: string | null
  step: string | null
  error: string | null
  diff: UploadDiff | null
  streamingProgress: ExtractionProgress | null
  pcUploading: boolean
  pcError: string | null
  pendingPaymentConditions: ExtractedPaymentCondition[] | null

  startUpload: (listId: string, step: string) => void
  setStep: (step: string | null) => void
  setError: (error: string | null) => void
  setDiff: (diff: UploadDiff | null) => void
  setStreamingProgress: (p: ExtractionProgress | null) => void
  setPcUploading: (v: boolean) => void
  setPcError: (e: string | null) => void
  setPendingPaymentConditions: (v: ExtractedPaymentCondition[] | null) => void
  clear: () => void
}

export const useUploadStore = create<UploadStore>((set) => ({
  listId: null,
  step: null,
  error: null,
  diff: null,
  streamingProgress: null,
  pcUploading: false,
  pcError: null,
  pendingPaymentConditions: null,

  startUpload: (listId, step) => set({ listId, step, error: null, diff: null, streamingProgress: null }),
  setStep: (step) => set({ step }),
  setError: (error) => set({ error }),
  setDiff: (diff) => set({ diff }),
  setStreamingProgress: (streamingProgress) => set({ streamingProgress }),
  setPcUploading: (pcUploading) => set({ pcUploading }),
  setPcError: (pcError) => set({ pcError }),
  setPendingPaymentConditions: (pendingPaymentConditions) => set({ pendingPaymentConditions }),
  clear: () => set({ listId: null, step: null, error: null, diff: null, streamingProgress: null, pcUploading: false, pcError: null, pendingPaymentConditions: null }),
}))
