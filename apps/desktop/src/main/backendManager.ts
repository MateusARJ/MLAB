// Gestão do processo do backend embarcado (034-encerramento-backend-orfao, T3402).
// Contrato: spec-kit/specs/034-encerramento-backend-orfao/contracts/backend-embarcado.md.
//
// Inicia, vigia e encerra o backend Go; trata o backend órfão que ocupa a porta (RF-3409, só Windows) e a
// corrida de fechar o app durante a partida (RF-3406). As chamadas ao SO são injetadas para os testes.

import {
  spawn as nodeSpawn,
  spawnSync as nodeSpawnSync,
  execFile,
  type ChildProcess,
  type SpawnOptions,
  type SpawnSyncOptions
} from 'child_process'
import http from 'http'

export const BACKEND_PORT = 8080

/** Tempo de espera pela saída voluntária após o stdin ser fechado (RF-3404). */
export const GRACEFUL_EXIT_MS = 2000
/** No Unix, espera entre SIGTERM e SIGKILL (RF-3404). */
export const SIGTERM_GRACE_MS = 1000
/** Espera pela confirmação da saída após o encerramento forçado (RF-3404). */
export const FORCED_EXIT_CONFIRM_MS = 1500
/** Espera pela liberação da porta após encerrar um órfão (RF-3409). */
export const ORPHAN_PORT_RELEASE_MS = 3000

/** Imagens reconhecidas como backend do MLab no Windows (C-3401 B, RF-3411). */
export const MLAB_BACKEND_IMAGES = ['mlab-backend.exe', 'server.exe']

/** Intervalo do vigia do /health (053/RF-5302, C-5302). */
export const HEALTH_INTERVAL_MS = 3000
/** Falhas seguidas do /health que caracterizam o backend travado (053/RF-5302). */
export const HEALTH_MAX_FAILURES = 3
/** Sem nenhum /health OK nesse tempo após a partida, o vigia desiste (não há como distinguir travamento). */
export const HEALTH_ARM_TIMEOUT_MS = 60000
/** Janela e limite de reinícios automáticos (053/RF-5303, C-5303). */
export const RESTART_WINDOW_MS = 60000
export const MAX_RESTARTS = 3
/** Espera pelo primeiro /health OK do backend reiniciado antes de anunciar `up`. */
export const RESTART_HEALTH_TIMEOUT_MS = 15000
export const RESTART_HEALTH_POLL_MS = 500

export type StartResult = 'started' | 'aborted' | 'port-busy' | 'not-found' | 'failed'

/** Estado do backend informado à janela do professor (053, contrato `ipc-backend-status.md`). */
export type BackendStatus = 'down' | 'restarting' | 'up' | 'failed'

export interface SpawnSyncResult {
  status: number | null
  error?: Error
}

export interface BackendManagerDeps {
  platform: NodeJS.Platform
  spawn: (command: string, args: string[], options: SpawnOptions) => ChildProcess
  spawnSync: (command: string, args: string[], options: SpawnSyncOptions) => SpawnSyncResult
  /** true quando a porta responde ao /health do MLab. */
  fetchHealth: (port: number) => Promise<boolean>
  /** Executa um comando do SO e devolve o stdout (netstat, tasklist). */
  execText: (command: string, args: string[]) => Promise<string>
  isProcessAlive: (pid: number) => boolean
  /** Encerra à força um processo que não é filho do app (órfão), de forma síncrona. */
  killPid: (pid: number) => void
  sleep: (ms: number) => Promise<void>
  now: () => number
  log: (message: string) => void
}

export interface BackendStartConfig {
  /** Caminho do binário; null quando não foi encontrado. */
  binaryPath: string | null
  cwd: string
  env: NodeJS.ProcessEnv
}

export interface BackendEnvInput {
  base: NodeJS.ProcessEnv
  webDir: string
  parentPid: number
  logFile?: string
  port?: number
}

/** Monta o ambiente do processo do backend conforme o contrato (variáveis novas e existentes). */
export function buildBackendEnv(input: BackendEnvInput): NodeJS.ProcessEnv {
  const port = String(input.port ?? BACKEND_PORT)
  const env: NodeJS.ProcessEnv = {
    ...input.base,
    PORT: port,
    WEB_PORT: port,
    // JWT_SECRET só é repassado se vier do ambiente (via base); caso contrário o backend gera um segredo
    // aleatório por execução (ADR 0006).
    WEB_DIR: input.webDir,
    MLAB_PARENT_WATCHDOG: '1',
    MLAB_PARENT_PID: String(input.parentPid)
  }
  if (input.logFile) env.MLAB_LOG_FILE = input.logFile
  return env
}

/**
 * Extrai do `netstat -ano` o PID que escuta em TCP na porta. Aceita o estado em inglês (LISTENING) e em
 * português (ESCUTANDO). Devolve null quando não encontra.
 */
export function parseNetstatListeningPid(output: string, port: number): number | null {
  const re = /^\s*TCP\s+(\S+)\s+\S+\s+(LISTENING|ESCUTANDO)\s+(\d+)\s*$/i
  for (const line of output.split(/\r?\n/)) {
    const m = re.exec(line)
    if (!m) continue
    const local = m[1]
    const localPort = Number(local.slice(local.lastIndexOf(':') + 1))
    const pid = Number(m[3])
    if (localPort === port && pid > 0) return pid
  }
  return null
}

export interface TasklistEntry {
  imageName: string
  pid: number
}

/** Interpreta `tasklist /FO CSV /NH`. Linhas sem o formato esperado (ex.: "INFO: ...") são ignoradas. */
export function parseTasklistCsv(output: string): TasklistEntry[] {
  const entries: TasklistEntry[] = []
  for (const line of output.split(/\r?\n/)) {
    const fields = [...line.matchAll(/"((?:[^"]|"")*)"/g)].map((m) => m[1].replace(/""/g, '"'))
    if (fields.length < 2) continue
    const pid = Number(fields[1])
    if (!fields[0] || !Number.isInteger(pid) || pid <= 0) continue
    entries.push({ imageName: fields[0], pid })
  }
  return entries
}

export function isMlabBackendImage(imageName: string | undefined): boolean {
  return !!imageName && MLAB_BACKEND_IMAGES.includes(imageName.toLowerCase())
}

function hasExited(child: ChildProcess): boolean {
  return child.exitCode !== null || child.signalCode !== null
}

export class BackendManager {
  private child: ChildProcess | null = null
  private stopping = false
  private stopPromise: Promise<void> | null = null
  /** Última partida pedida, reaproveitada nos reinícios (053/RF-5303). */
  private lastStart: { config: BackendStartConfig; port: number } | null = null
  /** Instantes dos reinícios recentes, para o limite de RF-5303. */
  private restarts: number[] = []
  /** Processos cuja queda já foi tratada (a saída e o vigia podem detectar a mesma queda). */
  private readonly handled = new WeakSet<ChildProcess>()
  /** Processos encerrados à força por travamento (RF-5302). */
  private readonly hung = new WeakSet<ChildProcess>()
  private recovering = false

  constructor(
    private readonly deps: BackendManagerDeps,
    private readonly onStatus: (status: BackendStatus) => void = () => {}
  ) {}

  /** true depois que o encerramento começou; nenhum backend novo é iniciado a partir daí (RF-3406). */
  get isStopping(): boolean {
    return this.stopping
  }

  get pid(): number | undefined {
    return this.child?.pid
  }

  /**
   * Inicia o backend. Aborta se o encerramento começar antes do spawn (antes e depois de cada espera).
   * Com a porta ocupada, encerra só backend do MLab (Windows) e segue; terceiros nunca são encerrados.
   */
  async start(config: BackendStartConfig, port = BACKEND_PORT): Promise<StartResult> {
    if (this.stopping) return this.abortStart('antes da checagem da porta')
    if (this.child) return 'started'

    void this.logProcessSnapshot()

    const busy = await this.deps.fetchHealth(port)
    if (this.stopping) return this.abortStart('durante a checagem da porta')
    if (busy) {
      const freed = await this.releaseOrphan(port)
      if (this.stopping) return this.abortStart('durante o tratamento do backend órfão')
      if (!freed) return 'port-busy'
    }

    if (!config.binaryPath) {
      this.deps.log('[Backend] Executável do backend não encontrado. O app aguardará servidor externo na porta 8080.')
      return 'not-found'
    }

    if (this.stopping) return this.abortStart('imediatamente antes do spawn')
    this.lastStart = { config, port }
    try {
      const child = this.deps.spawn(config.binaryPath, [], {
        cwd: config.cwd,
        detached: false,
        windowsHide: true,
        stdio: ['pipe', 'pipe', 'pipe'],
        env: config.env
      })
      this.attach(child)
      this.deps.log(`[Backend] Iniciado (PID: ${child.pid ?? 'desconhecido'}): ${config.binaryPath}`)
      void this.watchHealth(child, port)
      return 'started'
    } catch (err) {
      this.deps.log(`[Backend] Erro ao iniciar o backend: ${err}`)
      return 'failed'
    }
  }

  /**
   * Encerra o backend pela sequência do contrato (RF-3404): fecha o stdin, aguarda 2 s, força
   * (Windows `taskkill /f /t` síncrono; Unix SIGTERM e SIGKILL após 1 s) e aguarda a confirmação.
   * Idempotente; também impede partidas futuras.
   */
  stop(): Promise<void> {
    this.stopping = true
    if (!this.stopPromise) this.stopPromise = this.doStop()
    return this.stopPromise
  }

  /** Encerramento síncrono para `exit`, `session-end` e timeout global (RF-3403, RF-3405). */
  forceKillSync(): void {
    this.stopping = true
    const child = this.child
    if (!child || hasExited(child) || !child.pid) return
    this.deps.log(`[Backend] Encerramento síncrono do backend (PID: ${child.pid})`)
    this.forceKill(child)
  }

  /** Lista, no Windows, os processos de backend do MLab em execução (diagnóstico, sem bloquear a partida). */
  async logProcessSnapshot(): Promise<void> {
    if (this.deps.platform !== 'win32') return
    try {
      const out = await this.deps.execText('tasklist', ['/FO', 'CSV', '/NH'])
      const found = parseTasklistCsv(out).filter((e) => isMlabBackendImage(e.imageName))
      const list = found.map((e) => `${e.imageName}:${e.pid}`).join(', ')
      this.deps.log(`[Backend] Processos de backend do MLab no Windows: ${list || 'nenhum'}`)
    } catch (err) {
      this.deps.log(`[Backend] Aviso: não foi possível listar os processos (tasklist): ${err}`)
    }
  }

  private abortStart(when: string): StartResult {
    this.deps.log(`[Backend] Partida cancelada ${when}: o app está encerrando`)
    return 'aborted'
  }

  private attach(child: ChildProcess): void {
    this.child = child
    child.stdout?.on('data', (data: Buffer) => this.deps.log(`[Backend] ${data.toString().trim()}`))
    child.stderr?.on('data', (data: Buffer) => this.deps.log(`[Backend ERR] ${data.toString().trim()}`))
    // Um EPIPE ao fechar o stdin de um processo já morto não pode derrubar o main.
    child.stdin?.on('error', () => {})
    child.on('error', (err) => {
      this.deps.log(`[Backend] Falha no processo do backend: ${err}`)
      if (this.child === child) this.child = null
    })
    child.on('exit', (code, signal) => {
      this.deps.log(`[Backend] Backend finalizado (código: ${code}, sinal: ${signal})`)
      if (this.child === child) this.child = null
      // Saída que o app não pediu: queda (053/RF-5301).
      const reason = this.hung.has(child) ? 'sem resposta ao /health' : `saída inesperada (código: ${code}, sinal: ${signal})`
      this.handleCrash(child, reason)
    })
  }

  private emit(status: BackendStatus): void {
    this.deps.log(`[Backend] Estado informado à janela: ${status}`)
    try {
      this.onStatus(status)
    } catch (err) {
      this.deps.log(`[Backend] Aviso: falha ao informar o estado ${status}: ${err}`)
    }
  }

  private isCurrentAlive(child: ChildProcess): boolean {
    return !this.stopping && this.child === child && !hasExited(child)
  }

  /**
   * Vigia do /health (053/RF-5302): arma no primeiro OK; com HEALTH_MAX_FAILURES falhas seguidas, considera o
   * backend travado e o encerra à força. A queda segue pelo handler de saída (ou aqui, se a saída não vier).
   */
  private async watchHealth(child: ChildProcess, port: number): Promise<void> {
    const started = this.deps.now()
    let armed = false
    let failures = 0
    while (this.isCurrentAlive(child)) {
      await this.deps.sleep(HEALTH_INTERVAL_MS)
      if (!this.isCurrentAlive(child)) return
      const ok = await this.deps.fetchHealth(port)
      if (!this.isCurrentAlive(child)) return
      if (ok) {
        if (!armed) this.deps.log('[Backend] Vigia do /health armado')
        armed = true
        failures = 0
        continue
      }
      if (!armed) {
        if (this.deps.now() - started >= HEALTH_ARM_TIMEOUT_MS) {
          this.deps.log(`[Backend] Aviso: sem /health OK em ${HEALTH_ARM_TIMEOUT_MS} ms; vigia de travamento desligado`)
          return
        }
        continue
      }
      failures++
      this.deps.log(`[Backend] /health sem resposta (${failures}/${HEALTH_MAX_FAILURES})`)
      if (failures < HEALTH_MAX_FAILURES) continue

      this.deps.log(`[Backend] Backend travado (PID: ${child.pid}): encerramento forçado`)
      this.hung.add(child)
      this.forceKill(child)
      await this.waitForExit(child, FORCED_EXIT_CONFIRM_MS)
      if (this.child === child) this.child = null
      this.handleCrash(child, 'sem resposta ao /health')
      return
    }
  }

  /** Trata a queda uma única vez por processo e dispara a recuperação (053/RF-5301, RF-5303). */
  private handleCrash(child: ChildProcess, reason: string): void {
    if (this.stopping || this.handled.has(child)) return
    this.handled.add(child)
    this.deps.log(`[Backend] Queda do backend (PID: ${child.pid ?? '?'}): ${reason}`)
    this.emit('down')
    void this.recover()
  }

  /**
   * Reinicia o backend com a última configuração, no máximo MAX_RESTARTS vezes em RESTART_WINDOW_MS, e anuncia
   * `up` quando o novo processo responde ao /health (053/RF-5303, RF-5304). Nada acontece com o app encerrando.
   */
  private async recover(): Promise<void> {
    if (this.recovering) return
    this.recovering = true
    try {
      while (!this.stopping) {
        const now = this.deps.now()
        this.restarts = this.restarts.filter((t) => now - t < RESTART_WINDOW_MS)
        if (this.restarts.length >= MAX_RESTARTS || !this.lastStart) {
          this.deps.log(`[Backend] Reinício automático desistiu: ${this.restarts.length} reinícios em ${RESTART_WINDOW_MS} ms`)
          this.emit('failed')
          return
        }
        this.restarts.push(now)
        this.emit('restarting')
        const { config, port } = this.lastStart
        const result = await this.start(config, port)
        if (this.stopping) return
        if (result !== 'started') {
          this.deps.log(`[Backend] Reinício automático falhou: ${result}`)
          this.emit('failed')
          return
        }
        const child = this.child
        if (child && (await this.waitHealthy(child, port))) {
          this.deps.log(`[Backend] Backend reiniciado e respondendo (PID: ${child.pid})`)
          this.emit('up')
          return
        }
        if (this.stopping) return
        // O processo novo saiu ou não respondeu: trata como nova queda e tenta de novo dentro do limite.
        if (child) {
          const alreadyHandled = this.handled.has(child)
          this.handled.add(child)
          if (!hasExited(child)) {
            this.hung.add(child)
            this.forceKill(child)
            await this.waitForExit(child, FORCED_EXIT_CONFIRM_MS)
          }
          if (this.child === child) this.child = null
          if (!alreadyHandled) {
            this.deps.log(`[Backend] Backend reiniciado não respondeu (PID: ${child.pid ?? '?'})`)
            this.emit('down')
          }
        }
      }
    } finally {
      this.recovering = false
    }
  }

  private async waitHealthy(child: ChildProcess, port: number): Promise<boolean> {
    const deadline = this.deps.now() + RESTART_HEALTH_TIMEOUT_MS
    while (this.deps.now() < deadline) {
      if (!this.isCurrentAlive(child)) return false
      if (await this.deps.fetchHealth(port)) return this.isCurrentAlive(child)
      await this.deps.sleep(RESTART_HEALTH_POLL_MS)
    }
    return false
  }

  private async doStop(): Promise<void> {
    const child = this.child
    if (!child || hasExited(child)) return
    const started = this.deps.now()
    this.deps.log(`[Backend] Encerrando o backend (PID: ${child.pid}): fechando o stdin`)
    try {
      child.stdin?.end()
    } catch {
      // stdin já fechado
    }
    if (await this.waitForExit(child, GRACEFUL_EXIT_MS)) {
      this.deps.log(`[Backend] Backend saiu sozinho em ${this.deps.now() - started} ms`)
      return
    }

    this.deps.log(`[Backend] Backend não saiu em ${GRACEFUL_EXIT_MS} ms: encerramento forçado`)
    if (this.deps.platform === 'win32') {
      this.forceKill(child)
    } else {
      this.signal(child, 'SIGTERM')
      if (!(await this.waitForExit(child, SIGTERM_GRACE_MS))) this.signal(child, 'SIGKILL')
    }
    if (await this.waitForExit(child, FORCED_EXIT_CONFIRM_MS)) {
      this.deps.log(`[Backend] Backend encerrado à força em ${this.deps.now() - started} ms`)
    } else {
      this.deps.log('[Backend] Aviso: sem confirmação da saída do backend; o watchdog do backend segue como garantia')
    }
  }

  private forceKill(child: ChildProcess): void {
    if (!child.pid) return
    if (this.deps.platform === 'win32') {
      const res = this.deps.spawnSync('taskkill', ['/pid', String(child.pid), '/f', '/t'], {
        windowsHide: true,
        stdio: 'ignore',
        timeout: 3000
      })
      if (res.error || res.status !== 0) {
        this.deps.log(`[Backend] Aviso: taskkill falhou (status: ${res.status}, erro: ${res.error ?? 'nenhum'})`)
      }
    } else {
      this.signal(child, 'SIGKILL')
    }
  }

  private signal(child: ChildProcess, sig: NodeJS.Signals): void {
    try {
      child.kill(sig)
    } catch (err) {
      this.deps.log(`[Backend] Aviso: falha ao enviar ${sig}: ${err}`)
    }
  }

  private waitForExit(child: ChildProcess, timeoutMs: number): Promise<boolean> {
    if (hasExited(child)) return Promise.resolve(true)
    return new Promise((resolve) => {
      let done = false
      const finish = (value: boolean): void => {
        if (done) return
        done = true
        child.removeListener('exit', onExit)
        resolve(value)
      }
      const onExit = (): void => finish(true)
      child.once('exit', onExit)
      void this.deps.sleep(timeoutMs).then(() => finish(hasExited(child)))
    })
  }

  /**
   * Porta ocupada (RF-3409, C-3401 B). No Windows identifica o dono pela porta e encerra só backend do MLab;
   * no Linux/macOS e para terceiros só registra. Devolve true quando a porta foi liberada.
   */
  private async releaseOrphan(port: number): Promise<boolean> {
    if (this.deps.platform !== 'win32') {
      this.deps.log(`[Backend] Porta ${port} já ocupada por um servidor; nenhum processo foi encerrado (${this.deps.platform})`)
      return false
    }
    let pid: number | null = null
    let image: string | undefined
    try {
      pid = parseNetstatListeningPid(await this.deps.execText('netstat', ['-ano', '-p', 'TCP']), port)
      if (pid) {
        const tasks = parseTasklistCsv(await this.deps.execText('tasklist', ['/FI', `PID eq ${pid}`, '/FO', 'CSV', '/NH']))
        image = tasks.find((t) => t.pid === pid)?.imageName
      }
    } catch (err) {
      this.deps.log(`[Backend] Aviso: não foi possível identificar o dono da porta ${port}: ${err}`)
    }
    if (!pid || !isMlabBackendImage(image)) {
      this.deps.log(`[Backend] Porta ${port} ocupada por ${image ?? 'processo desconhecido'} (PID: ${pid ?? '?'}); não é backend do MLab, nada foi encerrado`)
      return false
    }
    if (this.stopping) return false

    this.deps.log(`[Backend] Backend órfão do MLab na porta ${port} (${image}, PID: ${pid}): encerrando`)
    try {
      this.deps.killPid(pid)
    } catch (err) {
      this.deps.log(`[Backend] Aviso: falha ao encerrar o órfão ${pid}: ${err}`)
    }
    const deadline = this.deps.now() + ORPHAN_PORT_RELEASE_MS
    while (this.deps.now() < deadline) {
      if (this.stopping) return false
      if (!this.deps.isProcessAlive(pid) && !(await this.deps.fetchHealth(port))) {
        this.deps.log(`[Backend] Órfão ${pid} encerrado; porta ${port} liberada`)
        return true
      }
      await this.deps.sleep(200)
    }
    this.deps.log(`[Backend] Aviso: a porta ${port} não foi liberada após encerrar o órfão ${pid}`)
    return false
  }
}

// ── Dependências reais ────────────────────────────────────────────────────────

function defaultFetchHealth(port: number): Promise<boolean> {
  return new Promise((resolve) => {
    const req = http.get(`http://127.0.0.1:${port}/health`, (res) => {
      let body = ''
      res.setEncoding('utf8')
      res.on('data', (chunk: string) => {
        body += chunk
      })
      res.on('end', () => resolve(res.statusCode === 200 && /"status"\s*:\s*"ok"/.test(body)))
    })
    req.on('error', () => resolve(false))
    req.setTimeout(500, () => {
      req.destroy()
      resolve(false)
    })
  })
}

function defaultExecText(command: string, args: string[]): Promise<string> {
  return new Promise((resolve, reject) => {
    execFile(command, args, { windowsHide: true, timeout: 5000 }, (err, stdout) => {
      if (err) reject(err)
      else resolve(String(stdout))
    })
  })
}

function defaultIsProcessAlive(pid: number): boolean {
  try {
    process.kill(pid, 0)
    return true
  } catch (err) {
    return (err as NodeJS.ErrnoException).code === 'EPERM'
  }
}

export function createDefaultDeps(log: (message: string) => void): BackendManagerDeps {
  const platform = process.platform
  const spawnSync = (command: string, args: string[], options: SpawnSyncOptions): SpawnSyncResult => {
    const r = nodeSpawnSync(command, args, options)
    return { status: r.status, error: r.error }
  }
  return {
    platform,
    spawn: (command, args, options) => nodeSpawn(command, args, options),
    spawnSync,
    fetchHealth: defaultFetchHealth,
    execText: defaultExecText,
    isProcessAlive: defaultIsProcessAlive,
    killPid: (pid) => {
      if (platform === 'win32') {
        spawnSync('taskkill', ['/pid', String(pid), '/f', '/t'], { windowsHide: true, stdio: 'ignore', timeout: 3000 })
      } else {
        process.kill(pid, 'SIGKILL')
      }
    },
    sleep: (ms) => new Promise((resolve) => setTimeout(resolve, ms)),
    now: () => Date.now(),
    log
  }
}
