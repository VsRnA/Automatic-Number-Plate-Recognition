import { createContext } from 'react'

export type ToastType = 'error' | 'success' | 'info'

export interface Toast {
  id: number
  message: string
  type: ToastType
}

export interface ToastContextValue {
  toasts: Toast[]
  showToast: (message: string, type?: ToastType) => void
  removeToast: (id: number) => void
}

export const ToastContext = createContext<ToastContextValue | null>(null)
