/**
 * @mlab/ui — MLab Design System 2.0
 * Tokens em CSS (temas claro e escuro), fontes embutidas e componentes React.
 */
import './styles/tokens.css';
import { initTheme } from './ThemeToggle';

initTheme();

// Design Tokens
export * from './tokens';

// Components
export * from './Button';
export * from './IconButton';
export * from './TextInput';
export * from './StatusBadge';
export * from './Alert';
export * from './Card';
export * from './ThemeToggle';

// Carbon Icons Re-exports
export {
  Screen,
  Application,
  Camera,
  Microphone,
  MicrophoneOff,
  Recording,
  Chat,
  Locked,
  UserMultiple,
  Folder,
  Attachment,
  Copy,
  Checkmark,
  Settings,
  Renew,
  Play,
  Exit,
  Close,
  Maximize,
  Minimize,
  Popup,
  Download,
  Education,
  Idea,
  Security,
  Touch_1,
  Touch_1Filled,
  VolumeUp,
  VolumeMute,
  Pin,
  PinFilled,
  Cursor_1,
  Pen,
  Draw,
  ArrowUpRight,
  SquareOutline,
  Erase,
  ZoomIn,
  ColorPalette,
  Undo,
  Redo,
  TrashCan,
  Draggable,
  ChevronLeft,
} from '@carbon/icons-react';

/**
 * Decodifica com segurança as 5 entidades HTML geradas por html.EscapeString do Go
 * para exibição em nós de texto puro do React (sem usar innerHTML/dangerouslySetInnerHTML).
 */
export function decodeChatEntities(text: string): string {
  if (!text) return '';
  return text
    .replace(/&#39;|&apos;/g, "'")
    .replace(/&#34;|&quot;/g, '"')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&amp;/g, '&');
}
