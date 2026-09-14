import React from 'react'

/**
 * Componente raiz do app desktop.
 * O roteamento entre Login, Dashboard e Room será adicionado em T014-T016.
 */
export default function App(): React.ReactElement {
  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        height: '100vh',
        fontFamily: 'system-ui, sans-serif',
        background: '#0f172a',
        color: '#f1f5f9'
      }}
    >
      <div style={{ textAlign: 'center' }}>
        <h1 style={{ fontSize: '2rem', marginBottom: '0.5rem' }}>
          ScreenShare Classroom
        </h1>
        <p style={{ color: '#94a3b8' }}>App do Professor — Scaffold T006</p>
      </div>
    </div>
  )
}
