import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { TlsGate } from './TlsGate'
import * as tlsService from '../services/tls'

vi.mock('../services/tls', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../services/tls')>()
  return {
    ...actual,
    fetchTlsInfo: vi.fn(),
    probeHttps: vi.fn(),
  }
})

const enabledInfo = {
  enabled: true,
  port: '8443',
  fingerprint: 'A1B2 C3D4 E5F6 0718',
  ca_url: '/mlab-ca.crt',
}

describe('TlsGate (011, RF-1106/RF-1107)', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('redireciona para https quando o aparelho já confia na CA', async () => {
    ;(tlsService.fetchTlsInfo as any).mockResolvedValue(enabledInfo)
    ;(tlsService.probeHttps as any).mockResolvedValue(true)
    const navigate = vi.fn()

    render(
      <TlsGate navigate={navigate}>
        <p>conteudo da aula</p>
      </TlsGate>,
    )

    await waitFor(() => expect(navigate).toHaveBeenCalledTimes(1))
    expect(navigate.mock.calls[0][0]).toMatch(/^https:\/\/localhost:8443\//)
    expect(screen.queryByText('conteudo da aula')).not.toBeInTheDocument()
  })

  it('mostra a instalação quando o aparelho não confia e "Continuar com HTTPS" testa de novo', async () => {
    ;(tlsService.fetchTlsInfo as any).mockResolvedValue(enabledInfo)
    ;(tlsService.probeHttps as any).mockResolvedValueOnce(false).mockResolvedValueOnce(false).mockResolvedValueOnce(true)
    const navigate = vi.fn()

    render(
      <TlsGate navigate={navigate}>
        <p>conteudo da aula</p>
      </TlsGate>,
    )

    expect(await screen.findByText('Conexão segura do MLab')).toBeInTheDocument()
    expect(screen.getByTestId('ca-fingerprint')).toHaveTextContent('A1B2 C3D4 E5F6 0718')
    expect(screen.getByTestId('download-ca')).toHaveAttribute('href', '/mlab-ca.crt')
    expect(screen.getByTestId('install-steps').children.length).toBeGreaterThan(0)
    expect(screen.queryByText('conteudo da aula')).not.toBeInTheDocument()

    const button = screen.getByRole('button', { name: /Continuar com HTTPS/i })
    fireEvent.click(button)
    expect(await screen.findByText(/ainda não confia no certificado/i)).toBeInTheDocument()
    expect(navigate).not.toHaveBeenCalled()

    fireEvent.click(screen.getByRole('button', { name: /Continuar com HTTPS/i }))
    await waitFor(() => expect(navigate).toHaveBeenCalledTimes(1))
    expect(tlsService.probeHttps).toHaveBeenCalledTimes(3)
  })

  it('segue o app normalmente quando o HTTPS não está ativo', async () => {
    ;(tlsService.fetchTlsInfo as any).mockResolvedValue({ enabled: false })
    render(
      <TlsGate navigate={vi.fn()}>
        <p>conteudo da aula</p>
      </TlsGate>,
    )
    expect(await screen.findByText('conteudo da aula')).toBeInTheDocument()
    expect(tlsService.probeHttps).not.toHaveBeenCalled()
  })

  it('segue o app normalmente quando /tls/info falha', async () => {
    ;(tlsService.fetchTlsInfo as any).mockResolvedValue(null)
    render(
      <TlsGate navigate={vi.fn()}>
        <p>conteudo da aula</p>
      </TlsGate>,
    )
    expect(await screen.findByText('conteudo da aula')).toBeInTheDocument()
  })
})
