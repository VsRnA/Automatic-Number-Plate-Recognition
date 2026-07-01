import { useState, useEffect } from 'react'
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import './styles/index.css'
import { Sidebar } from '@/widgets/sidebar'
import { LoginPage, CamerasPage, CameraPage, CameraAddPage, CameraLivePage, PlatesPage, AccessPointsPage, HistoryPage, AnalyticsPage, NotificationsPage } from '@/pages'
import { ToastProvider, Toaster } from '@/shared/ui'
import { NotificationProvider } from '@/entities/notification'
import { isAuthenticated } from '@/shared/auth'

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 1,
      staleTime: 30_000,
    },
  },
})

function App() {
  const [authed, setAuthed] = useState(isAuthenticated)
  const [darkMode, setDarkMode] = useState(() => localStorage.getItem('theme') === 'dark')

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', darkMode ? 'dark' : 'light')
    localStorage.setItem('theme', darkMode ? 'dark' : 'light')
  }, [darkMode])

  useEffect(() => {
    const handleAuthError = () => {
      queryClient.clear()
      setAuthed(false)
    }
    window.addEventListener('anpr:auth-error', handleAuthError)
    return () => window.removeEventListener('anpr:auth-error', handleAuthError)
  }, [])

  if (!authed) {
    return (
      <ToastProvider>
        <LoginPage onLogin={() => setAuthed(true)} />
        <Toaster />
      </ToastProvider>
    )
  }

  return (
    <BrowserRouter>
      <QueryClientProvider client={queryClient}>
        <ToastProvider>
          <NotificationProvider>
            <div className="app">
              <Sidebar darkMode={darkMode} onToggleDark={() => setDarkMode(d => !d)} />
              <div className="main">
                <Routes>
                  <Route path="/" element={<Navigate to="/cameras" replace />} />
                  <Route path="/cameras" element={<CamerasPage />} />
                  <Route path="/cameras/add" element={<CameraAddPage />} />
                  <Route path="/cameras/:id/live" element={<CameraLivePage />} />
                  <Route path="/cameras/:id" element={<CameraPage />} />
                  <Route path="/plates" element={<PlatesPage />} />
                  <Route path="/access-points" element={<AccessPointsPage />} />
                  <Route path="/history" element={<HistoryPage />} />
                  <Route path="/analytics" element={<AnalyticsPage />} />
                  <Route path="/notifications" element={<NotificationsPage />} />
                  <Route path="*" element={<Navigate to="/cameras" replace />} />
                </Routes>
              </div>
            </div>
            <Toaster />
          </NotificationProvider>
        </ToastProvider>
      </QueryClientProvider>
    </BrowserRouter>
  )
}

export default App
