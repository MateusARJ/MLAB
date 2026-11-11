import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App'
import './index.css'
import { installFileDropGuard } from './utils/preventFileDropNavigation'

// Soltar arquivos fora da zona da aba Arquivos não navega a janela (018, RF-190)
installFileDropGuard(window)

ReactDOM.createRoot(document.getElementById('root') as HTMLElement).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
)
