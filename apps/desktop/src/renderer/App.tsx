import React, { useState } from 'react'
import { ProfessorEntry } from './pages/ProfessorEntry'
import { Dashboard } from './pages/Dashboard'
import { Room } from './pages/Room'
import { FloatingAnnotationOverlay } from './components/FloatingAnnotationOverlay'
import { logout, getStoredToken } from './services/auth'
import { useBackendRecovery, type RecoverableRoom } from './hooks/useBackendRecovery'

type AppState = 'identify' | 'dashboard' | 'room'

function registerActiveRoom(id: string): void {
  if (window.electronAPI && typeof window.electronAPI.setActiveRoom === 'function') {
    window.electronAPI.setActiveRoom({ id, token: getStoredToken() || undefined })
  }
}

export default function App(): React.ReactElement {
  const isOverlayWindow =
    typeof window !== 'undefined' &&
    window.location &&
    typeof window.location.search === 'string' &&
    window.location.search.includes('overlay=annotation')

  const [state, setState] = useState<AppState>('identify')
  const [room, setRoom] = useState<RecoverableRoom | null>(null)

  // Backend reiniciado (053/RF-5305): a sala é recriada no backend novo; a tela da sala continua montada.
  useBackendRecovery({
    room: state === 'room' ? room : null,
    onRoomRecreated: (recreated) => {
      setRoom(recreated)
      registerActiveRoom(recreated.id)
    }
  })

  if (isOverlayWindow) {
    return <FloatingAnnotationOverlay />
  }

  const handleIdentifySuccess = () => {
    setState('dashboard')
  }
  
  const handleLogout = () => {
    logout()
    setState('identify')
  }
  
  const handleEnterRoom = (roomData: RecoverableRoom) => {
    setRoom(roomData)
    setState('room')
    registerActiveRoom(roomData.id)
  }
  
  const handleCloseRoom = () => {
    if (window.electronAPI && typeof window.electronAPI.setActiveRoom === 'function') {
      window.electronAPI.setActiveRoom(null)
    }
    setRoom(null)
    setState('dashboard')
  }

  return (
    <>
      {state === 'identify' && <ProfessorEntry onSuccess={handleIdentifySuccess} />}
      {state === 'dashboard' && <Dashboard onEnterRoom={handleEnterRoom} onLogout={handleLogout} />}
      {state === 'room' && room && <Room room={room} onCloseRoom={handleCloseRoom} />}
    </>
  )
}
