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
  } | null>(null)

  return (
    <Routes>
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
            title="ScreenShare Classroom"
            subtitle="Acesse via link fornecido pelo professor"
          />
        }
      />
    </Routes>
  )
}

function JoinRoute({ setRoomData }: { setRoomData: any }) {
  const navigate = useNavigate()
  const { slug } = useParams()
  return (
    <Join 
      onJoined={(token, roomInfo) => {
        setRoomData({ token, roomInfo, slug })
        navigate(`/sala/${slug}/ao-vivo`)
      }}
    />
  )
}

function RoomRoute({ roomData, setRoomData }: { roomData: any, setRoomData: any }) {
  const navigate = useNavigate()
  const { slug } = useParams()
  
  if (!roomData || roomData.slug !== slug) {
    return <Navigate to={`/sala/${slug}/entrar`} replace />
  }

  return (
    <Room 
      token={roomData.token}
      roomInfo={roomData.roomInfo}
      onLeave={() => {
        setRoomData(null)
        navigate(`/sala/${slug}/entrar`)
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
