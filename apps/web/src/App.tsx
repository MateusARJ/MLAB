import React, { useState, useEffect } from 'react'
import { Routes, Route, Navigate, useNavigate, useParams } from 'react-router-dom'
import { Join } from './pages/Join'
import { Room } from './pages/Room'
import { getActiveRoom } from './services/api'

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

  useEffect(() => {
    document.title = 'MLab'
  }, [])

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
        element={<RootRedirect />}
      />
    </Routes>
  )
}

function RootRedirect(): React.ReactElement {
  const navigate = useNavigate()
  const [loading, setLoading] = useState(true)
  const [retryCount, setRetryCount] = useState(0)

  useEffect(() => {
    let mounted = true
    let timer: any = null

    const checkActive = async () => {
      try {
        const room = await getActiveRoom()
        if (!mounted) return
        if (room && room.slug) {
          navigate(`/${room.slug}/entrar`, { replace: true })
          return
        }
      } catch {}
      if (mounted) {
        setLoading(false)
        timer = setTimeout(() => {
          if (mounted) {
            setRetryCount((prev) => prev + 1)
          }
        }, 3000)
      }
    }

    checkActive()

    return () => {
      mounted = false
      if (timer) clearTimeout(timer)
    }
  }, [navigate, retryCount])

  if (loading) {
    return (
      <Placeholder
        title="MLab"
        subtitle="Localizando sala de aula..."
      />
    )
  }

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
        gap: '1rem',
        padding: '20px',
        textAlign: 'center',
      }}
    >
      <h1 style={{ fontSize: '1.75rem', margin: 0 }}>MLab</h1>
      <p style={{ color: '#94a3b8', fontSize: '0.95rem', margin: 0, maxWidth: '400px' }}>
        Aguardando o professor iniciar a aula...
      </p>
      <button
        type="button"
        onClick={() => {
          setLoading(true)
          setRetryCount((prev) => prev + 1)
        }}
        style={{
          marginTop: '8px',
          padding: '8px 18px',
          borderRadius: '6px',
          backgroundColor: '#0f62fe',
          color: '#ffffff',
          border: 'none',
          fontSize: '14px',
          fontWeight: 600,
          cursor: 'pointer',
        }}
      >
        Verificar Novamente
      </button>
    </div>
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
