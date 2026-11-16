/**
 * @mlab/ui — MLab Design System 2.0
 * Tokens em CSS (temas claro e escuro), fontes embutidas e componentes React.
 */
import './styles/tokens.css';
import './styles/components.css';
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
export * from './Brand';
export * from './ThemeToggle';

// Ícones: Lucide (ISC), traço fino, um import por ícone.
// Os nomes exportados são os que as telas já usavam; cada um aponta para o ícone Lucide equivalente.
export {
  Monitor as Screen,
  AppWindow as Application,
  Camera,
  Mic as Microphone,
  MicOff as MicrophoneOff,
  CircleDot as Recording,
  MessageSquare as Chat,
  Lock as Locked,
  Users as UserMultiple,
  Folder,
  Paperclip as Attachment,
  Copy,
  Check as Checkmark,
  Settings,
  RefreshCw as Renew,
  Play,
  LogOut as Exit,
  X as Close,
  Maximize,
  Minimize,
  PictureInPicture2 as Popup,
  Download,
  GraduationCap as Education,
  Lightbulb as Idea,
  ShieldCheck as Security,
  Hand as Touch_1,
  Volume2 as VolumeUp,
  VolumeX as VolumeMute,
  Pin,
  MousePointer2 as Cursor_1,
  PenLine as Pen,
  Highlighter as Draw,
  MoveUpRight as ArrowUpRight,
  Square as SquareOutline,
  Eraser as Erase,
  ZoomIn,
  Palette as ColorPalette,
  Undo2 as Undo,
  Redo2 as Redo,
  Trash2 as TrashCan,
  GripVertical as Draggable,
  ChevronLeft,
  Pause,
  Sun,
  Moon,
  Keyboard,
  Info,
  TriangleAlert,
  Send,
  Upload,
  FileText,
  Wifi,
  PanelRightClose,
  PanelRightOpen,
} from 'lucide-react';
export { Touch_1Filled, PinFilled } from './icons';

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
