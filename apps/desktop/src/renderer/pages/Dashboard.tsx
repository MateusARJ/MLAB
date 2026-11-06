import React, { useState, useEffect } from 'react';
import { createRoom } from '../services/room';
import { useRoomLinks } from '../hooks/useRoomLinks';
import { caCertificateUrl, getTlsInfo, type TlsInfo } from '../services/tls';
import {
  Button,
  IconButton,
  TextInput,
  StatusBadge,
  Alert,
  Copy,
  Checkmark,
  Exit,
  BrandMark,
  ThemeToggle,
  Security,
  Download,
  colors,
  typography,
} from '@mlab/ui';
import { AppInfoFooter } from '../components/AppInfoFooter';

interface DashboardProps {
  onEnterRoom: (roomData: {
    id: string;
    slug: string;
    link: string;
    ipLink?: string;
    mdnsLink?: string;
    shortIpLink?: string;
    shortMdnsLink?: string;
  }) => void;
  onLogout: () => void;
}

export const Dashboard: React.FC<DashboardProps> = ({ onEnterRoom, onLogout }) => {
  const [title, setTitle] = useState('');
  const [loading, setLoading] = useState(false);
  const [copiedMdns, setCopiedMdns] = useState(false);
  const [copiedIp, setCopiedIp] = useState(false);
  const [currentRoom, setCurrentRoom] = useState<{
    id: string;
    slug: string;
    link: string;
    ipLink?: string;
    mdnsLink?: string;
    shortIpLink?: string;
    shortMdnsLink?: string;
  } | null>(null);
  const [error, setError] = useState<string | null>(null);
  // Links com o nome mDNS realmente anunciado, relidos a cada 10 s (012, RF-127/RF-128)
  const { links, notice: linkNotice, dismissNotice } = useRoomLinks(currentRoom);
  const [tlsInfo, setTlsInfo] = useState<TlsInfo | null>(null);

  // Edição MLab HTTPS (011, RF-1108): impressão digital da CA local para os alunos conferirem.
  useEffect(() => {
    let cancelled = false;
    getTlsInfo().then((info) => {
      if (!cancelled) setTlsInfo(info);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  // Permite abrir a sala pressionando Enter assim que os links forem gerados
  useEffect(() => {
    if (!currentRoom) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        onEnterRoom({ ...currentRoom, ...links });
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [currentRoom, links, onEnterRoom]);

  const handleCreateRoom = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (!title.trim()) return;

    setLoading(true);
    try {
      const resp = await createRoom(title);
      setLoading(false);
      const roomId = resp.room_id || (resp as any).id;
      const roomLink = resp.link || (resp as any).join_url;
      const roomData = {
        id: roomId,
        slug: resp.slug,
        link: roomLink,
        ipLink: resp.ip_link,
        mdnsLink: resp.mdns_link,
        shortIpLink: resp.short_ip_link,
        shortMdnsLink: resp.short_mdns_link,
      };
      setCurrentRoom(roomData);
    } catch (err: any) {
      setLoading(false);
      setError(err.message || 'Erro ao criar sala.');
    }
  };

  const copyToClipboard = async (text: string) => {
    if (!text) return;
    try {
      if (window.electronAPI && typeof window.electronAPI.copyToClipboard === 'function') {
        await window.electronAPI.copyToClipboard(text);
      } else if (navigator?.clipboard?.writeText) {
        await navigator.clipboard.writeText(text);
      } else {
        const textArea = document.createElement('textarea');
        textArea.value = text;
        textArea.style.position = 'fixed';
        textArea.style.opacity = '0';
        document.body.appendChild(textArea);
        textArea.focus();
        textArea.select();
        document.execCommand('copy');
        document.body.removeChild(textArea);
      }
    } catch (err) {
      console.error('Erro ao copiar link:', err);
    }
  };

  const handleCopyMdns = async () => {
    const link = links.mdnsLink;
    if (!link) return;
    await copyToClipboard(link);
    setCopiedMdns(true);
    setTimeout(() => setCopiedMdns(false), 2000);
  };

  const handleCopyIp = async () => {
    const link = links.ipLink || links.link;
    if (!link) return;
    await copyToClipboard(link);
    setCopiedIp(true);
    setTimeout(() => setCopiedIp(false), 2000);
  };

  return (
    <div style={styles.container}>
      <header className="ml-topbar">
        <span className="ml-brand">
          <BrandMark size={32} title="MLab" />
          <span>MLab</span>
        </span>
        <span className="ml-spacer" />
        <ThemeToggle />
        <Button variant="ghost" size="sm" icon={<Exit size={16} />} onClick={onLogout}>
          Sair
        </Button>
      </header>

      <form
        onSubmit={currentRoom ? (e) => e.preventDefault() : handleCreateRoom}
        style={styles.pageForm}
      >
      <main style={styles.layout}>
        <div style={styles.formCol}>
          <div>
            <h1 style={styles.pageTitle}>Preparar aula</h1>
            <p style={styles.pageSub}>
              {currentRoom
                ? 'A aula foi criada. Os alunos já podem entrar e aguardar pelo link.'
                : 'Dê um nome à aula para gerar o link dos alunos.'}
            </p>
          </div>

          {error && <Alert variant="error" message={error} onClose={() => setError(null)} />}

          <section style={styles.block} aria-labelledby="prep-aula">
            <h2 id="prep-aula" style={styles.blockTitle}>Aula</h2>
            {!currentRoom ? (
              <div style={styles.form}>
                <TextInput
                  id="roomTitle"
                  label="Nome da aula"
                  type="text"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="Ex.: Algoritmos - Turma 04"
                  helperText="Os alunos veem este nome ao entrar."
                  autoFocus
                  required
                />
              </div>
            ) : (
              <div style={styles.createdRow}>
                <span style={styles.createdName}>{title}</span>
                <StatusBadge status="waiting" label="Aguardando início" />
              </div>
            )}
          </section>
        </div>

        <aside style={styles.sideCol} aria-label="Acesso dos alunos">
          <div className="ml-panel">
            <div className="ml-panel__head">
              <h2 style={styles.panelTitle}>Como os alunos entram</h2>
            </div>
            <div className="ml-panel__body" style={styles.panelBody}>
              {!currentRoom ? (
                <p style={styles.panelEmpty}>
                  Os links de acesso aparecem aqui assim que a aula for criada. Os alunos abrem no navegador do computador ou do celular, sem instalar nada.
                </p>
              ) : (
                <>
                  {linkNotice && <Alert variant="warning" message={linkNotice} onClose={dismissNotice} />}

                  {/* Link direto (mDNS): só com anúncio ativo; o nome varia por professor (mlab.local, mlab-2.local…) */}
                  {links.mdnsLink && (
                    <div style={styles.linkBlock}>
                      <span style={styles.linkTitle}>Link direto</span>
                      <div style={styles.linkRow}>
                        <TextInput readOnly value={links.mdnsLink} aria-label="Link direto" />
                        <IconButton
                          type="button"
                          variant={copiedMdns ? 'success' : 'ghost'}
                          size="md"
                          onClick={handleCopyMdns}
                          title={copiedMdns ? 'Link Fixo Copiado' : 'Copiar Link Fixo'}
                          aria-label="Copiar Link Fixo"
                        >
                          {copiedMdns ? <Checkmark size={20} /> : <Copy size={20} />}
                        </IconButton>
                      </div>
                    </div>
                  )}

                  {/* Link pelo IP */}
                  <div style={styles.linkBlock}>
                    <span style={styles.linkTitle}>Link pelo IP</span>
                    <div style={styles.linkRow}>
                      <TextInput readOnly value={links.ipLink || links.link} aria-label="Link pelo IP" />
                      <IconButton
                        type="button"
                        variant={copiedIp ? 'success' : 'ghost'}
                        size="md"
                        onClick={handleCopyIp}
                        title={copiedIp ? 'Link IP Copiado' : 'Copiar Link Direto IP'}
                        aria-label="Copiar Link Direto IP"
                      >
                        {copiedIp ? <Checkmark size={20} /> : <Copy size={20} />}
                      </IconButton>
                    </div>
                    <span className="ml-hint">
                      {links.mdnsLink
                        ? 'Use se o link direto não abrir em algum computador.'
                        : 'Funciona em qualquer dispositivo conectado à rede local.'}
                    </span>
                  </div>
                </>
              )}
            </div>
          </div>

          {tlsInfo?.fingerprint && (
            <section
              className="ml-panel"
              data-testid="https-card"
              aria-labelledby="https-card-title"
            >
              <div className="ml-panel__head" style={styles.httpsHeader}>
                <Security size={18} style={{ color: colors.accent, flexShrink: 0 }} />
                <h2 id="https-card-title" style={styles.panelTitle}>
                  HTTPS na rede local
                </h2>
              </div>
              <div className="ml-panel__body" style={styles.panelBody}>
                <p style={styles.panelEmpty}>
                  Na primeira vez, cada aluno instala o certificado do MLab no aparelho. O link da sala mostra o passo a
                  passo e depois abre a aula em HTTPS. Peça para conferirem esta impressão digital:
                </p>
                <code data-testid="https-fingerprint" style={styles.httpsFingerprint}>
                  {tlsInfo.fingerprint}
                </code>
                <a
                  href={caCertificateUrl(tlsInfo)}
                  download="mlab-ca.crt"
                  data-testid="export-ca"
                  style={styles.httpsExport}
                >
                  <Download size={16} /> Exportar certificado (para a TI do laboratório)
                </a>
              </div>
            </section>
          )}
        </aside>
      </main>

      <div style={styles.actionBar}>
        <div style={styles.actionBarInner}>
          <span style={styles.actionSummary}>
            {currentRoom ? 'Próximo passo: escolher o que transmitir.' : 'Você escolhe a tela, a qualidade e a gravação no próximo passo.'}
          </span>
          {!currentRoom ? (
            <Button type="submit" variant="primary" size="lg" loading={loading}>
              {loading ? 'Criando Sala...' : 'Criar sala e gerar link'}
            </Button>
          ) : (
            <Button
              type="button"
              variant="primary"
              size="lg"
              onClick={() => onEnterRoom({ ...currentRoom, ...links })}
              autoFocus
            >
              Continuar <kbd style={styles.kbd}>Enter</kbd>
            </Button>
          )}
        </div>
      </div>
      </form>
      <AppInfoFooter />
    </div>
  );
};

const styles: { [key: string]: React.CSSProperties } = {
  container: {
    minHeight: '100vh',
    display: 'flex',
    flexDirection: 'column',
    backgroundColor: colors.bgBase,
    color: colors.textPrimary,
    fontFamily: typography.fontFamily,
  },
  layout: {
    flex: 1,
    width: '100%',
    maxWidth: '1100px',
    margin: '0 auto',
    padding: '32px 24px',
    display: 'grid',
    gridTemplateColumns: 'minmax(0, 1fr) minmax(340px, 480px)',
    gap: '32px',
    alignItems: 'start',
    boxSizing: 'border-box',
  },
  pageForm: { flex: 1, display: 'flex', flexDirection: 'column' },
  formCol: { display: 'flex', flexDirection: 'column', gap: '40px', minWidth: 0 },
  sideCol: { minWidth: 0, display: 'flex', flexDirection: 'column', gap: '16px' },
  httpsHeader: { display: 'flex', alignItems: 'center', gap: '8px' },
  httpsFingerprint: {
    fontFamily: 'Consolas, "Courier New", monospace',
    fontSize: '18px',
    letterSpacing: '0.08em',
    color: colors.textPrimary,
    overflowWrap: 'anywhere',
  },
  httpsExport: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: '6px',
    fontSize: 'var(--fs-small)',
    color: colors.accent,
    textDecoration: 'none',
  },
  pageTitle: { fontSize: 'var(--fs-title)', lineHeight: 1.2, fontWeight: 700, letterSpacing: '-0.01em', margin: 0 },
  pageSub: { fontSize: 'var(--fs-body)', color: colors.textSecondary, margin: '8px 0 0' },
  block: { display: 'flex', flexDirection: 'column', gap: '16px' },
  blockTitle: { fontSize: 'var(--fs-lead)', lineHeight: 1.2, fontWeight: 700, margin: 0 },
  form: { display: 'flex', flexDirection: 'column', gap: '16px' },
  createdRow: { display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: '12px' },
  createdName: { fontSize: 'var(--fs-body)', fontWeight: 600 },
  panelTitle: { fontSize: 'var(--fs-lead)', lineHeight: 1.2, fontWeight: 700, margin: 0 },
  panelBody: { display: 'flex', flexDirection: 'column', gap: '16px' },
  panelEmpty: { margin: 0, fontSize: 'var(--fs-small)', lineHeight: 1.5, color: colors.textSecondary },
  linkBlock: { display: 'flex', flexDirection: 'column', gap: '8px' },
  linkTitle: { fontSize: 'var(--fs-small)', fontWeight: 600, color: colors.textPrimary },
  linkRow: { display: 'flex', alignItems: 'center', gap: '8px' },
  actionBar: { backgroundColor: colors.surfaceCard, borderTop: `1px solid ${colors.borderSubtle}` },
  actionBarInner: {
    maxWidth: '1100px',
    margin: '0 auto',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: '16px',
    padding: '12px 24px',
    boxSizing: 'border-box',
  },
  actionSummary: { fontSize: 'var(--fs-small)', color: colors.textSecondary },
  kbd: {
    marginLeft: '4px',
    background: 'rgba(255, 255, 255, 0.16)',
    borderColor: 'rgba(255, 255, 255, 0.28)',
    color: 'inherit',
  },
};
