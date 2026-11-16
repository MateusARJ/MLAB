import React, { useState, useEffect } from 'react';
import { createRoom } from '../services/room';
import { useRoomLinks } from '../hooks/useRoomLinks';
import mlabLogo from '../assets/MLAB-logo.png';
import {
  Button,
  IconButton,
  TextInput,
  StatusBadge,
  Alert,
  Card,
  Copy,
  Checkmark,
  Play,
  Exit,
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
      <header style={styles.topbar}>
        <div style={styles.logoBox}>
          <img src={mlabLogo} alt="MLab Logo" style={styles.logoImg} />
          <h2 style={styles.logo}>MLab</h2>
        </div>
        <Button
          variant="danger-ghost"
          size="sm"
          icon={<Exit size={16} />}
          onClick={onLogout}
        >
          Sair
        </Button>
      </header>

      <main style={styles.content}>
        <Card
          title="Criar Nova Sala de Aula"
          subtitle="Inicie uma transmissão para sua turma de alunos"
          style={{ width: '100%', maxWidth: '520px' }}
        >
          {error && (
            <div style={{ marginBottom: '20px' }}>
              <Alert variant="error" message={error} onClose={() => setError(null)} />
            </div>
          )}

          {!currentRoom ? (
            <form onSubmit={handleCreateRoom} style={styles.form}>
              <TextInput
                id="roomTitle"
                label="Titulo / Disciplina"
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="Ex: Algoritmos - Turma 04"
                autoFocus
                required
              />
              <Button
                type="submit"
                variant="primary"
                size="lg"
                fullWidth
                loading={loading}
                icon={<Play size={18} />}
              >
                {loading ? 'Criando Sala...' : 'Criar Sala e Gerar Link'}
              </Button>
            </form>
          ) : (
            <div style={styles.roomActiveBox}>
              <div>
                <StatusBadge
                  status="waiting"
                  label="Estado: Waiting (Aguardando inicio)"
                />
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
                <span style={{ fontSize: '13px', color: colors.textSecondary, fontFamily: typography.fontFamily }}>
                  Links de Acesso dos Alunos:
                </span>

                {linkNotice && <Alert variant="warning" message={linkNotice} onClose={dismissNotice} />}

                {/* Link Fixo (mDNS): só com anúncio ativo; o nome varia por professor (mlab.local, mlab-2.local…) */}
                {links.mdnsLink && (
                <div style={styles.linkCard}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '6px' }}>
                    <span style={{ fontSize: '12px', fontWeight: 600, color: colors.textPrimary }}>
                      Link Fixo (mDNS)
                    </span>
                    <span
                      style={{
                        fontSize: '11px',
                        padding: '2px 8px',
                        borderRadius: '12px',
                        backgroundColor: 'rgba(36, 161, 72, 0.15)',
                        color: '#42be65',
                        fontWeight: 600,
                        border: '1px solid rgba(36, 161, 72, 0.3)',
                      }}
                      title="Recomendado para computadores e dispositivos com suporte a mDNS/Bonjour"
                    >
                      Fácil Acesso
                    </span>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <TextInput
                      readOnly
                      value={links.mdnsLink}
                      style={{ flex: 1 }}
                    />
                    <IconButton
                      type="button"
                      variant={copiedMdns ? 'success' : 'secondary'}
                      size="md"
                      onClick={handleCopyMdns}
                      title={copiedMdns ? 'Link Fixo Copiado' : 'Copiar Link Fixo'}
                      aria-label="Copiar Link Fixo"
                    >
                      {copiedMdns ? <Checkmark size={18} /> : <Copy size={18} />}
                    </IconButton>
                  </div>
                </div>
                )}

                {/* Link Direto (IP) */}
                <div style={styles.linkCard}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '6px' }}>
                    <span style={{ fontSize: '12px', fontWeight: 600, color: colors.textPrimary }}>
                      Link Direto (IP da Rede Local)
                    </span>
                    <span
                      style={{
                        fontSize: '11px',
                        padding: '2px 8px',
                        borderRadius: '12px',
                        backgroundColor: 'rgba(15, 98, 254, 0.15)',
                        color: '#4589ff',
                        fontWeight: 600,
                        border: '1px solid rgba(15, 98, 254, 0.3)',
                      }}
                      title="Funciona diretamente via endereço IP em qualquer dispositivo conectado à rede local"
                    >
                      Rede Local (LAN)
                    </span>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <TextInput
                      readOnly
                      value={links.ipLink || links.link}
                      style={{ flex: 1 }}
                    />
                    <IconButton
                      type="button"
                      variant={copiedIp ? 'success' : 'secondary'}
                      size="md"
                      onClick={handleCopyIp}
                      title={copiedIp ? 'Link IP Copiado' : 'Copiar Link Direto IP'}
                      aria-label="Copiar Link Direto IP"
                    >
                      {copiedIp ? <Checkmark size={18} /> : <Copy size={18} />}
                    </IconButton>
                  </div>
                </div>
              </div>

              <Button
                type="button"
                variant="success"
                size="lg"
                fullWidth
                onClick={() => onEnterRoom({ ...currentRoom, ...links })}
                icon={<Play size={20} />}
                style={{ marginTop: '12px' }}
                autoFocus
              >
                Abrir Sala de Transmissão (Enter)
              </Button>
            </div>
          )}
        </Card>
      </main>
      <AppInfoFooter />
    </div>
  );
};

const styles: { [key: string]: React.CSSProperties } = {
  container: {
    minHeight: '100vh',
    backgroundColor: colors.bgBase,
    color: colors.textPrimary,
    fontFamily: typography.fontFamily,
  },
  topbar: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: '12px 32px',
    borderBottom: `1px solid ${colors.surfaceCardSolid}`,
    backgroundColor: colors.surfaceCardSolid,
  },
  logoBox: {
    display: 'flex',
    alignItems: 'center',
    gap: '14px',
  },
  logoImg: {
    width: '46px',
    height: '46px',
    objectFit: 'contain',
  },
  logo: {
    fontSize: '20px',
    fontWeight: '700',
    color: colors.accent,
    margin: 0,
  },
  content: {
    padding: '40px 20px',
    display: 'flex',
    justifyContent: 'center',
  },
  form: {
    display: 'flex',
    flexDirection: 'column',
    gap: '20px',
  },
  roomActiveBox: {
    display: 'flex',
    flexDirection: 'column',
    gap: '18px',
  },
  linkCard: {
    backgroundColor: 'rgba(255, 255, 255, 0.03)',
    border: '1px solid rgba(255, 255, 255, 0.08)',
    borderRadius: '8px',
    padding: '12px',
  },
};
