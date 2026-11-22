// Run a Python helper WITHOUT freezing the server. (spawnSync blocks every other request —
// logins, uploads, submits — for as long as a report takes to build.)
const { spawn } = require('child_process');

/** → Promise<{ status, stdout: Buffer, stderr: Buffer, error }> — same shape spawnSync gave */
function runPython(args, { timeout = 120000, cmd = 'python3' } = {}) {
  return new Promise((resolve) => {
    let child;
    try { child = spawn(cmd, args); } catch (error) { resolve({ status: null, stdout: Buffer.alloc(0), stderr: Buffer.alloc(0), error }); return; }
    const out = []; const err = [];
    let done = false;
    const finish = (status, error) => {
      if (done) return; done = true; clearTimeout(timer);
      resolve({ status, stdout: Buffer.concat(out), stderr: Buffer.concat(err), error });
    };
    const timer = setTimeout(() => { try { child.kill('SIGKILL'); } catch (_) {} finish(null, new Error(`Timed out after ${Math.round(timeout / 1000)} s`)); }, timeout);
    child.stdout.on('data', (d) => out.push(d));
    child.stderr.on('data', (d) => err.push(d));
    child.on('error', (e) => finish(null, e));
    child.on('close', (code) => finish(code, null));
  });
}

module.exports = { runPython };
