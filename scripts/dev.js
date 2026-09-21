const { spawn, execSync } = require('child_process');

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

// Define flag para que o Electron não tente inicializar server.exe concorrentemente com @mlab/backend
process.env.MLAB_DEV_MONOREPO = '1';

console.log('[MLab Dev] Iniciando Turborepo em modo de desenvolvimento...');

// No Node v24+, spawn com shell:true e args separados dispara DEP0190.
// Passando o comando completo como string única (sem args array) evita o warning.
const child = spawn('npx turbo run dev --concurrency=10', {
  stdio: 'inherit',
  shell: true,
  env: {
    ...process.env,
    MLAB_DEV_MONOREPO: '1'
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
