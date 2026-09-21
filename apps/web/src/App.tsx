import React, { useState } from 'react'
import { Routes, Route, Navigate, useNavigate, useParams } from 'react-router-dom'
import { Join } from './pages/Join'
import { Room } from './pages/Room'

/**
 * Roteamento do web app dos alunos.
 */
export default function App(): React.ReactElement {
  const [roomData, setRoomData] = useState<{
    token: string
    roomInfo: any
    slug?: string
  } | null>(() => {
    if (typeof window !== 'undefined' && window.sessionStorage) {
      const stored = sessionStorage.getItem('active_room_data')
      if (stored) {
        try {
          return JSON.parse(stored)
        } catch {
          return null
        }
      }
    }
    return null
  })

  return (
    <Routes>
      <Route
        path="/:roomName/:professorName/entrar"
        element={<JoinRoute setRoomData={setRoomData} />}
      />
      <Route
        path="/:roomName/:professorName/ao-vivo"
        element={<RoomRoute roomData={roomData} setRoomData={setRoomData} />}
      />
      {/* Retrocompatibilidade com /sala/:slug */}
      <Route
        path="/sala/:slug/entrar"
        element={<JoinRoute setRoomData={setRoomData} />}
      />
      <Route
        path="/sala/:slug/ao-vivo"
        element={<RoomRoute roomData={roomData} setRoomData={setRoomData} />}
      />
      <Route path="*" element={<Navigate to="/" replace />} />
      <Route
        path="/"
        element={
          <Placeholder
            title="MLab"
            subtitle="Acesse via link fornecido pelo professor"
          />
        }
      />
    </Routes>
  )
}

function JoinRoute({ setRoomData }: { setRoomData: any }) {
  const navigate = useNavigate()
  const { roomName, professorName, slug } = useParams()
  const currentSlug = roomName && professorName ? `${roomName}/${professorName}` : (slug || '')
  const livePath = roomName && professorName ? `/${roomName}/${professorName}/ao-vivo` : `/sala/${slug}/ao-vivo`

  return (
    <Join 
      onJoined={(token, roomInfo) => {
        const data = { token, roomInfo, slug: currentSlug }
        if (typeof window !== 'undefined' && window.sessionStorage) {
          sessionStorage.setItem('active_room_data', JSON.stringify(data))
        }
        setRoomData(data)
        navigate(livePath)
      }}
    />
  )
}

function RoomRoute({ roomData, setRoomData }: { roomData: any, setRoomData: any }) {
  const navigate = useNavigate()
  const { roomName, professorName, slug } = useParams()
  const currentSlug = roomName && professorName ? `${roomName}/${professorName}` : (slug || '')
  const enterPath = roomName && professorName ? `/${roomName}/${professorName}/entrar` : `/sala/${slug}/entrar`
  
  if (!roomData || roomData.slug !== currentSlug) {
    return <Navigate to={enterPath} replace />
  }

  return (
    <Room 
      token={roomData.token}
      roomInfo={roomData.roomInfo}
      onLeave={(reason?: string) => {
        if (typeof window !== 'undefined' && window.sessionStorage) {
          sessionStorage.removeItem('active_room_data')
        }
        setRoomData(null)
        navigate(enterPath, {
          state: {
            closedMessage: reason || 'A transmissão foi encerrada pelo professor. Por favor, insira suas credenciais para entrar novamente.'
          }
        })
      }}
    />
  )
}

function Placeholder({
  title,
  subtitle
}: {
  title: string
  subtitle: string
}): React.ReactElement {
  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        height: '100vh',
        fontFamily: 'system-ui, sans-serif',
        background: '#0f172a',
        color: '#f1f5f9',
        gap: '0.5rem'
      }}
    >
      <h1 style={{ fontSize: '1.75rem' }}>{title}</h1>
      <p style={{ color: '#94a3b8', fontSize: '0.875rem' }}>{subtitle}</p>
    </div>
  )
}
