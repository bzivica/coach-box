import { spawn } from 'node:child_process';
import process from 'node:process';

const children = [];
function start(command, args, label) {
  // process.execPath may contain spaces on Windows (for example C:\Program Files\nodejs\node.exe).
  // Do not invoke it through cmd.exe: shell:true can split the executable path at the first space.
  const child = spawn(command, args, { stdio: 'inherit', shell: false });
  children.push(child);
  child.on('error', (error) => {
    console.error(`[${label}] nepodařilo se spustit proces: ${error.message}`);
    shutdown(1);
  });
  child.on('exit', (code) => {
    if (code && code !== 0) {
      console.error(`[${label}] proces skončil s kódem ${code}`);
      shutdown(code);
    }
  });
}
let stopping = false;
function shutdown(code = 0) {
  if (stopping) return;
  stopping = true;
  for (const child of children) {
    if (child.exitCode === null && !child.killed) child.kill();
  }
  process.exitCode = code;
}
process.on('SIGINT', () => shutdown(0));
process.on('SIGTERM', () => shutdown(0));
start(process.execPath, ['server/cz-basketball-server.mjs'], 'import');
start(process.execPath, ['node_modules/vite/bin/vite.js'], 'vite');
