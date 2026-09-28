import React, { useState } from 'react'
import { ProfessorEntry } from './pages/ProfessorEntry'
// import { Login } from './pages/Login' // Desabilitado temporariamente para versão futura
import { Permissions } from './pages/Permissions'
import { Dashboard } from './pages/Dashboard'
import { Room } from './pages/Room'
import { logout, getStoredToken } from './services/auth'

type AppState = 'identify' | 'permissions' | 'dashboard' | 'room'

export default function App(): React.ReactElement {
  const [state, setState] = useState<AppState>('identify')
  const [room, setRoom] = useState<{ id: string; slug: string; link: string } | null>(null)

  const handleIdentifySuccess = async () => {
    // Se as permissões de microfone e tela já estiverem liberadas no SO, vai direto para criação da turma
    if (window.electronAPI?.checkMediaPermissions) {
      try {
        const perms = await window.electronAPI.checkMediaPermissions()
        if (perms.microphone === 'granted' && perms.screen === 'granted') {
          setState('dashboard')
          return
        }
      } catch {}
    }
    setState('permissions')
  }

  const handlePermissionsGranted = () => setState('dashboard')
  
  const handleLogout = () => {
    logout()
    setState('identify')
  }
  
  const handleEnterRoom = (roomData: { id: string; slug: string; link: string }) => {
    setRoom(roomData)
    setState('room')
    if (window.electronAPI && typeof window.electronAPI.setActiveRoom === 'function') {
      window.electronAPI.setActiveRoom({
        id: roomData.id,
        token: getStoredToken() || undefined
      })
    }
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
