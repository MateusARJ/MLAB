import React, { useMemo, useState } from 'react'
import { Alert, Button, Download, Security, colors, radii, typography } from '@mlab/ui'
import { detectPlatform, isFirefox, type Platform, type TlsInfo } from '../services/tls'

interface CertInstallProps {
  info: TlsInfo
  /** Testa de novo a confiança e redireciona para HTTPS; devolve false se ainda não confia. */
  onContinue: () => Promise<boolean>
}

const PLATFORM_LABEL: Record<Platform, string> = {
  windows: 'Windows',
  android: 'Android',
  ios: 'iPhone / iPad',
  macos: 'macOS',
  linux: 'Linux',
  chromeos: 'Chromebook',
  other: 'Outro sistema',
}

const STEPS: Record<Platform, string[]> = {
  windows: [
    'Clique em "Baixar certificado do MLab" e abra o arquivo mlab-ca.crt.',
    'Clique em "Instalar Certificado…" e escolha "Usuário Atual".',
    'Marque "Colocar todos os certificados no repositório a seguir", clique em "Procurar" e escolha "Autoridades de Certificação Raiz Confiáveis".',
    'Clique em "Concluir" e confirme o aviso de segurança com "Sim".',
    'Feche e abra de novo o navegador e clique em "Continuar com HTTPS".',
  ],
  android: [
    'Toque em "Baixar certificado do MLab".',
    'Abra Configurações > Segurança > Mais configurações de segurança > Criptografia e credenciais > Instalar um certificado > Certificado CA (o caminho muda um pouco conforme o fabricante).',
    'Toque em "Instalar mesmo assim" e escolha o arquivo mlab-ca.crt. O Android pede que o aparelho tenha bloqueio de tela.',
    'Volte ao navegador e toque em "Continuar com HTTPS".',
  ],
  ios: [
    'Abra esta página no Safari e toque em "Baixar certificado do MLab"; aceite o download do perfil.',
    'Abra Ajustes > Geral > VPN e Gerenciamento de Dispositivo, toque no perfil "MLab CA local" e em "Instalar".',
    'Abra Ajustes > Geral > Sobre > Ajustes de Confiança de Certificados e ative o "MLab CA local".',
    'Volte ao navegador e toque em "Continuar com HTTPS".',
  ],
  macos: [
    'Clique em "Baixar certificado do MLab" e abra o arquivo mlab-ca.crt (ele entra no app Acesso às Chaves).',
    'No Acesso às Chaves, dê dois cliques em "MLab CA local", abra "Confiar" e escolha "Sempre Confiar".',
    'Feche a janela, confirme com a senha do Mac e toque em "Continuar com HTTPS".',
  ],
  linux: [
    'Clique em "Baixar certificado do MLab".',
    'No Chrome/Edge: Configurações > Privacidade e segurança > Segurança > Gerenciar certificados > Autoridades > Importar.',
    'Escolha mlab-ca.crt e marque "Confiar neste certificado para identificar sites".',
    'Volte e clique em "Continuar com HTTPS".',
  ],
  chromeos: [
    'Clique em "Baixar certificado do MLab".',
    'Configurações > Privacidade e segurança > Segurança > Gerenciar certificados > Autoridades > Importar.',
    'Escolha mlab-ca.crt, marque "Confiar neste certificado para identificar sites" e clique em "Continuar com HTTPS".',
  ],
  other: [
    'Baixe o certificado e importe-o como autoridade certificadora confiável do sistema ou do navegador.',
    'Depois toque em "Continuar com HTTPS".',
  ],
}

const FIREFOX_STEPS = [
  'O Firefox usa um repositório próprio: Configurações > Privacidade e Segurança > Certificados > Ver certificados > Autoridades > Importar.',
  'Escolha mlab-ca.crt, marque "Confiar nesta CA para identificar sites" e toque em "Continuar com HTTPS".',
]

/**
 * Página de instalação do certificado do MLab (edição MLab HTTPS — feature 011, RF-1107).
 */
export function CertInstall({ info, onContinue }: CertInstallProps): React.ReactElement {
  const ua = typeof navigator !== 'undefined' ? navigator.userAgent : ''
  const detected = useMemo(
    () => detectPlatform(ua, typeof navigator !== 'undefined' ? navigator.maxTouchPoints || 0 : 0),
    [ua],
  )
  const firefox = isFirefox(ua)
  const [platform, setPlatform] = useState<Platform>(detected)
  const [checking, setChecking] = useState(false)
  const [notTrusted, setNotTrusted] = useState(false)

  const handleContinue = async () => {
    setChecking(true)
    setNotTrusted(false)
    const ok = await onContinue()
    if (!ok) {
      setNotTrusted(true)
      setChecking(false)
    }
  }

  const steps = firefox && platform !== 'ios' ? FIREFOX_STEPS : STEPS[platform]

  return (
    <div style={styles.container}>
      <main style={styles.card}>
        <div style={styles.header}>
          <span style={styles.icon} aria-hidden="true">
            <Security size={24} />
          </span>
          <h1 style={styles.title}>Conexão segura do MLab</h1>
          <p style={styles.subtitle}>
            Para baixar os materiais da aula sem bloqueio, instale o certificado do MLab neste aparelho.
            É só na primeira vez.
          </p>
        </div>

        <section aria-labelledby="fingerprint-title" style={styles.fingerprintBox}>
          <span id="fingerprint-title" style={styles.label}>
            Confira com a tela do professor
          </span>
          <code data-testid="ca-fingerprint" style={styles.fingerprint}>
            {info.fingerprint}
          </code>
        </section>

        <a
          href={info.ca_url || '/mlab-ca.crt'}
          download="mlab-ca.crt"
          data-testid="download-ca"
          style={styles.downloadLink}
        >
          <Download size={18} /> Baixar certificado do MLab
        </a>
        <p style={styles.hint}>
          Se o navegador avisar sobre este download, escolha <strong>Manter</strong>: ele ainda não confia no MLab,
          e é exatamente isso que o certificado resolve.
        </p>

        <div style={styles.platformRow}>
          <label htmlFor="platform-select" style={styles.label}>
            Passo a passo para
          </label>
          <select
            id="platform-select"
            value={platform}
            onChange={(e) => setPlatform(e.target.value as Platform)}
            style={styles.select}
          >
            {(Object.keys(PLATFORM_LABEL) as Platform[]).map((p) => (
              <option key={p} value={p}>
                {PLATFORM_LABEL[p]}
                {p === detected ? ' (este aparelho)' : ''}
              </option>
            ))}
          </select>
        </div>

        <ol data-testid="install-steps" style={styles.steps}>
          {steps.map((step) => (
            <li key={step} style={styles.step}>
              {step}
            </li>
          ))}
        </ol>

        {notTrusted && (
          <div style={{ marginBottom: '16px' }}>
            <Alert
              variant="warning"
              message="O aparelho ainda não confia no certificado. Confira os passos, reabra o navegador e tente de novo."
            />
          </div>
        )}

        <Button variant="primary" size="lg" fullWidth loading={checking} onClick={handleContinue}>
          {checking ? 'Verificando...' : 'Continuar com HTTPS'}
        </Button>

        <p style={styles.footnote}>
          O certificado só vale para o MLab na rede local (endereços .local e IPs internos); ele não dá acesso a
          outros sites. Para remover, apague "MLab CA local" da lista de certificados do aparelho.
        </p>
      </main>
    </div>
  )
}

const styles: { [key: string]: React.CSSProperties } = {
  container: {
    minHeight: '100dvh',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.bgBase,
    color: colors.textPrimary,
    fontFamily: typography.fontFamily,
    padding: '16px',
    boxSizing: 'border-box',
  },
  card: {
    width: '100%',
    maxWidth: '520px',
    backgroundColor: colors.surfaceCardSolid,
    border: `1px solid ${colors.borderSubtle}`,
    borderRadius: radii.md,
    padding: '24px 20px',
    boxSizing: 'border-box',
  },
  header: { marginBottom: '20px' },
  icon: { color: colors.accent, display: 'inline-flex', marginBottom: '8px' },
  title: { fontSize: '22px', fontWeight: 600, margin: '0 0 8px 0' },
  subtitle: { fontSize: '14px', lineHeight: '20px', color: colors.textSecondary, margin: 0 },
  fingerprintBox: {
    display: 'flex',
    flexDirection: 'column',
    gap: '4px',
    padding: '12px',
    backgroundColor: colors.bgBase,
    border: `1px solid ${colors.borderStrong}`,
    borderRadius: radii.sm,
    marginBottom: '16px',
  },
  label: { fontSize: '12px', color: colors.textMuted },
  fingerprint: {
    fontFamily: 'Consolas, "Courier New", monospace',
    fontSize: '18px',
    letterSpacing: '0.08em',
    color: colors.textPrimary,
  },
  downloadLink: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: '8px',
    minHeight: '44px',
    border: `1px solid ${colors.accent}`,
    borderRadius: radii.sm,
    color: colors.accent,
    textDecoration: 'none',
    fontSize: '14px',
    fontWeight: 600,
  },
  hint: { fontSize: '12px', lineHeight: '18px', color: colors.textMuted, margin: '8px 0 20px 0' },
  platformRow: { display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px', flexWrap: 'wrap' },
  select: {
    flex: 1,
    minWidth: '160px',
    minHeight: '36px',
    backgroundColor: colors.bgBase,
    color: colors.textPrimary,
    border: `1px solid ${colors.borderStrong}`,
    borderRadius: radii.sm,
    padding: '0 8px',
    fontSize: '14px',
  },
  steps: {
    margin: '0 0 20px 0',
    paddingLeft: '20px',
    fontSize: '14px',
    lineHeight: '20px',
    color: colors.textSecondary,
  },
  step: { marginBottom: '8px' },
  footnote: { fontSize: '12px', lineHeight: '18px', color: colors.textMuted, margin: '16px 0 0 0' },
}
