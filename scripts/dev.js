const { spawn, execSync } = require('child_process');
const { randomBytes } = require('crypto');

/**
 * Encerra processos zumbis ou instâncias antigas presas em uma porta (Windows).
 */
function cleanupPort(port) {
  if (process.platform !== 'win32') return;
  try {
    const stdout = execSync(`netstat -ano | findstr :${port}`, { stdio: ['ignore', 'pipe', 'ignore'] }).toString();
    const lines = stdout.trim().split('\n');
    for (const line of lines) {
      const parts = line.trim().split(/\s+/);
      const state = parts[3];
      const pid = parts[parts.length - 1];
      if (state === 'LISTENING' && pid && pid !== '0' && pid !== process.pid.toString()) {
        console.log(`[MLab Dev] Liberando porta ${port} ocupada pelo PID ${pid}...`);
        try {
          execSync(`taskkill /pid ${pid} /f /t`, { stdio: 'ignore' });
        } catch {}
      }
    }
  } catch {}
}

console.log('[MLab Dev] Verificando portas do ambiente de desenvolvimento...');
cleanupPort(8080);
cleanupPort(5173);
cleanupPort(5174);

/**
 * Inspeciona o perfil de rede do Windows e avisa caso a rede esteja como Pública (bloqueando portas do LAN).
 */
function checkNetworkProfile() {
  if (process.platform !== 'win32') return;
  try {
    const stdout = execSync(
      'powershell -NoProfile -Command "Get-NetConnectionProfile | Select-Object -First 1 Name, InterfaceAlias, NetworkCategory | ConvertTo-Json"',
      { stdio: ['ignore', 'pipe', 'ignore'], timeout: 3000 }
    ).toString();
    const info = JSON.parse(stdout);
    if (info && (info.NetworkCategory !== undefined)) {
      const isPublic = info.NetworkCategory === 0 || info.NetworkCategory === 'Public';
      const categoryName = isPublic ? 'Pública' : (info.NetworkCategory === 1 || info.NetworkCategory === 'Private' ? 'Privada' : info.NetworkCategory);
      console.log(`[MLab Dev] Rede ativa: ${info.Name || info.InterfaceAlias} (${info.InterfaceAlias}) - Perfil: ${categoryName}`);
      if (isPublic) {
        console.log(`[MLab Dev] AVISO: A rede está configurada como 'Pública' no Windows. Caso alunos em outros aparelhos não consigam conectar, configure a rede Wi-Fi como 'Privada'.`);
      }
    }
  } catch {}
}
checkNetworkProfile();

// Define flag para que o Electron não tente inicializar mlab-backend.exe concorrentemente com @mlab/backend
process.env.MLAB_DEV_MONOREPO = '1';

// Chave de host compartilhada entre o backend (go run) e o app Electron nesta execução de dev (ADR 0006).
// Sem ela, o backend recusa POST /auth/session. Nunca é registrada em log.
if (!process.env.MLAB_HOST_KEY) {
  process.env.MLAB_HOST_KEY = randomBytes(32).toString('hex');
}

console.log('[MLab Dev] Iniciando Turborepo em modo de desenvolvimento...');

// No Node v24+, spawn com shell:true e args separados dispara DEP0190.
// Passando o comando completo como string única (sem args array) evita o warning.
const child = spawn('npx turbo run dev --concurrency=10', {
  stdio: 'inherit',
  shell: true,
  env: {
    ...process.env,
    MLAB_DEV_MONOREPO: '1',
    MLAB_HOST_KEY: process.env.MLAB_HOST_KEY
  }
});

child.on('exit', (code, signal) => {
  if (signal) {
    process.kill(process.pid, signal);
  } else {
    process.exit(code || 0);
  }
});

process.on('SIGINT', () => {
  child.kill('SIGINT');
});

process.on('SIGTERM', () => {
  child.kill('SIGTERM');
});
