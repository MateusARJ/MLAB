import React, { useState } from 'react'
import { Login } from './pages/Login'
import { Permissions } from './pages/Permissions'
import { Dashboard } from './pages/Dashboard'
import { Room } from './pages/Room'

type AppState = 'login' | 'permissions' | 'dashboard' | 'room'

export default function App(): React.ReactElement {
  const [state, setState] = useState<AppState>('login')
  const [room, setRoom] = useState<{ id: string; slug: string; link: string } | null>(null)

  const handleLoginSuccess = () => setState('permissions')
  const handlePermissionsGranted = () => setState('dashboard')
  const handleLogout = () => setState('login')
  
  const handleEnterRoom = (roomData: { id: string; slug: string; link: string }) => {
    setRoom(roomData)
    setState('room')
  }
  
  const handleCloseRoom = () => {
    setRoom(null)
    setState('dashboard')
  }

  return (
    <>
      {state === 'login' && <Login onSuccess={handleLoginSuccess} />}
      {state === 'permissions' && (
        <Permissions
          onPermissionsGranted={handlePermissionsGranted}
          onLogout={handleLogout}
        />
      )}
      {state === 'dashboard' && <Dashboard onEnterRoom={handleEnterRoom} onLogout={handleLogout} />}
      {state === 'room' && room && <Room room={room} onCloseRoom={handleCloseRoom} />}
    </>
  )
}
