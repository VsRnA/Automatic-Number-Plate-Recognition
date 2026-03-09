import { useState } from 'react'
import './styles/index.css'
import { Sidebar } from '@/widgets/sidebar'
import { CamerasPage, CameraPage, CameraAddPage, PlatesPage, AccessPointsPage, HistoryPage, TestRecognitionPage, ApiTokensPage } from '@/pages'
import { ToastProvider, Toaster } from '@/shared/ui'

type SidebarPage = 'cameras' | 'plates' | 'access-points' | 'history' | 'test-recognition' | 'api'
type Route =
  | { page: SidebarPage }
  | { page: 'camera'; id: string }
  | { page: 'camera-add' }

const SIDEBAR_PAGES: SidebarPage[] = ['cameras', 'plates', 'access-points', 'history', 'test-recognition', 'api']

function App() {
  const [route, setRoute] = useState<Route>({ page: 'cameras' })

  const handleNavigate = (id: string) => {
    if ((SIDEBAR_PAGES as string[]).includes(id)) {
      setRoute({ page: id as SidebarPage })
    }
  }

  const activeItem: string = route.page === 'camera' || route.page === 'camera-add' ? 'cameras' : route.page

  return (
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
  )
}

export default App
