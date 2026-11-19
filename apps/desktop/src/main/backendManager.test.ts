import { describe, it, expect, vi } from 'vitest'
import { EventEmitter } from 'events'
import type { ChildProcess } from 'child_process'
import {
  BackendManager,
  buildBackendEnv,
  isMlabBackendImage,
  parseNetstatListeningPid,
  parseTasklistCsv,
  type BackendManagerDeps,
  type BackendStartConfig
} from './backendManager'

// Testes da gestão do processo do backend (034/T3402: RF-3404, RF-3406, RF-3409).

class FakeChild extends EventEmitter {
  pid = 4321
  exitCode: number | null = null
  signalCode: NodeJS.Signals | null = null
  stdout = new EventEmitter()
  stderr = new EventEmitter()
  stdinEnded = false
  signals: string[] = []
  /** Quando true, sai sozinho ao fechar o stdin (backend com watchdog). */
  exitsOnStdinEnd = true
  stdin = Object.assign(new EventEmitter(), {
    end: () => {
      this.stdinEnded = true
      if (this.exitsOnStdinEnd) queueMicrotask(() => this.exit(0, null))
    }
  })

  kill(sig?: NodeJS.Signals): boolean {
    this.signals.push(sig ?? 'SIGTERM')
    if (sig === 'SIGKILL') queueMicrotask(() => this.exit(null, 'SIGKILL'))
    return true
  }

  exit(code: number | null, signal: NodeJS.Signals | null): void {
    if (this.exitCode !== null || this.signalCode !== null) return
    this.exitCode = code
    this.signalCode = signal
    this.emit('exit', code, signal)
  }
}

interface Harness {
  deps: BackendManagerDeps
  child: FakeChild
  logs: string[]
  spawnCalls: Array<{ command: string; options: any }>
  spawnSyncCalls: string[][]
  killedPids: number[]
}

function harness(overrides: Partial<BackendManagerDeps> = {}): Harness {
  const child = new FakeChild()
  const logs: string[] = []
  const spawnCalls: Harness['spawnCalls'] = []
  const spawnSyncCalls: string[][] = []
  const killedPids: number[] = []
  let clock = 0
  const deps: BackendManagerDeps = {
    platform: 'win32',
    spawn: (command, _args, options) => {
      spawnCalls.push({ command, options })
      return child as unknown as ChildProcess
    },
    spawnSync: (command, args) => {
      spawnSyncCalls.push([command, ...args])
      if (command === 'taskkill') queueMicrotask(() => child.exit(1, null))
      return { status: 0 }
    },
    fetchHealth: async () => false,
    execText: async () => '',
    isProcessAlive: () => false,
    killPid: (pid) => {
      killedPids.push(pid)
    },
    sleep: async (ms) => {
      clock += ms
      await new Promise((r) => setTimeout(r, 0))
    },
    now: () => clock,
    log: (m) => logs.push(m),
    ...overrides
  }
  return { deps, child, logs, spawnCalls, spawnSyncCalls, killedPids }
}

const config: BackendStartConfig = {
  binaryPath: 'C:\\MLab\\resources\\bin\\mlab-backend.exe',
  cwd: 'C:\\userData',
  env: { PORT: '8080', MLAB_PARENT_WATCHDOG: '1' }
}

const NETSTAT_EN = `
Active Connections

  Proto  Local Address          Foreign Address        State           PID
  TCP    0.0.0.0:135            0.0.0.0:0              LISTENING       1000
  TCP    0.0.0.0:8080           0.0.0.0:0              LISTENING       7777
  TCP    127.0.0.1:8080         127.0.0.1:51000        ESTABLISHED     7777
  TCP    [::]:8080              [::]:0                 LISTENING       7777
`

const NETSTAT_PT = `
Conexões ativas

  Proto  Endereço local         Endereço externo       Estado          PID
  TCP    0.0.0.0:18080          0.0.0.0:0              ESCUTANDO       1111
  TCP    0.0.0.0:8080           0.0.0.0:0              ESCUTANDO       2222
`

describe('parseNetstatListeningPid', () => {
  it('encontra o PID em LISTENING na porta exata', () => {
    expect(parseNetstatListeningPid(NETSTAT_EN, 8080)).toBe(7777)
  })
  it('aceita o estado em português (ESCUTANDO) e não confunde 18080 com 8080', () => {
    expect(parseNetstatListeningPid(NETSTAT_PT, 8080)).toBe(2222)
  })
  it('devolve null sem dono escutando', () => {
    expect(parseNetstatListeningPid(NETSTAT_EN, 9999)).toBeNull()
    expect(parseNetstatListeningPid('', 8080)).toBeNull()
  })
})

describe('parseTasklistCsv', () => {
  it('lê imagem e PID das linhas CSV', () => {
    const out = '"server.exe","7777","Console","1","12.345 K"\r\n"MLab.exe","42","Console","1","98.000 K"\r\n'
    expect(parseTasklistCsv(out)).toEqual([
      { imageName: 'server.exe', pid: 7777 },
      { imageName: 'MLab.exe', pid: 42 }
    ])
  })
  it('ignora a mensagem de nenhum processo encontrado', () => {
    expect(parseTasklistCsv('INFO: No tasks are running which match the specified criteria.\r\n')).toEqual([])
  })
})

describe('isMlabBackendImage', () => {
  it('reconhece só as imagens do MLab', () => {
    expect(isMlabBackendImage('mlab-backend.exe')).toBe(true)
    expect(isMlabBackendImage('SERVER.EXE')).toBe(true)
    expect(isMlabBackendImage('node.exe')).toBe(false)
    expect(isMlabBackendImage(undefined)).toBe(false)
  })
})

describe('buildBackendEnv', () => {
  it('monta o ambiente do contrato', () => {
    const env = buildBackendEnv({ base: { MLAB_HOST_KEY: 'k' }, webDir: '/web', parentPid: 99, logFile: '/logs/mlab-backend.log' })
    expect(env).toMatchObject({
      MLAB_HOST_KEY: 'k',
      PORT: '8080',
      WEB_PORT: '8080',
      WEB_DIR: '/web',
      MLAB_PARENT_WATCHDOG: '1',
      MLAB_PARENT_PID: '99',
      MLAB_LOG_FILE: '/logs/mlab-backend.log'
    })
  })
  it('omite MLAB_LOG_FILE sem caminho', () => {
    expect(buildBackendEnv({ base: {}, webDir: '/web', parentPid: 1 })).not.toHaveProperty('MLAB_LOG_FILE')
  })
})

describe('BackendManager.start', () => {
  it('inicia com stdio em pipe e o ambiente recebido', async () => {
    const h = harness()
    const m = new BackendManager(h.deps)
    expect(await m.start(config)).toBe('started')
    expect(h.spawnCalls).toHaveLength(1)
    expect(h.spawnCalls[0].command).toBe(config.binaryPath)
    expect(h.spawnCalls[0].options.stdio).toEqual(['pipe', 'pipe', 'pipe'])
    expect(h.spawnCalls[0].options.env).toBe(config.env)
    expect(h.spawnCalls[0].options.windowsHide).toBe(true)
    expect(m.pid).toBe(4321)
  })

  it('não chama spawn se o encerramento começar durante a checagem da porta (RF-3406)', async () => {
    let m!: BackendManager
    const h = harness({
      fetchHealth: async () => {
        void m.stop()
        return false
      }
    })
    m = new BackendManager(h.deps)
    expect(await m.start(config)).toBe('aborted')
    expect(h.spawnCalls).toHaveLength(0)
  })

  it('stop() antes de start() impede partidas futuras', async () => {
    const h = harness()
    const m = new BackendManager(h.deps)
    await m.stop()
    expect(await m.start(config)).toBe('aborted')
    expect(h.spawnCalls).toHaveLength(0)
  })

  it('sem binário devolve not-found sem spawn', async () => {
    const h = harness()
    expect(await new BackendManager(h.deps).start({ ...config, binaryPath: null })).toBe('not-found')
    expect(h.spawnCalls).toHaveLength(0)
  })

  it('reproduz stdout/stderr do backend no log', async () => {
    const h = harness()
    await new BackendManager(h.deps).start(config)
    h.child.stdout.emit('data', Buffer.from('escutando em :8080\n'))
    h.child.stderr.emit('data', Buffer.from('falhou\n'))
    expect(h.logs).toContain('[Backend] escutando em :8080')
    expect(h.logs).toContain('[Backend ERR] falhou')
  })
})

describe('BackendManager.start com a porta ocupada (RF-3409)', () => {
  function busyPort(image: string, opts: Partial<BackendManagerDeps> = {}): Harness {
    let alive = true
    const h = harness({
      fetchHealth: async () => alive,
      execText: async (command) => {
        if (command === 'netstat') return NETSTAT_EN
        if (command === 'tasklist') return `"${image}","7777","Console","1","10.000 K"\r\n`
        return ''
      },
      isProcessAlive: () => alive,
      killPid: (pid) => {
        h.killedPids.push(pid)
        alive = false
      },
      ...opts
    })
    return h
  }

  it.each(['mlab-backend.exe', 'server.exe'])('Windows: encerra o órfão %s, aguarda a porta e inicia', async (image) => {
    const h = busyPort(image)
    expect(await new BackendManager(h.deps).start(config)).toBe('started')
    expect(h.killedPids).toEqual([7777])
    expect(h.spawnCalls).toHaveLength(1)
  })

  it('Windows: programa de terceiros na porta não é encerrado', async () => {
    const h = busyPort('node.exe')
    expect(await new BackendManager(h.deps).start(config)).toBe('port-busy')
    expect(h.killedPids).toEqual([])
    expect(h.spawnCalls).toHaveLength(0)
    expect(h.logs.some((l) => l.includes('não é backend do MLab'))).toBe(true)
  })

  it('Windows: dono não identificado não é encerrado', async () => {
    const h = busyPort('server.exe', { execText: async () => '' })
    expect(await new BackendManager(h.deps).start(config)).toBe('port-busy')
    expect(h.killedPids).toEqual([])
  })

  it.each(['linux', 'darwin'] as const)('%s: só registra o conflito', async (platform) => {
    const h = busyPort('server', { platform })
    expect(await new BackendManager(h.deps).start(config)).toBe('port-busy')
    expect(h.killedPids).toEqual([])
    expect(h.spawnCalls).toHaveLength(0)
    expect(h.logs.some((l) => l.includes('nenhum processo foi encerrado'))).toBe(true)
  })

  it('porta que não libera devolve port-busy', async () => {
    const h = busyPort('mlab-backend.exe', { killPid: (pid) => h.killedPids.push(pid) })
    expect(await new BackendManager(h.deps).start(config)).toBe('port-busy')
    expect(h.spawnCalls).toHaveLength(0)
  })
})

describe('BackendManager.stop (RF-3404)', () => {
  it('fecha o stdin e aguarda a saída voluntária sem forçar', async () => {
    const h = harness()
    const m = new BackendManager(h.deps)
    await m.start(config)
    await m.stop()
    expect(h.child.stdinEnded).toBe(true)
    expect(h.spawnSyncCalls).toEqual([])
    expect(h.child.signals).toEqual([])
  })

  it('Windows: sem saída em 2 s força taskkill /pid /f /t síncrono', async () => {
    const h = harness()
    h.child.exitsOnStdinEnd = false
    const m = new BackendManager(h.deps)
    await m.start(config)
    await m.stop()
    expect(h.spawnSyncCalls).toEqual([['taskkill', '/pid', '4321', '/f', '/t']])
    expect(h.child.exitCode).toBe(1)
  })

  it('Unix: sem saída envia SIGTERM e depois SIGKILL', async () => {
    const h = harness({ platform: 'linux' })
    h.child.exitsOnStdinEnd = false
    const m = new BackendManager(h.deps)
    await m.start(config)
    await m.stop()
    expect(h.child.signals).toEqual(['SIGTERM', 'SIGKILL'])
    expect(h.spawnSyncCalls).toEqual([])
  })

  it('Unix: SIGTERM atendido dispensa o SIGKILL', async () => {
    const h = harness({ platform: 'darwin' })
    h.child.exitsOnStdinEnd = false
    const kill = h.child.kill.bind(h.child)
    h.child.kill = (sig?: NodeJS.Signals) => {
      const r = kill(sig)
      if (sig === 'SIGTERM') queueMicrotask(() => h.child.exit(null, 'SIGTERM'))
      return r
    }
    const m = new BackendManager(h.deps)
    await m.start(config)
    await m.stop()
    expect(h.child.signals).toEqual(['SIGTERM'])
  })

  it('é idempotente', async () => {
    const h = harness()
    h.child.exitsOnStdinEnd = false
    const m = new BackendManager(h.deps)
    await m.start(config)
    const a = m.stop()
    const b = m.stop()
    expect(a).toBe(b)
    await a
    expect(h.spawnSyncCalls).toHaveLength(1)
  })
})

describe('BackendManager.forceKillSync', () => {
  it('Windows: taskkill síncrono e bloqueia novas partidas', async () => {
    const h = harness()
    const m = new BackendManager(h.deps)
    await m.start(config)
    m.forceKillSync()
    expect(h.spawnSyncCalls).toEqual([['taskkill', '/pid', '4321', '/f', '/t']])
    expect(m.isStopping).toBe(true)
  })

  it('Unix: SIGKILL', async () => {
    const h = harness({ platform: 'linux' })
    const m = new BackendManager(h.deps)
    await m.start(config)
    m.forceKillSync()
    expect(h.child.signals).toEqual(['SIGKILL'])
  })

  it('sem processo vivo não faz nada', () => {
    const h = harness()
    new BackendManager(h.deps).forceKillSync()
    expect(h.spawnSyncCalls).toEqual([])
  })
})

describe('diagnóstico (034/T3406: RF-3413, RNF-3402)', () => {
  it('o tasklist do diagnóstico não atrasa o spawn', async () => {
    const execText = vi.fn(() => new Promise<string>(() => {})) // tasklist que nunca responde
    const h = harness({ execText })
    expect(await new BackendManager(h.deps).start(config)).toBe('started')
    expect(execText).toHaveBeenCalledWith('tasklist', ['/FO', 'CSV', '/NH'])
    expect(h.spawnCalls).toHaveLength(1)
  })

  it('nenhum log contém a chave de host nem o JWT_SECRET', async () => {
    const secrets = { MLAB_HOST_KEY: 'chave-host-super-secreta', JWT_SECRET: 'jwt-super-secreto' }
    const h = harness({
      fetchHealth: async () => true,
      execText: async (command) =>
        command === 'netstat' ? NETSTAT_EN : '"node.exe","7777","Console","1","10.000 K"\r\n'
    })
    const env = buildBackendEnv({ base: secrets, webDir: '/web', parentPid: 1, logFile: '/logs/mlab-backend.log' })
    const m = new BackendManager(h.deps)
    await m.start({ ...config, env }) // porta de terceiros: registra o dono
    const h2 = harness()
    h2.child.exitsOnStdinEnd = false
    const m2 = new BackendManager(h2.deps)
    await m2.start({ ...config, env })
    h2.child.stderr.emit('data', Buffer.from('backend escutando\n'))
    await m2.stop()
    m2.forceKillSync()

    const all = [...h.logs, ...h2.logs].join('\n')
    expect(all.length).toBeGreaterThan(0)
    expect(all).not.toContain(secrets.MLAB_HOST_KEY)
    expect(all).not.toContain(secrets.JWT_SECRET)
  })
})

describe('BackendManager.logProcessSnapshot', () => {
  it('Windows: lista só os backends do MLab', async () => {
    const h = harness({
      execText: vi.fn(async () => '"mlab-backend.exe","10","Console","1","1 K"\r\n"chrome.exe","11","Console","1","1 K"\r\n"server.exe","12","Console","1","1 K"\r\n')
    })
    await new BackendManager(h.deps).logProcessSnapshot()
    expect(h.logs).toContain('[Backend] Processos de backend do MLab no Windows: mlab-backend.exe:10, server.exe:12')
  })

  it('fora do Windows não executa nada', async () => {
    const execText = vi.fn(async () => '')
    await new BackendManager(harness({ platform: 'linux', execText }).deps).logProcessSnapshot()
    expect(execText).not.toHaveBeenCalled()
  })
})

// ── 053: detecção de queda e de travamento, reinício e estados (RF-5301 a RF-5304) ─────────────────

interface RecoveryHarness {
  deps: BackendManagerDeps
  children: Array<FakeChild & { healthy: boolean }>
  spawnCalls: Array<{ command: string; options: any }>
  logs: string[]
  /** O que o próximo processo faz ao subir. */
  next: { healthy: boolean; exitsAtOnce: boolean }
}

function recoveryHarness(): RecoveryHarness {
  const children: RecoveryHarness['children'] = []
  const spawnCalls: RecoveryHarness['spawnCalls'] = []
  const logs: string[] = []
  const next = { healthy: true, exitsAtOnce: false }
  let clock = 0
  const current = (): (FakeChild & { healthy: boolean }) | undefined => children[children.length - 1]
  const deps: BackendManagerDeps = {
    platform: 'win32',
    spawn: (command, _args, options) => {
      spawnCalls.push({ command, options })
      const child = Object.assign(new FakeChild(), { healthy: next.healthy })
      child.pid = 5000 + children.length
      children.push(child)
      if (next.exitsAtOnce) queueMicrotask(() => child.exit(2, null))
      return child as unknown as ChildProcess
    },
    spawnSync: (command) => {
      if (command === 'taskkill') {
        const c = current()
        queueMicrotask(() => c?.exit(1, null))
      }
      return { status: 0 }
    },
    fetchHealth: async () => {
      const c = current()
      return !!c && c.exitCode === null && c.signalCode === null && c.healthy
    },
    execText: async () => '',
    isProcessAlive: () => false,
    killPid: () => {},
    sleep: async (ms) => {
      clock += ms
      await new Promise((r) => setTimeout(r, 0))
    },
    now: () => clock,
    log: (m) => logs.push(m)
  }
  return { deps, children, spawnCalls, logs, next }
}

describe('BackendManager: queda e reinício (053)', () => {
  it('saída inesperada: avisa down, reinicia com a mesma configuração e avisa up (RF-5301, RF-5303)', async () => {
    const h = recoveryHarness()
    const statuses: string[] = []
    const m = new BackendManager(h.deps, (s) => statuses.push(s))
    expect(await m.start(config)).toBe('started')

    h.children[0].exit(2, null)

    await vi.waitFor(() => expect(statuses).toEqual(['down', 'restarting', 'up']))
    expect(h.spawnCalls).toHaveLength(2)
    expect(h.spawnCalls[1].command).toBe(config.binaryPath)
    expect(h.spawnCalls[1].options.env).toBe(config.env)
    expect(m.pid).toBe(h.children[1].pid)
    await m.stop()
  })

  it('travamento: 3 falhas do /health depois de armado forçam o encerramento e o reinício (RF-5302)', async () => {
    const h = recoveryHarness()
    const statuses: string[] = []
    const m = new BackendManager(h.deps, (s) => statuses.push(s))
    await m.start(config)
    await vi.waitFor(() => expect(h.logs).toContain('[Backend] Vigia do /health armado'))

    h.children[0].healthy = false // processo vivo, sem responder

    await vi.waitFor(() => expect(statuses).toEqual(['down', 'restarting', 'up']))
    expect(h.logs.filter((l) => l.startsWith('[Backend] /health sem resposta'))).toHaveLength(3)
    expect(h.logs.some((l) => l.includes('Backend travado'))).toBe(true)
    expect(h.logs.some((l) => l.includes('Queda do backend') && l.includes('sem resposta ao /health'))).toBe(true)
    expect(h.children[0].exitCode).toBe(1)
    expect(h.spawnCalls).toHaveLength(2)
    await m.stop()
  })

  it('o vigia não arma sem /health OK: falhas na partida não derrubam o processo (RNF-5302)', async () => {
    const h = recoveryHarness()
    h.next.healthy = false
    const statuses: string[] = []
    const m = new BackendManager(h.deps, (s) => statuses.push(s))
    await m.start(config)
    await vi.waitFor(() => expect(h.logs.some((l) => l.includes('vigia de travamento desligado'))).toBe(true))
    expect(statuses).toEqual([])
    expect(h.children[0].exitCode).toBeNull()
    await m.stop()
  })

  it('desiste depois de 3 reinícios em 60 s e avisa failed (RF-5303)', async () => {
    const h = recoveryHarness()
    const statuses: string[] = []
    const m = new BackendManager(h.deps, (s) => statuses.push(s))
    await m.start(config)
    h.next.exitsAtOnce = true // todo processo novo cai logo ao subir

    h.children[0].exit(2, null)

    await vi.waitFor(() => expect(statuses[statuses.length - 1]).toBe('failed'))
    expect(h.spawnCalls).toHaveLength(1 + 3)
    expect(statuses.filter((s) => s === 'restarting')).toHaveLength(3)
    expect(statuses).not.toContain('up')
  })

  it('partida do reinício que falha avisa failed (RF-5303)', async () => {
    const h = recoveryHarness()
    const statuses: string[] = []
    const m = new BackendManager(h.deps, (s) => statuses.push(s))
    await m.start(config)
    h.deps.spawn = () => {
      throw new Error('ENOENT')
    }

    h.children[0].exit(2, null)

    await vi.waitFor(() => expect(statuses).toEqual(['down', 'restarting', 'failed']))
  })

  it('não reinicia depois de stop() nem de forceKillSync() (RF-5303, RNF-5305)', async () => {
    const h = recoveryHarness()
    const statuses: string[] = []
    const m = new BackendManager(h.deps, (s) => statuses.push(s))
    await m.start(config)
    await m.stop()
    expect(h.children[0].exitCode).toBe(0)

    const h2 = recoveryHarness()
    const m2 = new BackendManager(h2.deps, (s) => statuses.push(s))
    await m2.start(config)
    m2.forceKillSync()
    await vi.waitFor(() => expect(h2.children[0].exitCode).toBe(1))
    await new Promise((r) => setTimeout(r, 20))

    expect(statuses).toEqual([])
    expect(h.spawnCalls).toHaveLength(1)
    expect(h2.spawnCalls).toHaveLength(1)
  })
})
