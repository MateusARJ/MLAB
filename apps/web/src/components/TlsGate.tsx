import React, { useCallback, useEffect, useState } from 'react'
import { colors, typography } from '@mlab/ui'
import { fetchTlsInfo, httpsUrlFor, probeHttps, type TlsInfo } from '../services/tls'
import { CertInstall } from '../pages/CertInstall'

interface TlsGateProps {
  children: React.ReactNode
  /** Injetável nos testes; por padrão troca a página com location.replace. */
  navigate?: (url: string) => void
}

type GateState = { kind: 'checking' } | { kind: 'pass' } | { kind: 'install'; info: TlsInfo }

const defaultNavigate = (url: string) => window.location.replace(url)

/**
 * Edição MLab HTTPS (feature 011, RF-1106): numa página aberta por http://, consulta /tls/info. Se o HTTPS
 * estiver ativo, testa se o aparelho já confia na CA do MLab: confiando, redireciona para o mesmo caminho em
 * https://; senão, mostra a página de instalação do certificado. Em https://, sem HTTPS ativo ou com erro,
 * o app segue normalmente.
 */
export function TlsGate({ children, navigate = defaultNavigate }: TlsGateProps): React.ReactElement {
  const [state, setState] = useState<GateState>(() =>
    typeof window !== 'undefined' && window.location.protocol === 'http:' ? { kind: 'checking' } : { kind: 'pass' },
  )

  const tryHttps = useCallback(
    async (info: TlsInfo): Promise<boolean> => {
      const port = info.port || '8443'
      const ok = await probeHttps(window.location.hostname, port)
      if (ok) navigate(httpsUrlFor(window.location, port))
      return ok
    },
    [navigate],
  )

  useEffect(() => {
    if (state.kind !== 'checking') return
    let cancelled = false
    ;(async () => {
      const info = await fetchTlsInfo()
      if (cancelled) return
      if (!info?.enabled) {
        setState({ kind: 'pass' })
        return
      }
      const ok = await tryHttps(info)
      if (!cancelled && !ok) setState({ kind: 'install', info })
    })()
    return () => {
      cancelled = true
    }
    // Só na montagem: o estado inicial decide se há verificação.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  if (state.kind === 'pass') return <>{children}</>
  if (state.kind === 'install') {
    return <CertInstall info={state.info} onContinue={() => tryHttps(state.info)} />
  }
  return (
    <div
      role="status"
      style={{
        minHeight: '100dvh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: colors.bgBase,
        color: colors.textMuted,
        fontFamily: typography.fontFamily,
        fontSize: '14px',
      }}
    >
      Verificando conexão segura...
    </div>
  )
}
