import React, { useState } from 'react'
import { Login } from './pages/Login'
import { Dashboard } from './pages/Dashboard'
import { Room } from './pages/Room'

type AppState = 'login' | 'dashboard' | 'room'

export default function App(): React.ReactElement {
  const [state, setState] = useState<AppState>('login')
  const [room, setRoom] = useState<{ id: string; slug: string; link: string } | null>(null)

  const handleLoginSuccess = () => setState('dashboard')
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
      {state === 'dashboard' && <Dashboard onEnterRoom={handleEnterRoom} onLogout={handleLogout} />}
      {state === 'room' && room && <Room room={room} onCloseRoom={handleCloseRoom} />}
    </>
  )
}
