/**
 * Detector nativo global de duplo clique na tecla Ctrl (Double-tap Ctrl).
 *
 * Utiliza GetAsyncKeyState da user32.dll (Win32 via koffi) para monitorar
 * o estado físico da tecla Ctrl a cada 16ms (60 FPS) de forma global em todo o SO,
 * com custo computacional inferior a 0.001ms por ciclo.
 *
 * Se o professor pressionar a tecla Ctrl duas vezes rapidamente (<= 400ms)
 * sem outras teclas combinadas (como Ctrl+C, Ctrl+V, Ctrl+Z), dispara o callback.
 */

const VK_CONTROL = 0x11;

// Teclas comuns para checar se Ctrl faz parte de um atalho composto (ex: Ctrl+C, Ctrl+Z, Ctrl+Shift)
const OTHER_KEYS_TO_CHECK = [
  0x10, // VK_SHIFT
  0x12, // VK_MENU (Alt)
  0x5b, // VK_LWIN
  0x5c, // VK_RWIN
  0x09, // VK_TAB
  0x1b, // VK_ESCAPE
  0x20, // VK_SPACE
  0x0d, // VK_RETURN
  0x08, // VK_BACK
  0x2e, // VK_DELETE
  // Letras A-Z (0x41 .. 0x5A)
  0x41, 0x42, 0x43, 0x44, 0x45, 0x46, 0x47, 0x48, 0x49, 0x4a, 0x4b, 0x4c, 0x4d,
  0x4e, 0x4f, 0x50, 0x51, 0x52, 0x53, 0x54, 0x55, 0x56, 0x57, 0x58, 0x59, 0x5a,
  // Números 0-9 (0x30 .. 0x39)
  0x30, 0x31, 0x32, 0x33, 0x34, 0x35, 0x36, 0x37, 0x38, 0x39,
  // Setas (0x25 .. 0x28)
  0x25, 0x26, 0x27, 0x28,
];

export type GetAsyncKeyStateFn = (vKey: number) => number;

export class DoubleCtrlDetector {
  private timer: NodeJS.Timeout | null = null;
  private wasCtrlDown = false;
  private otherKeyPressed = false;
  private firstCtrlReleaseTime = 0;
  private getAsyncKeyState: GetAsyncKeyStateFn | null = null;
  private onDoubleCtrl: () => void;

  public static readonly MIN_INTERVAL_MS = 35;
  public static readonly MAX_INTERVAL_MS = 420;

  constructor(onDoubleCtrl: () => void, customGetAsyncKeyState?: GetAsyncKeyStateFn) {
    this.onDoubleCtrl = onDoubleCtrl;
    if (customGetAsyncKeyState) {
      this.getAsyncKeyState = customGetAsyncKeyState;
    } else if (process.platform === 'win32') {
      try {
        // eslint-disable-next-line @typescript-eslint/no-var-requires
        const koffi = require('koffi');
        const user32 = koffi.load('user32.dll');
        this.getAsyncKeyState = user32.func('short __stdcall GetAsyncKeyState(int vKey)');
      } catch (err) {
        console.warn('[DoubleCtrlDetector] koffi indisponível para GetAsyncKeyState:', err);
      }
    }
  }

  public isAvailable(): boolean {
    return typeof this.getAsyncKeyState === 'function';
  }

  public start(): boolean {
    this.stop();
    if (!this.isAvailable()) {
      return false;
    }

    this.timer = setInterval(() => {
      this.tick();
    }, 16);

    return true;
  }

  public stop(): void {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }
    this.wasCtrlDown = false;
    this.otherKeyPressed = false;
    this.firstCtrlReleaseTime = 0;
  }

  public dispose(): void {
    this.stop();
    this.getAsyncKeyState = null;
  }

  public tick(forcedNow?: number): boolean {
    if (!this.getAsyncKeyState) return false;

    const now = forcedNow !== undefined ? forcedNow : Date.now();
    const isCtrlDown = (this.getAsyncKeyState(VK_CONTROL) & 0x8000) !== 0;

    let anyOtherKeyDown = false;
    if (isCtrlDown) {
      for (let i = 0; i < OTHER_KEYS_TO_CHECK.length; i++) {
        if ((this.getAsyncKeyState(OTHER_KEYS_TO_CHECK[i]) & 0x8000) !== 0) {
          anyOtherKeyDown = true;
          break;
        }
      }
    }

    let triggered = false;

    if (isCtrlDown) {
      if (!this.wasCtrlDown) {
        // Transição UP -> DOWN
        this.wasCtrlDown = true;
        this.otherKeyPressed = anyOtherKeyDown;

        if (this.firstCtrlReleaseTime > 0) {
          const delta = now - this.firstCtrlReleaseTime;
          if (
            delta >= DoubleCtrlDetector.MIN_INTERVAL_MS &&
            delta <= DoubleCtrlDetector.MAX_INTERVAL_MS &&
            !anyOtherKeyDown
          ) {
            // Duplo toque detectado! Dispara imediatamente no segundo down
            this.firstCtrlReleaseTime = 0;
            triggered = true;
            try {
              this.onDoubleCtrl();
            } catch (err) {
              console.error('[DoubleCtrlDetector] Erro no callback onDoubleCtrl:', err);
            }
          } else {
            this.firstCtrlReleaseTime = 0;
          }
        }
      } else {
        // Tecla Ctrl mantida pressionada
        if (anyOtherKeyDown) {
          this.otherKeyPressed = true;
          this.firstCtrlReleaseTime = 0;
        }
      }
    } else {
      if (this.wasCtrlDown) {
        // Transição DOWN -> UP (tecla solta)
        this.wasCtrlDown = false;
        if (!this.otherKeyPressed) {
          this.firstCtrlReleaseTime = now;
        } else {
          this.firstCtrlReleaseTime = 0;
        }
        this.otherKeyPressed = false;
      }
    }

    return triggered;
  }
}
