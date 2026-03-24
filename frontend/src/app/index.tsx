import { useState, useEffect } from 'react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import './styles/index.css'
import { Sidebar } from '@/widgets/sidebar'
import { LoginPage, CamerasPage, CameraPage, CameraAddPage, PlatesPage, AccessPointsPage, HistoryPage, TestRecognitionPage, ApiTokensPage } from '@/pages'
import { ToastProvider, Toaster } from '@/shared/ui'
import { isAuthenticated } from '@/shared/auth'

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 1,
      staleTime: 30_000,
    },
  },
})

type SidebarPage = 'cameras' | 'plates' | 'access-points' | 'history' | 'test-recognition' | 'api'
type Route =
  | { page: SidebarPage }
  | { page: 'camera'; id: string }
  | { page: 'camera-add' }

const SIDEBAR_PAGES: SidebarPage[] = ['cameras', 'plates', 'access-points', 'history', 'test-recognition', 'api']

function App() {
  const [authed, setAuthed] = useState(isAuthenticated)
  const [route, setRoute] = useState<Route>({ page: 'cameras' })

  useEffect(() => {
    const handleAuthError = () => {
      queryClient.clear()
      setAuthed(false)
    }
    window.addEventListener('anpr:auth-error', handleAuthError)
    return () => window.removeEventListener('anpr:auth-error', handleAuthError)
  }, [])

  const handleNavigate = (id: string) => {
    if ((SIDEBAR_PAGES as string[]).includes(id)) {
      setRoute({ page: id as SidebarPage })
    }
  }

  if (!authed) {
    return (
      <ToastProvider>
        <LoginPage onLogin={() => setAuthed(true)} />
        <Toaster />
      </ToastProvider>
    )
  }

  const activeItem: string = route.page === 'camera' || route.page === 'camera-add' ? 'cameras' : route.page

  return (
    <QueryClientProvider client={queryClient}>
      <ToastProvider>
        <div style={{ display: 'flex', minHeight: '100vh' }}>
          <Sidebar activeItem={activeItem} onNavigate={handleNavigate} />

          {route.page === 'cameras' && (
            <CamerasPage
              onCameraClick={id => setRoute({ page: 'camera', id })}
              onAddCamera={() => setRoute({ page: 'camera-add' })}
            />
          )}

          {route.page === 'camera' && (
            <CameraPage
              id={route.id}
              onBack={() => setRoute({ page: 'cameras' })}
            />
          )}

          {route.page === 'camera-add' && (
            <CameraAddPage
              onBack={() => setRoute({ page: 'cameras' })}
              onCreated={() => setRoute({ page: 'cameras' })}
            />
          )}

          {route.page === 'plates' && <PlatesPage />}

          {route.page === 'access-points' && <AccessPointsPage />}

          {route.page === 'history' && <HistoryPage />}

          {route.page === 'test-recognition' && <TestRecognitionPage />}

          {route.page === 'api' && <ApiTokensPage />}
        </div>
        <Toaster />
      </ToastProvider>
    </QueryClientProvider>
  )
}

export default App
