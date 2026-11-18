import { screen } from 'electron';
import { containsPoint, type Point, type Rect } from '../shared/cursorVisibility';

export interface WindowSnapshot {
  cursor: Point;
  foregroundWindowId: bigint | null;
  windowUnderCursorId: bigint | null;
  targetBounds: Rect | null;
}

export interface NativeWindowTracker {
  queryWindow(targetWindowId: bigint): WindowSnapshot;
  queryTopWindowAtCursor(mlabWindowId: bigint | null): {
    cursor: Point;
    isMlabUnderCursor: boolean;
  };
  setBrowserOcclusionBypass(active: boolean): void;
  dispose(): void;
}

// ── Auxiliar para registrar structs no koffi de forma idempotente ─────────────

const registeredStructs = new Map<string, any>();

function getOrRegisterStruct(koffi: any, name: string, def: Record<string, any>) {
  const cached = registeredStructs.get(name);
  if (cached) return cached;
  try {
    const existing = typeof koffi.type === 'function' ? koffi.type(name) : koffi.resolve(name);
    registeredStructs.set(name, existing);
    return existing;
  } catch {
    const created = koffi.struct(name, def);
    registeredStructs.set(name, created);
    return created;
  }
}

// ── Implementação Windows (Win32 user32.dll + dwmapi.dll via koffi) ──────────

function createWin32Tracker(koffi: any): NativeWindowTracker | null {
  try {
    const user32 = koffi.load('user32.dll');
    const dwmapi = koffi.load('dwmapi.dll');
    const kernel32 = koffi.load('kernel32.dll');

    getOrRegisterStruct(koffi, 'POINT_MLAB', {
      x: 'int32_t',
      y: 'int32_t',
    });

    getOrRegisterStruct(koffi, 'RECT_MLAB', {
      left: 'int32_t',
      top: 'int32_t',
      right: 'int32_t',
      bottom: 'int32_t',
    });

    const WNDCLASSEXW = getOrRegisterStruct(koffi, 'WNDCLASSEXW_MLAB', {
      cbSize: 'uint32_t',
      style: 'uint32_t',
      lpfnWndProc: 'uintptr_t',
      cbClsExtra: 'int32_t',
      cbWndExtra: 'int32_t',
      hInstance: 'uintptr_t',
      hIcon: 'uintptr_t',
      hCursor: 'uintptr_t',
      hbrBackground: 'uintptr_t',
      lpszMenuName: 'uintptr_t',
      lpszClassName: 'str16',
      hIconSm: 'uintptr_t',
    });

    const GetCursorPos = user32.func('int __stdcall GetCursorPos(_Out_ POINT_MLAB *lpPoint)');
    const GetForegroundWindow = user32.func('uintptr_t __stdcall GetForegroundWindow()');
    const WindowFromPoint = user32.func('uintptr_t __stdcall WindowFromPoint(POINT_MLAB Point)');
    const GetAncestor = user32.func('uintptr_t __stdcall GetAncestor(uintptr_t hwnd, uint32_t gaFlags)');
    const GetWindowRect = user32.func('int __stdcall GetWindowRect(uintptr_t hWnd, _Out_ RECT_MLAB *lpRect)');
    const DwmGetWindowAttribute = dwmapi.func(
      'int __stdcall DwmGetWindowAttribute(uintptr_t hwnd, uint32_t dwAttribute, _Out_ RECT_MLAB *pvAttribute, uint32_t cbAttribute)'
    );
    const FindWindowW = user32.func('uintptr_t __stdcall FindWindowW(str16 lpClassName, uintptr_t lpWindowName)');
    const FindWindowExW = user32.func(
      'uintptr_t __stdcall FindWindowExW(uintptr_t hWndParent, uintptr_t hWndChildAfter, str16 lpszClass, uintptr_t lpszWindow)'
    );
    const RegisterClassExW = user32.func('uint16_t __stdcall RegisterClassExW(const WNDCLASSEXW_MLAB *lpwcx)');
    const CreateWindowExW = user32.func(
      'uintptr_t __stdcall CreateWindowExW(uint32_t dwExStyle, str16 lpClassName, str16 lpWindowName, uint32_t dwStyle, int32_t X, int32_t Y, int32_t nWidth, int32_t nHeight, uintptr_t hWndParent, uintptr_t hMenu, uintptr_t hInstance, uintptr_t lpParam)'
    );
    const DestroyWindow = user32.func('int __stdcall DestroyWindow(uintptr_t hWnd)');
    const NotifyWinEvent = user32.func(
      'void __stdcall NotifyWinEvent(uint32_t event, uintptr_t hwnd, int32_t idObject, int32_t idChild)'
    );
    const GetModuleHandleW = kernel32.func('uintptr_t __stdcall GetModuleHandleW(str16 lpModuleName)');
    const GetProcAddress = kernel32.func('uintptr_t __stdcall GetProcAddress(uintptr_t hModule, str lpProcName)');

    const GA_ROOT = 2;
    const DWMWA_EXTENDED_FRAME_BOUNDS = 9;
    const EVENT_OBJECT_SHOW = 0x8002;
    const EVENT_OBJECT_HIDE = 0x8003;
    const OBJID_WINDOW = 0;
    const CHILDID_SELF = 0;

    let dummyThumbHwnd: bigint = 0n;
    let ownsDummyWindow = false;
    let bypassActive = false;
    let lastBypassNotifyAt = 0;

    const toRootHwnd = (hwnd: number | bigint): bigint | null => {
      const h = BigInt(hwnd || 0);
      if (h <= 0n) return null;
      const root = BigInt(GetAncestor(h, GA_ROOT) || 0);
      return root > 0n ? root : h;
    };

    const readCursor = (): Point => {
      const pt = { x: 0, y: 0 };
      if (GetCursorPos(pt)) {
        return { x: pt.x, y: pt.y };
      }
      const fallback = screen.getCursorScreenPoint();
      return { x: fallback.x, y: fallback.y };
    };

    const readWindowBounds = (hwnd: bigint): Rect | null => {
      if (hwnd <= 0n) return null;
      const rect = { left: 0, top: 0, right: 0, bottom: 0 };
      const hr = DwmGetWindowAttribute(hwnd, DWMWA_EXTENDED_FRAME_BOUNDS, rect, 16);
      if (hr === 0 && rect.right > rect.left && rect.bottom > rect.top) {
        return {
          x: rect.left,
          y: rect.top,
          w: rect.right - rect.left,
          h: rect.bottom - rect.top,
        };
      }
      if (GetWindowRect(hwnd, rect) && rect.right > rect.left && rect.bottom > rect.top) {
        return {
          x: rect.left,
          y: rect.top,
          w: rect.right - rect.left,
          h: rect.bottom - rect.top,
        };
      }
      return null;
    };

    const ensureThumbHwnd = (): bigint => {
      if (dummyThumbHwnd > 0n) return dummyThumbHwnd;
      try {
        const tray = BigInt(FindWindowW('Shell_TrayWnd', 0) || 0);
        if (tray > 0n) {
          const existing = BigInt(FindWindowExW(tray, 0, 'TaskListThumbnailWnd', 0) || 0);
          if (existing > 0n) {
            dummyThumbHwnd = existing;
            ownsDummyWindow = false;
            return dummyThumbHwnd;
          }
        }
        const topExisting = BigInt(FindWindowW('TaskListThumbnailWnd', 0) || 0);
        if (topExisting > 0n) {
          dummyThumbHwnd = topExisting;
          ownsDummyWindow = false;
          return dummyThumbHwnd;
        }

        const user32Mod = BigInt(GetModuleHandleW('user32.dll') || 0);
        const defWndProc = user32Mod > 0n ? BigInt(GetProcAddress(user32Mod, 'DefWindowProcW') || 0) : 0n;
        const hInst = BigInt(GetModuleHandleW(null) || 0);
        if (defWndProc > 0n) {
          RegisterClassExW({
            cbSize: koffi.sizeof(WNDCLASSEXW),
            style: 0,
            lpfnWndProc: defWndProc,
            cbClsExtra: 0,
            cbWndExtra: 0,
            hInstance: hInst,
            hIcon: 0,
            hCursor: 0,
            hbrBackground: 0,
            lpszMenuName: 0,
            lpszClassName: 'TaskListThumbnailWnd',
            hIconSm: 0,
          });
          const created = BigInt(
            CreateWindowExW(
              0x00000080, // WS_EX_TOOLWINDOW
              'TaskListThumbnailWnd',
              '',
              0x80000000, // WS_POPUP (hidden)
              -32000,
              -32000,
              1,
              1,
              0,
              0,
              hInst,
              0
            ) || 0
          );
          if (created > 0n) {
            dummyThumbHwnd = created;
            ownsDummyWindow = true;
          }
        }
      } catch {
        // Ignora silenciosamente caso o SO restrinja a criação
      }
      return dummyThumbHwnd;
    };

    const setBrowserOcclusionBypass = (active: boolean): void => {
      try {
        if (active) {
          const now = Date.now();
          if (!bypassActive || now - lastBypassNotifyAt >= 1000) {
            const h = ensureThumbHwnd();
            if (h > 0n) {
              NotifyWinEvent(EVENT_OBJECT_SHOW, h, OBJID_WINDOW, CHILDID_SELF);
              bypassActive = true;
              lastBypassNotifyAt = now;
            }
          }
        } else if (bypassActive) {
          if (dummyThumbHwnd > 0n) {
            NotifyWinEvent(EVENT_OBJECT_HIDE, dummyThumbHwnd, OBJID_WINDOW, CHILDID_SELF);
          }
          bypassActive = false;
          lastBypassNotifyAt = 0;
        }
      } catch {}
    };

    return {
      queryWindow(targetWindowId: bigint): WindowSnapshot {
        setBrowserOcclusionBypass(true);
        const cursor = readCursor();
        const fgRaw = GetForegroundWindow();
        const underRaw = WindowFromPoint({ x: cursor.x, y: cursor.y });
        return {
          cursor,
          foregroundWindowId: toRootHwnd(fgRaw),
          windowUnderCursorId: toRootHwnd(underRaw),
          targetBounds: readWindowBounds(targetWindowId),
        };
      },
      queryTopWindowAtCursor(mlabWindowId: bigint | null) {
        const cursor = readCursor();
        const underRoot = toRootHwnd(WindowFromPoint({ x: cursor.x, y: cursor.y }));
        const isMlabUnderCursor =
          mlabWindowId !== null && mlabWindowId > 0n ? underRoot === mlabWindowId : true;
        return { cursor, isMlabUnderCursor };
      },
      setBrowserOcclusionBypass,
      dispose() {
        setBrowserOcclusionBypass(false);
        if (ownsDummyWindow && dummyThumbHwnd > 0n) {
          try {
            DestroyWindow(dummyThumbHwnd);
          } catch {}
          dummyThumbHwnd = 0n;
          ownsDummyWindow = false;
        }
      },
    };
  } catch (err) {
    console.warn('[NativeWindowTracker] Falha ao inicializar tracker Win32:', err);
    return null;
  }
}

// ── Implementação macOS (CoreGraphics + CoreFoundation via koffi) ────────────

function createMacTracker(koffi: any): NativeWindowTracker | null {
  try {
    const cg = koffi.load('/System/Library/Frameworks/CoreGraphics.framework/CoreGraphics');
    const cf = koffi.load('/System/Library/Frameworks/CoreFoundation.framework/CoreFoundation');

    const CGPoint = getOrRegisterStruct(koffi, 'CGPoint_MLAB', { x: 'double', y: 'double' });
    const CGSize = getOrRegisterStruct(koffi, 'CGSize_MLAB', { width: 'double', height: 'double' });
    getOrRegisterStruct(koffi, 'CGRect_MLAB', { origin: CGPoint, size: CGSize });

    const CGWindowListCopyWindowInfo = cg.func(
      ' uintptr_t CGWindowListCopyWindowInfo(uint32_t option, uint32_t relativeToWindow)'
    );
    const CGRectMakeWithDictionaryRepresentation = cg.func(
      'bool CGRectMakeWithDictionaryRepresentation(uintptr_t dict, _Out_ CGRect_MLAB *rect)'
    );
    const CFArrayGetCount = cf.func('intptr_t CFArrayGetCount(uintptr_t theArray)');
    const CFArrayGetValueAtIndex = cf.func('uintptr_t CFArrayGetValueAtIndex(uintptr_t theArray, intptr_t idx)');
    const CFDictionaryGetValue = cf.func('uintptr_t CFDictionaryGetValue(uintptr_t theDict, uintptr_t key)');
    const CFNumberGetValue = cf.func(
      'bool CFNumberGetValue(uintptr_t number, int32_t theType, _Out_ int64_t *valuePtr)'
    );
    const CFStringCreateWithCString = cf.func(
      'uintptr_t CFStringCreateWithCString(uintptr_t alloc, str cStr, uint32_t encoding)'
    );
    const CFRelease = cf.func('void CFRelease(uintptr_t cf)');

    const kCFStringEncodingUTF8 = 0x08000100;
    const kCFNumberSInt64Type = 4;
    const kCGWindowListOptionOnScreenOnly = 1 << 0;
    const kCGWindowListExcludeDesktopElements = 1 << 4;

    const keyWinNum = CFStringCreateWithCString(0, 'kCGWindowNumber', kCFStringEncodingUTF8);
    const keyWinLayer = CFStringCreateWithCString(0, 'kCGWindowLayer', kCFStringEncodingUTF8);
    const keyWinBounds = CFStringCreateWithCString(0, 'kCGWindowBounds', kCFStringEncodingUTF8);

    const readInt64FromDict = (dict: number | bigint, key: number | bigint): bigint | null => {
      const numRef = CFDictionaryGetValue(dict, key);
      if (!numRef) return null;
      const out = [0n];
      if (CFNumberGetValue(numRef, kCFNumberSInt64Type, out)) {
        return BigInt(out[0]);
      }
      return null;
    };

    const readBoundsFromDict = (dict: number | bigint): Rect | null => {
      const boundsRef = CFDictionaryGetValue(dict, keyWinBounds);
      if (!boundsRef) return null;
      const rect = { origin: { x: 0, y: 0 }, size: { width: 0, height: 0 } };
      if (CGRectMakeWithDictionaryRepresentation(boundsRef, rect)) {
        if (rect.size.width > 0 && rect.size.height > 0) {
          return {
            x: rect.origin.x,
            y: rect.origin.y,
            w: rect.size.width,
            h: rect.size.height,
          };
        }
      }
      return null;
    };

    const inspectWindows = (targetWindowId: bigint | null) => {
      const pt = screen.getCursorScreenPoint();
      const cursor: Point = { x: pt.x, y: pt.y };
      let foregroundWindowId: bigint | null = null;
      let windowUnderCursorId: bigint | null = null;
      let targetBounds: Rect | null = null;

      const list = CGWindowListCopyWindowInfo(
        kCGWindowListOptionOnScreenOnly | kCGWindowListExcludeDesktopElements,
        0
      );
      if (!list) {
        return { cursor, foregroundWindowId, windowUnderCursorId, targetBounds };
      }

      try {
        const count = Number(CFArrayGetCount(list));
        for (let i = 0; i < count; i++) {
          const dict = CFArrayGetValueAtIndex(list, i);
          if (!dict) continue;
          const winId = readInt64FromDict(dict, keyWinNum);
          if (winId === null) continue;
          const layer = readInt64FromDict(dict, keyWinLayer) ?? 0n;
          const bounds = readBoundsFromDict(dict);

          if (targetWindowId !== null && winId === targetWindowId && bounds) {
            targetBounds = bounds;
          }

          if (layer === 0n && bounds) {
            if (foregroundWindowId === null) {
              foregroundWindowId = winId;
            }
            if (windowUnderCursorId === null && containsPoint(bounds, cursor)) {
              windowUnderCursorId = winId;
            }
          }
        }
      } finally {
        CFRelease(list);
      }

      return { cursor, foregroundWindowId, windowUnderCursorId, targetBounds };
    };

    return {
      queryWindow(targetWindowId: bigint): WindowSnapshot {
        return inspectWindows(targetWindowId);
      },
      queryTopWindowAtCursor(mlabWindowId: bigint | null) {
        const snap = inspectWindows(null);
        const isMlabUnderCursor =
          mlabWindowId !== null && mlabWindowId > 0n
            ? snap.windowUnderCursorId === mlabWindowId
            : true;
        return { cursor: snap.cursor, isMlabUnderCursor };
      },
      setBrowserOcclusionBypass() {},
      dispose() {
        try {
          if (keyWinNum) CFRelease(keyWinNum);
          if (keyWinLayer) CFRelease(keyWinLayer);
          if (keyWinBounds) CFRelease(keyWinBounds);
        } catch {}
      },
    };
  } catch (err) {
    console.warn('[NativeWindowTracker] Falha ao inicializar tracker macOS:', err);
    return null;
  }
}

// ── Implementação Linux (X11 libX11.so.6 via koffi) ──────────────────────────

export function createLinuxX11Tracker(koffi: any): NativeWindowTracker | null {
  try {
    const x11 = koffi.load('libX11.so.6');

    getOrRegisterStruct(koffi, 'XWindowAttributes_MLAB', {
      x: 'int32_t',
      y: 'int32_t',
      width: 'int32_t',
      height: 'int32_t',
      border_width: 'int32_t',
      depth: 'int32_t',
      visual: 'uintptr_t',
      root: 'uintptr_t',
      c_class: 'int32_t',
      bit_gravity: 'int32_t',
      win_gravity: 'int32_t',
      backing_store: 'int32_t',
      backing_planes: 'ulong',
      backing_pixel: 'ulong',
      save_under: 'int32_t',
      colormap: 'uintptr_t',
      map_installed: 'int32_t',
      map_state: 'int32_t',
      all_event_masks: 'long',
      your_event_mask: 'long',
      do_not_propagate_mask: 'long',
      override_redirect: 'int32_t',
      screen: 'uintptr_t',
    });

    const XOpenDisplay = x11.func('uintptr_t XOpenDisplay(str display_name)');
    const XCloseDisplay = x11.func('int XCloseDisplay(uintptr_t display)');
    const XDefaultRootWindow = x11.func('uintptr_t XDefaultRootWindow(uintptr_t display)');
    const XQueryPointer = x11.func(
      'int XQueryPointer(uintptr_t display, uintptr_t w, _Out_ uintptr_t *root_return, _Out_ uintptr_t *child_return, _Out_ int32_t *root_x_return, _Out_ int32_t *root_y_return, _Out_ int32_t *win_x_return, _Out_ int32_t *win_y_return, _Out_ uint32_t *mask_return)'
    );
    const XGetInputFocus = x11.func(
      'int XGetInputFocus(uintptr_t display, _Out_ uintptr_t *focus_return, _Out_ int32_t *revert_to_return)'
    );
    const XQueryTree = x11.func(
      'int XQueryTree(uintptr_t display, uintptr_t w, _Out_ uintptr_t *root_return, _Out_ uintptr_t *parent_return, _Out_ uintptr_t *children_return, _Out_ uint32_t *nchildren_return)'
    );
    const XFree = x11.func('int XFree(uintptr_t data)');
    const XGetWindowAttributes = x11.func(
      'int XGetWindowAttributes(uintptr_t display, uintptr_t w, _Out_ XWindowAttributes_MLAB *window_attributes_return)'
    );
    const XTranslateCoordinates = x11.func(
      'int XTranslateCoordinates(uintptr_t display, uintptr_t src_w, uintptr_t dest_w, int32_t src_x, int32_t src_y, _Out_ int32_t *dest_x_return, _Out_ int32_t *dest_y_return, _Out_ uintptr_t *child_return)'
    );

    const dpy = XOpenDisplay(null);
    if (!dpy) return null;
    const root = XDefaultRootWindow(dpy);

    // Sobe na árvore X11 a partir de `win` para verificar se `ancestor` é ancestral (ex: frame do WM)
    const isDescendantOrEqual = (win: bigint, ancestor: bigint): boolean => {
      if (win <= 0n || ancestor <= 0n) return false;
      if (win === ancestor) return true;
      let curr = win;
      for (let depth = 0; depth < 12; depth++) {
        const rootRet = [0n];
        const parentRet = [0n];
        const childrenRet = [0n];
        const nChildren = [0];
        const ok = XQueryTree(dpy, curr, rootRet, parentRet, childrenRet, nChildren);
        if (childrenRet[0]) {
          XFree(childrenRet[0]);
        }
        if (!ok) break;
        const parent = BigInt(parentRet[0] || 0);
        if (parent === ancestor) return true;
        if (parent <= 0n || parent === BigInt(rootRet[0] || 0)) break;
        curr = parent;
      }
      return false;
    };

    const readTargetBounds = (targetXid: bigint): Rect | null => {
      if (targetXid <= 0n) return null;
      const attrs: any = {};
      if (!XGetWindowAttributes(dpy, targetXid, attrs)) return null;
      if (attrs.width <= 0 || attrs.height <= 0) return null;
      const dx = [0];
      const dy = [0];
      const child = [0n];
      if (!XTranslateCoordinates(dpy, targetXid, root, 0, 0, dx, dy, child)) return null;
      return {
        x: dx[0],
        y: dy[0],
        w: attrs.width,
        h: attrs.height,
      };
    };

    return {
      queryWindow(targetWindowId: bigint): WindowSnapshot {
        const rootRet = [0n];
        const childRet = [0n];
        const rootX = [0];
        const rootY = [0];
        const winX = [0];
        const winY = [0];
        const mask = [0];
        XQueryPointer(dpy, root, rootRet, childRet, rootX, rootY, winX, winY, mask);

        const focusRet = [0n];
        const revertRet = [0];
        XGetInputFocus(dpy, focusRet, revertRet);

        const topUnderCursor = BigInt(childRet[0] || 0);
        const focusWin = BigInt(focusRet[0] || 0);

        const underMatches =
          isDescendantOrEqual(targetWindowId, topUnderCursor) ||
          isDescendantOrEqual(topUnderCursor, targetWindowId);
        const focusMatches =
          isDescendantOrEqual(targetWindowId, focusWin) ||
          isDescendantOrEqual(focusWin, targetWindowId);

        return {
          cursor: { x: rootX[0], y: rootY[0] },
          foregroundWindowId: focusMatches ? targetWindowId : focusWin,
          windowUnderCursorId: underMatches ? targetWindowId : topUnderCursor,
          targetBounds: readTargetBounds(targetWindowId),
        };
      },
      queryTopWindowAtCursor(mlabWindowId: bigint | null) {
        const rootRet = [0n];
        const childRet = [0n];
        const rootX = [0];
        const rootY = [0];
        const winX = [0];
        const winY = [0];
        const mask = [0];
        XQueryPointer(dpy, root, rootRet, childRet, rootX, rootY, winX, winY, mask);
        const topUnderCursor = BigInt(childRet[0] || 0);
        const isMlabUnderCursor =
          mlabWindowId !== null && mlabWindowId > 0n
            ? isDescendantOrEqual(mlabWindowId, topUnderCursor) ||
              isDescendantOrEqual(topUnderCursor, mlabWindowId)
            : true;
        return { cursor: { x: rootX[0], y: rootY[0] }, isMlabUnderCursor };
      },
      setBrowserOcclusionBypass() {},
      dispose() {
        try {
          XCloseDisplay(dpy);
        } catch {}
      },
    };
  } catch (err) {
    console.warn('[NativeWindowTracker] Falha ao inicializar tracker X11:', err);
    return null;
  }
}

export function createNativeWindowTracker(): NativeWindowTracker | null {
  try {
    // Carregamento dinâmico para isolar falhas e permitir testes sem binário nativo
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const koffi = require('koffi');
    if (process.platform === 'win32') {
      return createWin32Tracker(koffi);
    }
    if (process.platform === 'darwin') {
      return createMacTracker(koffi);
    }
    if (process.platform === 'linux') {
      return createLinuxX11Tracker(koffi);
    }
    return null;
  } catch (err) {
    console.warn('[NativeWindowTracker] koffi indisponível, operando em fallback Electron:', err);
    return null;
  }
}
