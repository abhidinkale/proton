import { spawn } from "node:child_process";
import path from "node:path";
import fs from "node:fs";

const SERVER_PATH = path.resolve(import.meta.dirname, "index.mjs");
const WORKSPACE_ROOT = path.resolve(import.meta.dirname, "../..");

console.log("=== Proton Bridge MCP Verification Suite ===");
console.log(`Server: ${SERVER_PATH}`);
console.log(`Workspace: ${WORKSPACE_ROOT}\n`);

class McpTestClient {
  constructor() {
    this.process = null;
    this.buffer = "";
    this.messageId = 1;
    this.pendingRequests = new Map();
  }

  async start() {
    this.process = spawn("node", [SERVER_PATH], {
      cwd: WORKSPACE_ROOT,
      env: {
        ...process.env,
        PROTON_WORKSPACE_ROOT: WORKSPACE_ROOT,
      },
      stdio: ["pipe", "pipe", "pipe"],
    });

    this.process.stderr.on("data", (data) => {
      // debug logs
      // process.stderr.write(`[server stderr] ${data}`);
    });

    this.process.stdout.on("data", (data) => {
      this.buffer += data.toString();
      let newlineIndex;
      while ((newlineIndex = this.buffer.indexOf("\n")) !== -1) {
        const line = this.buffer.slice(0, newlineIndex).trim();
        this.buffer = this.buffer.slice(newlineIndex + 1);
        if (line) {
          try {
            const parsed = JSON.parse(line);
            if (parsed.id && this.pendingRequests.has(parsed.id)) {
              const { resolve, reject } = this.pendingRequests.get(parsed.id);
              this.pendingRequests.delete(parsed.id);
              if (parsed.error) {
                reject(parsed.error);
              } else {
                resolve(parsed.result);
              }
            }
          } catch (e) {
            console.error("Failed to parse JSON-RPC line:", line, e);
          }
        }
      }
    });

    return new Promise((resolve, reject) => {
      this.process.on("error", reject);
      setTimeout(resolve, 300);
    });
  }

  sendRequest(method, params = {}) {
    const id = this.messageId++;
    const payload = {
      jsonrpc: "2.0",
      id,
      method,
      params,
    };
    return new Promise((resolve, reject) => {
      this.pendingRequests.set(id, { resolve, reject });
      this.process.stdin.write(JSON.stringify(payload) + "\n");
    });
  }

  sendNotification(method, params = {}) {
    const payload = {
      jsonrpc: "2.0",
      method,
      params,
    };
    this.process.stdin.write(JSON.stringify(payload) + "\n");
  }

  stop() {
    if (this.process) {
      this.process.kill("SIGTERM");
    }
  }
}

async function runTests() {
  const client = new McpTestClient();
  let passed = 0;
  let failed = 0;

  function assert(condition, message) {
    if (condition) {
      console.log(`  ✅ PASS: ${message}`);
      passed++;
    } else {
      console.error(`  ❌ FAIL: ${message}`);
      failed++;
    }
  }

  try {
    await client.start();

    // 1 & 2: MCP Handshake
    console.log("[1/14] Testing MCP initialization handshake...");
    const initRes = await client.sendRequest("initialize", {
      protocolVersion: "2024-11-05",
      capabilities: {},
      clientInfo: { name: "test-client", version: "1.0.0" },
    });
    assert(initRes.serverInfo?.name === "proton-bridge", "Server identifies as 'proton-bridge'");
    assert(initRes.capabilities?.tools !== undefined, "Server declares tools capability");
    client.sendNotification("notifications/initialized");

    // 3: Verify tools/list
    console.log("\n[2/14] Testing tools/list...");
    const listRes = await client.sendRequest("tools/list");
    const toolNames = listRes.tools.map((t) => t.name);
    console.log(`  Discovered tools: ${toolNames.join(", ")}`);
    assert(listRes.tools.length === 7, `Expected exactly 7 tools, got ${listRes.tools.length}`);

    const expectedTools = [
      "proton_status",
      "proton_git_status",
      "proton_read_file",
      "proton_search_code",
      "proton_run_tests",
      "proton_run_build",
      "proton_get_test_results",
    ];
    for (const t of expectedTools) {
      assert(toolNames.includes(t), `Tool '${t}' is present`);
    }

    // 4: Call proton_status
    console.log("\n[3/14] Calling 'proton_status'...");
    const statusRes = await client.sendRequest("tools/call", {
      name: "proton_status",
      arguments: {},
    });
    const statusData = JSON.parse(statusRes.content[0].text);
    assert(statusData.workspace_root === WORKSPACE_ROOT, `Workspace root matches: ${statusData.workspace_root}`);
    assert(typeof statusData.git.branch === "string", `Git branch reported: ${statusData.git.branch}`);
    assert(statusData.subsystems.api === true, "API subsystem detected");
    assert(statusData.subsystems.web === true, "Web subsystem detected");

    // 5: Call proton_git_status
    console.log("\n[4/14] Calling 'proton_git_status'...");
    const gitStatusRes = await client.sendRequest("tools/call", {
      name: "proton_git_status",
      arguments: {},
    });
    const gitStatusData = JSON.parse(gitStatusRes.content[0].text);
    assert(typeof gitStatusData.branch === "string", `Branch is '${gitStatusData.branch}'`);
    assert(Array.isArray(gitStatusData.staged), "Staged files array present");
    assert(Array.isArray(gitStatusData.unstaged), "Unstaged files array present");
    assert(typeof gitStatusData.diff_summary === "string", "Diff summary present");

    // 6: Call proton_read_file with valid file
    console.log("\n[5/14] Calling 'proton_read_file' with safe file...");
    const readRes = await client.sendRequest("tools/call", {
      name: "proton_read_file",
      arguments: {
        file_path: "apps/api/package.json",
        start_line: 1,
        end_line: 5,
      },
    });
    const readData = JSON.parse(readRes.content[0].text);
    assert(readData.file_path === "apps/api/package.json", "Returned correct file path");
    assert(readData.lines_returned <= 5, `Bounded slice returned ${readData.lines_returned} lines`);
    assert(readData.content.includes("api"), "Content matches package.json");

    // 7: Call proton_search_code
    console.log("\n[6/14] Calling 'proton_search_code'...");
    const searchRes = await client.sendRequest("tools/call", {
      name: "proton_search_code",
      arguments: {
        query: "express",
        sub_path: "apps/api",
        max_results: 5,
      },
    });
    const searchData = JSON.parse(searchRes.content[0].text);
    assert(searchData.matches_count > 0, `Search found ${searchData.matches_count} matches for 'express'`);
    assert(searchData.matches[0].file.startsWith("apps/api"), "Results restricted to sub_path");

    // 8: Call proton_run_build with api_syntax_check
    console.log("\n[7/14] Calling 'proton_run_build' with 'api_syntax_check'...");
    const buildRes = await client.sendRequest("tools/call", {
      name: "proton_run_build",
      arguments: { target: "api_syntax_check" },
    });
    const buildData = JSON.parse(buildRes.content[0].text);
    assert(buildData.success === true, "API syntax check succeeded");
    assert(buildData.exit_code === 0, "Exit code is 0");
    const savedBuildRunId = buildData.run_id;

    // 9: Call proton_get_test_results
    console.log("\n[8/14] Calling 'proton_get_test_results'...");
    const resultsRes = await client.sendRequest("tools/call", {
      name: "proton_get_test_results",
      arguments: { run_id: savedBuildRunId },
    });
    const resultsData = JSON.parse(resultsRes.content[0].text);
    assert(resultsData.run_id === savedBuildRunId, "Successfully fetched saved build run record");
    assert(resultsData.type === "build", "Record type is 'build'");

    // 10: Call proton_run_tests with approved suite
    console.log("\n[9/14] Calling 'proton_run_tests' with 'milestone1_architecture'...");
    const testRes = await client.sendRequest("tools/call", {
      name: "proton_run_tests",
      arguments: { suite: "milestone1_architecture" },
    });
    const testData = JSON.parse(testRes.content[0].text);
    assert(typeof testData.run_id === "string", `Generated test run ID: ${testData.run_id}`);
    assert(testData.target === "apps/api/tests/milestone1_architecture_validation.cjs", "Executed approved target script");
    assert(typeof testData.duration_ms === "number", `Test finished in ${testData.duration_ms}ms`);

    // 11: Security Test: Path Traversal Rejection
    console.log("\n[10/14] Security Test: Path traversal rejection (../../../../etc/passwd)...");
    const traversalRes = await client.sendRequest("tools/call", {
      name: "proton_read_file",
      arguments: { file_path: "../../../../etc/passwd" },
    });
    assert(traversalRes.isError === true, "Path traversal attempt returned isError=true");
    assert(traversalRes.content[0].text.includes("SecurityError"), "Error message contains SecurityError");

    // 12: Security Test: Secret File Rejection (.env / .env.example / proton.env)
    console.log("\n[11/14] Security Test: Secret file rejection (.env.example & proton.env)...");
    const secretRes1 = await client.sendRequest("tools/call", {
      name: "proton_read_file",
      arguments: { file_path: ".env.example" },
    });
    assert(secretRes1.isError === true, ".env.example read rejected");
    assert(secretRes1.content[0].text.includes("Sensitive or credential file"), ".env.example error specifies sensitive file blocked");

    const secretRes2 = await client.sendRequest("tools/call", {
      name: "proton_read_file",
      arguments: { file_path: "proton-dev.env" },
    });
    assert(secretRes2.isError === true, "proton-dev.env read rejected");

    // 13: Security Test: Symlink Escape Rejection
    console.log("\n[12/14] Security Test: Symlink escape rejection...");
    const testSymlinkPath = path.join(WORKSPACE_ROOT, "tools/proton-bridge/symlink-escape-test");
    try {
      if (fs.existsSync(testSymlinkPath)) fs.unlinkSync(testSymlinkPath);
      fs.symlinkSync("/etc/hosts", testSymlinkPath);

      const symlinkRes = await client.sendRequest("tools/call", {
        name: "proton_read_file",
        arguments: { file_path: "tools/proton-bridge/symlink-escape-test" },
      });
      assert(symlinkRes.isError === true, "Symlink escape attempt returned isError=true");
      assert(symlinkRes.content[0].text.includes("Symlink escape denied"), "Error confirms symlink escape denied");
    } finally {
      if (fs.existsSync(testSymlinkPath)) fs.unlinkSync(testSymlinkPath);
    }

    // 14: Security Test: Arbitrary Command Execution & Mutation Rejection
    console.log("\n[13/14] Security Test: Arbitrary command & destructive target rejection...");
    const maliciousTestRes = await client.sendRequest("tools/call", {
      name: "proton_run_tests",
      arguments: { suite: "rm -rf /; echo hacked" },
    });
    assert(maliciousTestRes.isError === true, "Arbitrary test command rejected");

    const unapprovedBuildRes = await client.sendRequest("tools/call", {
      name: "proton_run_build",
      arguments: { target: "production_deploy" },
    });
    assert(unapprovedBuildRes.isError === true, "Unapproved build target 'production_deploy' rejected");

    const pathTraversalTestRes = await client.sendRequest("tools/call", {
      name: "proton_run_tests",
      arguments: { test_file: "../../malicious.cjs" },
    });
    assert(pathTraversalTestRes.isError === true, "Path traversal in test_file rejected");

    console.log("\n[14/14] Verifying destructive operations guardrails...");
    const forbiddenTools = [
      "proton_write_file",
      "proton_delete_file",
      "proton_execute_shell",
      "proton_git_push",
      "proton_git_reset",
      "proton_git_clean",
      "proton_deploy",
    ];
    for (const forbidden of forbiddenTools) {
      assert(!toolNames.includes(forbidden), `Forbidden tool '${forbidden}' is not exposed`);
    }

  } finally {
    client.stop();
  }

  console.log("\n==========================================");
  console.log(`TOTAL TESTS PASSED: ${passed}`);
  console.log(`TOTAL TESTS FAILED: ${failed}`);
  console.log("==========================================");

  if (failed > 0) {
    process.exit(1);
  }
}

runTests().catch((err) => {
  console.error("Test suite crashed:", err);
  process.exit(1);
});
