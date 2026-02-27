import { useState } from 'react'
import './styles/index.css'
import { Sidebar } from '@/widgets/sidebar'
import { CamerasPage } from '@/pages/cameras'
import { CameraPage } from '@/pages/camera'
import { CameraAddPage } from '@/pages/camera-add'
import { ToastProvider } from '@/shared/lib'
import { Toaster } from '@/shared/ui'

type Route =
  | { page: 'cameras' }
  | { page: 'camera'; id: string }
  | { page: 'camera-add' }

function App() {
  const [route, setRoute] = useState<Route>({ page: 'cameras' })

  return (
    <ToastProvider>
      <div style={{ display: 'flex', minHeight: '100vh' }}>
        <Sidebar activeItem="cameras" />

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
      </div>
      <Toaster />
    </ToastProvider>
  )
}

export default App
