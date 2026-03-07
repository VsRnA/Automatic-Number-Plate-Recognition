import { useCallback, useState } from 'react'
import { ToastContext, type ToastType } from './toastContext'

let nextId = 0

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<import('./toastContext').Toast[]>([])

  const removeToast = useCallback((id: number) => {
    setToasts(prev => prev.filter(t => t.id !== id))
  }, [])

  const showToast = useCallback(
    (message: string, type: ToastType = 'error') => {
      const id = ++nextId
      setToasts(prev => [...prev, { id, message, type }])
      setTimeout(() => removeToast(id), 5000)
    },
    [removeToast],
  )

  return (
    <ToastContext.Provider value={{ toasts, showToast, removeToast }}>
      {children}
    </ToastContext.Provider>
  )
}
