import React from 'react'
import { Routes, Route, Navigate } from 'react-router-dom'

/**
 * Roteamento do web app dos alunos.
 *
 * Rotas:
 *   /sala/:slug/entrar   → página Join (nome + matrícula) — T018
 *   /sala/:slug/ao-vivo  → página Room (player + chat)    — T019
 *
 * As páginas reais são implementadas em T018 e T019.
 * Este componente serve como placeholder de roteamento para o scaffold (T006).
 */
export default function App(): React.ReactElement {
  return (
    <Routes>
      <Route
        path="/sala/:slug/entrar"
        element={
          <Placeholder title="Entrar na Sala" subtitle="Identificação do aluno — T018" />
        }
      />
      <Route
        path="/sala/:slug/ao-vivo"
        element={
          <Placeholder title="Sala ao Vivo" subtitle="Player WebRTC + Chat — T019" />
        }
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
