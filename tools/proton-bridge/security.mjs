import path from "node:path";
import fs from "node:fs";
import { execFile } from "node:child_process";

export const WORKSPACE_ROOT = path.resolve(
  process.env.PROTON_WORKSPACE_ROOT || path.resolve(import.meta.dirname, "../..")
);

// Blocked patterns for files containing secrets, credentials, or keys
const BLOCKED_PATTERNS = [
  /^\.env(\..+)?$/i,
  /^.*\.env(\..+)?$/i,
  /^.*\.env\.raw$/i,
  /^.*\.pem$/i,
  /^.*\.key$/i,
  /^.*\.crt$/i,
  /^.*\.p12$/i,
  /^.*\.pfx$/i,
  /^id_(rsa|dsa|ecdsa|ed25519)$/i,
  /^.*(token|oauth|credential|secret).*\.(json|txt|raw|env)$/i,
  /^jetski-.*$/i,
];

// Explicit allowlist of executables
const ALLOWED_EXECUTABLES = new Set(["git", "node", "npx", "npm"]);

export class SecurityError extends Error {
  constructor(message) {
    super(`[SecurityError] ${message}`);
    this.name = "SecurityError";
  }
}

/**
 * Validates and safely resolves a file path strictly within WORKSPACE_ROOT.
 * Enforces jail boundary, prevents traversal, and resolves symlinks to verify targets.
 */
export function resolveSafePath(filePath) {
  if (!filePath || typeof filePath !== "string") {
    throw new SecurityError("Invalid file path provided.");
  }

  // Reject null bytes
  if (filePath.includes("\0")) {
    throw new SecurityError("Null byte injection detected.");
  }

  // Resolve target against workspace
  const resolved = path.isAbsolute(filePath)
    ? path.normalize(filePath)
    : path.resolve(WORKSPACE_ROOT, filePath);

  // Check 1: Must start with WORKSPACE_ROOT
  if (resolved !== WORKSPACE_ROOT && !resolved.startsWith(WORKSPACE_ROOT + path.sep)) {
    throw new SecurityError(`Path traversal escape denied: '${filePath}' is outside Proton workspace.`);
  }

  // Check 2: Secret / Credential blocklist on file name
  const basename = path.basename(resolved);
  for (const pattern of BLOCKED_PATTERNS) {
    if (pattern.test(basename)) {
      throw new SecurityError(`Access denied: Sensitive or credential file '${basename}' is blocked.`);
    }
  }

  // Check 3: Symlink resolution check
  if (fs.existsSync(resolved)) {
    try {
      const canonical = fs.realpathSync(resolved);
      if (canonical !== WORKSPACE_ROOT && !canonical.startsWith(WORKSPACE_ROOT + path.sep)) {
        throw new SecurityError(`Symlink escape denied: target '${canonical}' is outside Proton workspace.`);
      }
      return canonical;
    } catch (err) {
      throw new SecurityError(`Failed to resolve canonical path: ${err.message}`);
    }
  }

  return resolved;
}

/**
 * Safe execution using execFile with strict allowlists, explicit argument arrays,
 * hard timeouts, and buffer caps. Shell execution is permanently forbidden.
 */
export function safeExecFile(executable, args = [], options = {}) {
  return new Promise((resolve) => {
    const baseExec = path.basename(executable);
    if (!ALLOWED_EXECUTABLES.has(baseExec)) {
      return resolve({
        success: false,
        exitCode: 1,
        stdout: "",
        stderr: `SecurityError: Executable '${baseExec}' is not in the approved allowlist (${Array.from(ALLOWED_EXECUTABLES).join(", ")}).`,
        timedOut: false,
      });
    }

    const timeout = Math.min(Math.max(options.timeout || 30000, 1000), 60000); // 1s - 60s
    const maxBuffer = 1024 * 1024; // 1 MB limit

    const runOptions = {
      cwd: options.cwd || WORKSPACE_ROOT,
      env: {
        ...process.env,
        PATH: process.env.PATH,
        NODE_ENV: options.nodeEnv || "test",
      },
      timeout,
      maxBuffer,
      shell: false, // HARD SECURITY RULE: Never evaluate in a shell
    };

    const startTime = Date.now();
    execFile(executable, args, runOptions, (error, stdout, stderr) => {
      const durationMs = Date.now() - startTime;
      const timedOut = Boolean(error && error.killed && error.signal === "SIGTERM");

      let outStr = typeof stdout === "string" ? stdout : (stdout ? stdout.toString("utf8") : "");
      let errStr = typeof stderr === "string" ? stderr : (stderr ? stderr.toString("utf8") : "");

      // Enforce max output length
      const MAX_LEN = 256 * 1024; // 256 KB text cap for responses
      if (outStr.length > MAX_LEN) {
        outStr = outStr.slice(0, MAX_LEN) + `\n\n[TRUNCATED: stdout exceeded 256KB limit]`;
      }
      if (errStr.length > MAX_LEN) {
        errStr = errStr.slice(0, MAX_LEN) + `\n\n[TRUNCATED: stderr exceeded 256KB limit]`;
      }

      if (timedOut) {
        return resolve({
          success: false,
          exitCode: 124,
          durationMs,
          timedOut: true,
          stdout: outStr,
          stderr: (errStr ? errStr + "\n" : "") + `Execution timed out after ${timeout}ms.`,
        });
      }

      resolve({
        success: !error,
        exitCode: error ? (error.code ?? 1) : 0,
        durationMs,
        timedOut: false,
        stdout: outStr,
        stderr: errStr,
      });
    });
  });
}
