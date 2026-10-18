import path from "node:path";
import fs from "node:fs";
import net from "node:net";
import crypto from "node:crypto";
import {
  WORKSPACE_ROOT,
  resolveSafePath,
  safeExecFile,
  SecurityError,
} from "./security.mjs";

// In-memory ring buffer for test & build run results (max 20 items)
const executionResults = new Map();
const MAX_SAVED_RUNS = 20;

function saveRunResult(record) {
  if (executionResults.size >= MAX_SAVED_RUNS) {
    const oldestKey = executionResults.keys().next().value;
    executionResults.delete(oldestKey);
  }
  executionResults.set(record.run_id, record);
}

// Approved test suites
const APPROVED_TEST_SUITES = {
  milestone1_architecture: "apps/api/tests/milestone1_architecture_validation.cjs",
  milestone1_clinical_integrity: "apps/api/tests/milestone1_clinical_integrity_validation.cjs",
  milestone2a_dynamic_intake: "apps/api/tests/milestone2a_dynamic_intake_validation.cjs",
  milestone2b_capture_session: "apps/api/tests/milestone2b_capture_session_validation.cjs",
  milestone2b2_camera_upload: "apps/api/tests/milestone2b2_camera_upload_validation.cjs",
  live_ai_validation: "tests/live_ai_validation.cjs",
  clinical_ai_validation: "apps/api/tests/clinical_ai_validation.cjs",
  deepseek_smoke: "apps/api/tests/deepseek_live_smoke.cjs",
  gemini_smoke: "apps/api/tests/gemini_live_smoke.cjs",
};

// Approved build targets
const APPROVED_BUILD_TARGETS = {
  web_typecheck: {
    cwd: "apps/web",
    executable: "npx",
    args: ["tsc", "-b"],
  },
  web_build: {
    cwd: "apps/web",
    executable: "npx",
    args: ["vite", "build"],
  },
  api_syntax_check: {
    cwd: ".",
    executable: "node",
    args: ["--check", "apps/api/app.js"],
  },
};

/**
 * Checks if a TCP port on localhost is actively listening.
 */
function checkPortOpen(port, timeoutMs = 300) {
  return new Promise((resolve) => {
    const socket = new net.Socket();
    let isConnected = false;

    socket.setTimeout(timeoutMs);
    socket.once("connect", () => {
      isConnected = true;
      socket.destroy();
      resolve(true);
    });
    socket.once("timeout", () => {
      socket.destroy();
      resolve(false);
    });
    socket.once("error", () => {
      socket.destroy();
      resolve(false);
    });

    socket.connect(port, "127.0.0.1");
  });
}

/**
 * Tool 1: proton_status
 */
export async function toolProtonStatus() {
  const [gitBranchRes, gitCommitRes, apiPortOpen, webPortOpen] = await Promise.all([
    safeExecFile("git", ["rev-parse", "--abbrev-ref", "HEAD"]),
    safeExecFile("git", ["rev-parse", "--short", "HEAD"]),
    checkPortOpen(4000),
    checkPortOpen(5173),
  ]);

  return {
    workspace_root: WORKSPACE_ROOT,
    node_version: process.version,
    platform: process.platform,
    git: {
      branch: gitBranchRes.stdout.trim() || "unknown",
      commit: gitCommitRes.stdout.trim() || "unknown",
    },
    services: {
      api_port_4000: apiPortOpen ? "ONLINE (listening)" : "OFFLINE",
      web_port_5173: webPortOpen ? "ONLINE (listening)" : "OFFLINE",
    },
    subsystems: {
      api: fs.existsSync(path.join(WORKSPACE_ROOT, "apps/api")),
      web: fs.existsSync(path.join(WORKSPACE_ROOT, "apps/web")),
      tests: fs.existsSync(path.join(WORKSPACE_ROOT, "apps/api/tests")),
      docs: fs.existsSync(path.join(WORKSPACE_ROOT, "docs")),
    },
  };
}

/**
 * Tool 2: proton_git_status
 */
export async function toolProtonGitStatus({ include_untracked = true } = {}) {
  const [porcelainRes, diffStatRes, aheadBehindRes] = await Promise.all([
    safeExecFile("git", ["status", "--porcelain=v1", "-b"]),
    safeExecFile("git", ["diff", "--stat"]),
    safeExecFile("git", ["rev-list", "--left-right", "--count", "HEAD...@{upstream}"]),
  ]);

  const rawStatus = porcelainRes.stdout || "";
  const lines = rawStatus.split("\n").filter((l) => l.trim().length > 0);

  let branchHeader = lines[0] || "";
  let branchName = "HEAD";
  let ahead = 0;
  let behind = 0;

  if (branchHeader.startsWith("## ")) {
    const headerContent = branchHeader.slice(3);
    const parts = headerContent.split("...");
    branchName = parts[0].trim();
  }

  if (aheadBehindRes.success && aheadBehindRes.stdout.trim()) {
    const [aheadCount, behindCount] = aheadBehindRes.stdout.trim().split(/\s+/).map(Number);
    ahead = aheadCount || 0;
    behind = behindCount || 0;
  }

  const staged = [];
  const unstaged = [];
  const untracked = [];

  for (let i = 1; i < lines.length; i++) {
    const line = lines[i];
    const indexStatus = line[0];
    const workTreeStatus = line[1];
    const file = line.slice(3).trim();

    if (indexStatus === "?" && workTreeStatus === "?") {
      if (include_untracked) untracked.push(file);
    } else {
      if (indexStatus !== " " && indexStatus !== "?") {
        staged.push({ status: indexStatus, file });
      }
      if (workTreeStatus !== " " && workTreeStatus !== "?") {
        unstaged.push({ status: workTreeStatus, file });
      }
    }
  }

  return {
    branch: branchName,
    ahead,
    behind,
    is_clean: staged.length === 0 && unstaged.length === 0 && untracked.length === 0,
    staged_count: staged.length,
    unstaged_count: unstaged.length,
    untracked_count: untracked.length,
    staged,
    unstaged,
    untracked: include_untracked ? untracked : undefined,
    diff_summary: diffStatRes.stdout.trim() || "No working directory changes.",
  };
}

/**
 * Tool 3: proton_read_file
 */
export async function toolProtonReadFile({ file_path, start_line, end_line }) {
  const safePath = resolveSafePath(file_path);

  if (!fs.existsSync(safePath)) {
    throw new Error(`File not found: '${file_path}'`);
  }

  const stat = await fs.promises.stat(safePath);
  if (stat.isDirectory()) {
    throw new SecurityError(`Cannot read '${file_path}' because it is a directory.`);
  }

  if (stat.size > 2 * 1024 * 1024) {
    throw new Error(`File '${file_path}' exceeds maximum allowable read size (2MB limit).`);
  }

  const buffer = await fs.promises.readFile(safePath);

  // Check for binary content (null bytes in first 1024 bytes)
  const isBinary = buffer.slice(0, 1024).includes(0);
  if (isBinary) {
    return {
      file_path,
      is_binary: true,
      size_bytes: stat.size,
      note: "Binary file detected; raw content cannot be returned as text.",
    };
  }

  const content = buffer.toString("utf8");
  const lines = content.split("\n");
  const totalLines = lines.length;

  if (start_line !== undefined || end_line !== undefined) {
    const s = Math.max(1, start_line || 1);
    const maxEnd = Math.min(totalLines, s + 499); // Max 500 lines slice
    const e = Math.min(maxEnd, end_line !== undefined ? end_line : maxEnd);

    if (s > totalLines) {
      return {
        file_path,
        total_lines: totalLines,
        start_line: s,
        end_line: e,
        lines_returned: 0,
        content: "",
      };
    }

    const sliced = lines.slice(s - 1, e);
    return {
      file_path,
      total_lines: totalLines,
      start_line: s,
      end_line: e,
      lines_returned: sliced.length,
      content: sliced.join("\n"),
    };
  }

  return {
    file_path,
    total_lines: totalLines,
    size_bytes: stat.size,
    content,
  };
}

/**
 * Tool 4: proton_search_code
 */
export async function toolProtonSearchCode({ query, sub_path = "", max_results = 25 }) {
  if (!query || typeof query !== "string") {
    throw new Error("Search query must be a non-empty string.");
  }

  const limit = Math.min(Math.max(Number(max_results) || 25, 1), 100);
  const targetDir = sub_path ? resolveSafePath(sub_path) : WORKSPACE_ROOT;
  const relPath = path.relative(WORKSPACE_ROOT, targetDir) || ".";

  const gitGrepArgs = [
    "grep",
    "-n",
    "-I",
    "--max-depth=10",
    "-e",
    query,
  ];

  if (relPath !== ".") {
    gitGrepArgs.push("--", relPath);
  }

  const result = await safeExecFile("git", gitGrepArgs);

  if (!result.success && result.exitCode !== 1) {
    // exitCode 1 in git grep just means 0 matches found
    throw new Error(`Search error: ${result.stderr || "Unknown error"}`);
  }

  const rawLines = result.stdout ? result.stdout.split("\n").filter(Boolean) : [];
  const matches = [];

  for (const line of rawLines) {
    if (matches.length >= limit) break;
    // Format: filepath:linenumber:text
    const firstColon = line.indexOf(":");
    if (firstColon === -1) continue;
    const secondColon = line.indexOf(":", firstColon + 1);
    if (secondColon === -1) continue;

    const matchedFile = line.slice(0, firstColon);
    const lineNum = Number(line.slice(firstColon + 1, secondColon));
    const matchedText = line.slice(secondColon + 1);

    // Ensure matched file is not a sensitive file
    try {
      resolveSafePath(matchedFile);
      matches.push({
        file: matchedFile,
        line: lineNum,
        text: matchedText.trim(),
      });
    } catch {
      // Ignored: sensitive file match filtered out
    }
  }

  return {
    query,
    sub_path: relPath,
    matches_count: matches.length,
    matches,
  };
}

/**
 * Tool 5: proton_run_tests
 */
export async function toolProtonRunTests({ suite, test_file }) {
  let targetScript = null;

  if (suite) {
    if (!APPROVED_TEST_SUITES[suite]) {
      throw new SecurityError(
        `Test suite '${suite}' is not approved. Approved suites: ${Object.keys(APPROVED_TEST_SUITES).join(", ")}`
      );
    }
    targetScript = APPROVED_TEST_SUITES[suite];
  } else if (test_file) {
    if (!/^[a-zA-Z0-9_-]+\.(cjs|js)$/.test(test_file)) {
      throw new SecurityError(
        "Invalid test_file name. Must match pattern '^[a-zA-Z0-9_-]+\\.(cjs|js)$'."
      );
    }
    // Search in apps/api/tests/ or tests/
    const candidate1 = path.join("apps/api/tests", test_file);
    const candidate2 = path.join("tests", test_file);

    if (fs.existsSync(path.join(WORKSPACE_ROOT, candidate1))) {
      targetScript = candidate1;
    } else if (fs.existsSync(path.join(WORKSPACE_ROOT, candidate2))) {
      targetScript = candidate2;
    } else {
      throw new Error(`Test script '${test_file}' not found in approved test directories.`);
    }
  } else {
    throw new Error("Must specify either 'suite' or 'test_file'.");
  }

  const safeScriptPath = resolveSafePath(targetScript);
  const runId = `test_run_${Date.now()}_${crypto.randomBytes(3).toString("hex")}`;

  const execRes = await safeExecFile("node", [safeScriptPath], {
    timeout: 50000,
  });

  const record = {
    run_id: runId,
    type: "test",
    target: targetScript,
    timestamp: new Date().toISOString(),
    duration_ms: execRes.durationMs,
    success: execRes.success,
    exit_code: execRes.exitCode,
    timed_out: execRes.timedOut,
    stdout: execRes.stdout,
    stderr: execRes.stderr,
  };

  saveRunResult(record);

  return {
    run_id: runId,
    target: targetScript,
    success: execRes.success,
    exit_code: execRes.exitCode,
    duration_ms: execRes.durationMs,
    timed_out: execRes.timedOut,
    summary: execRes.success ? "PASSED" : "FAILED",
    stdout_preview: execRes.stdout.slice(0, 2000),
    stderr_preview: execRes.stderr ? execRes.stderr.slice(0, 2000) : "",
    note: "Call proton_get_test_results with this run_id to inspect complete output.",
  };
}

/**
 * Tool 6: proton_run_build
 */
export async function toolProtonRunBuild({ target }) {
  const config = APPROVED_BUILD_TARGETS[target];
  if (!config) {
    throw new SecurityError(
      `Build target '${target}' is not approved. Approved targets: ${Object.keys(APPROVED_BUILD_TARGETS).join(", ")}`
    );
  }

  const targetCwd = path.resolve(WORKSPACE_ROOT, config.cwd);
  const runId = `build_run_${Date.now()}_${crypto.randomBytes(3).toString("hex")}`;

  const execRes = await safeExecFile(config.executable, config.args, {
    cwd: targetCwd,
    timeout: 55000,
  });

  const record = {
    run_id: runId,
    type: "build",
    target,
    timestamp: new Date().toISOString(),
    duration_ms: execRes.durationMs,
    success: execRes.success,
    exit_code: execRes.exitCode,
    timed_out: execRes.timedOut,
    stdout: execRes.stdout,
    stderr: execRes.stderr,
  };

  saveRunResult(record);

  return {
    run_id: runId,
    target,
    success: execRes.success,
    exit_code: execRes.exitCode,
    duration_ms: execRes.durationMs,
    timed_out: execRes.timedOut,
    summary: execRes.success ? "BUILD SUCCEEDED" : "BUILD FAILED",
    stdout_preview: execRes.stdout.slice(0, 2000),
    stderr_preview: execRes.stderr ? execRes.stderr.slice(0, 2000) : "",
  };
}

/**
 * Tool 7: proton_get_test_results
 */
export async function toolProtonGetTestResults({ run_id } = {}) {
  if (run_id) {
    const record = executionResults.get(run_id);
    if (!record) {
      const available = Array.from(executionResults.keys());
      throw new Error(
        `Run ID '${run_id}' not found. Available recent run IDs: ${available.join(", ") || "none"}`
      );
    }
    return record;
  }

  // If no run_id specified, return the most recent run
  const allKeys = Array.from(executionResults.keys());
  if (allKeys.length === 0) {
    return {
      message: "No test or build runs have been executed in this session yet.",
      recent_runs: [],
    };
  }

  const latestKey = allKeys[allKeys.length - 1];
  return {
    latest_run: executionResults.get(latestKey),
    recent_run_ids: allKeys,
  };
}
