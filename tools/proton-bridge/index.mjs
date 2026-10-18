import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from "@modelcontextprotocol/sdk/types.js";

import {
  toolProtonStatus,
  toolProtonGitStatus,
  toolProtonReadFile,
  toolProtonSearchCode,
  toolProtonRunTests,
  toolProtonRunBuild,
  toolProtonGetTestResults,
} from "./tools.mjs";

const server = new Server(
  {
    name: "proton-bridge",
    version: "1.0.0",
  },
  {
    capabilities: {
      tools: {},
    },
  }
);

// 1. Tool Definitions
server.setRequestHandler(ListToolsRequestSchema, async () => {
  return {
    tools: [
      {
        name: "proton_status",
        description:
          "Inspect Proton workspace environment, git branch/commit, node version, and port health for API and Web services.",
        inputSchema: {
          type: "object",
          properties: {},
          required: [],
        },
      },
      {
        name: "proton_git_status",
        description:
          "Inspect structured git status of the Proton repository (branch, ahead/behind, staged, unstaged, untracked, diff stat). Read-only.",
        inputSchema: {
          type: "object",
          properties: {
            include_untracked: {
              type: "boolean",
              description: "Whether to list untracked files. Defaults to true.",
            },
          },
          required: [],
        },
      },
      {
        name: "proton_read_file",
        description:
          "Read file contents safely from within the Proton repository. Strictly rejects path traversal, symlink escapes, and secret/credential files (.env, keys, etc.).",
        inputSchema: {
          type: "object",
          properties: {
            file_path: {
              type: "string",
              description:
                "Path to the file relative to Proton repository root (e.g., 'apps/api/app.js').",
            },
            start_line: {
              type: "integer",
              description: "Optional 1-based start line.",
            },
            end_line: {
              type: "integer",
              description:
                "Optional 1-based end line (max 500 lines slice per call).",
            },
          },
          required: ["file_path"],
        },
      },
      {
        name: "proton_search_code",
        description:
          "Search for text or regex patterns in Proton workspace files using git grep. Filters out sensitive files automatically.",
        inputSchema: {
          type: "object",
          properties: {
            query: {
              type: "string",
              description: "Search query or regex pattern.",
            },
            sub_path: {
              type: "string",
              description:
                "Optional subdirectory within Proton to restrict search (e.g. 'apps/api').",
            },
            max_results: {
              type: "integer",
              description: "Maximum results to return (default: 25, max: 100).",
            },
          },
          required: ["query"],
        },
      },
      {
        name: "proton_run_tests",
        description:
          "Execute an approved, bounded test validation script in Proton. Strictly allowlisted; arbitrary command execution is forbidden.",
        inputSchema: {
          type: "object",
          properties: {
            suite: {
              type: "string",
              enum: [
                "milestone1_architecture",
                "milestone1_clinical_integrity",
                "milestone2a_dynamic_intake",
                "milestone2b_capture_session",
                "milestone2b2_camera_upload",
                "live_ai_validation",
                "clinical_ai_validation",
                "deepseek_smoke",
                "gemini_smoke",
              ],
              description:
                "Target test suite from approved allowlist registry.",
            },
            test_file: {
              type: "string",
              description:
                "Optional specific script name in approved test folder matching '^[a-zA-Z0-9_-]+\\.(cjs|js)$'.",
            },
          },
        },
      },
      {
        name: "proton_run_build",
        description:
          "Execute bounded build or type-checking verification for Proton web or api. Strictly allowlisted targets only.",
        inputSchema: {
          type: "object",
          properties: {
            target: {
              type: "string",
              enum: ["web_typecheck", "web_build", "api_syntax_check"],
              description: "Specific build verification target to execute.",
            },
          },
          required: ["target"],
        },
      },
      {
        name: "proton_get_test_results",
        description:
          "Retrieve complete output (stdout, stderr, duration, exit code) from a test or build execution by run_id or retrieve the most recent run.",
        inputSchema: {
          type: "object",
          properties: {
            run_id: {
              type: "string",
              description:
                "Unique run ID returned from proton_run_tests or proton_run_build. Omit to fetch the latest run.",
            },
          },
          required: [],
        },
      },
    ],
  };
});

// 2. Tool Execution Dispatcher
server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args = {} } = request.params;

  try {
    let result;
    switch (name) {
      case "proton_status":
        result = await toolProtonStatus();
        break;
      case "proton_git_status":
        result = await toolProtonGitStatus(args);
        break;
      case "proton_read_file":
        result = await toolProtonReadFile(args);
        break;
      case "proton_search_code":
        result = await toolProtonSearchCode(args);
        break;
      case "proton_run_tests":
        result = await toolProtonRunTests(args);
        break;
      case "proton_run_build":
        result = await toolProtonRunBuild(args);
        break;
      case "proton_get_test_results":
        result = await toolProtonGetTestResults(args);
        break;
      default:
        return {
          isError: true,
          content: [
            {
              type: "text",
              text: `Unknown tool: '${name}'`,
            },
          ],
        };
    }

    return {
      content: [
        {
          type: "text",
          text: JSON.stringify(result, null, 2),
        },
      ],
    };
  } catch (error) {
    return {
      isError: true,
      content: [
        {
          type: "text",
          text: `[Error: ${error.name || "Error"}] ${error.message}`,
        },
      ],
    };
  }
});

// 3. Stdio Transport Connection
async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  process.stderr.write("proton-bridge MCP server running on stdio.\n");
}

main().catch((err) => {
  process.stderr.write(`Fatal error starting proton-bridge: ${err.stack || err}\n`);
  process.exit(1);
});
