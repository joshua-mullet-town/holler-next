#!/usr/bin/env node

/**
 * 🚀 JARVIS EXECUTOR MCP SERVER
 * 
 * Registers tools for Jarvis Mode plan execution workflow.
 * Uses standard MCP SDK pattern - same as command-hub.
 */

const { Server } = require('@modelcontextprotocol/sdk/server/index.js');
const { StdioServerTransport } = require('@modelcontextprotocol/sdk/server/stdio.js');
const {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} = require('@modelcontextprotocol/sdk/types.js');
const { execSync } = require('child_process');

// Create MCP server
const server = new Server(
  {
    name: 'jarvis-executor',
    version: '1.0.0',
  },
  {
    capabilities: {
      tools: {},
    },
  }
);

// Register available tools
server.setRequestHandler(ListToolsRequestSchema, async () => {
  return {
    tools: [
      {
        name: 'execute_jarvis_plan',
        description: 'Execute the current Jarvis plan in implementation mode. Use this when the user wants to start executing their plan, such as when they say phrases like "go to pound town claude code", "execute the plan", "run the plan", "start execution", "implement this", or similar execution commands.',
        inputSchema: {
          type: 'object',
          properties: {
            confirmation: {
              type: 'string',
              description: 'User confirmation phrase or command that triggered execution'
            }
          }
        }
      }
    ]
  };
});

// Handle tool execution
server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args } = request.params;

  if (name === 'execute_jarvis_plan') {
    try {
      console.log('🎯 JARVIS: Executing plan via MCP tool');
      console.log(`🎯 JARVIS: Triggered by: ${args.confirmation || 'execution command'}`);
      
      // Execute the Jarvis plan script
      const result = execSync(
        'node /Users/joshuamullet/code/holler/holler-next/scripts/execute-jarvis-plan.js',
        { 
          encoding: 'utf8',
          cwd: '/Users/joshuamullet/code/holler/holler-next',
          timeout: 30000
        }
      );
      
      return {
        content: [
          {
            type: 'text',
            text: `🚀 EXECUTION TRIGGERED!\n\nJarvis plan execution started successfully.\n\nOutput:\n${result}\n\nThe plan is now running in execution mode. Context will be cleared and the execution prompt will be injected shortly.`
          }
        ]
      };
      
    } catch (error) {
      console.error('❌ JARVIS: Execution failed:', error);
      
      return {
        content: [
          {
            type: 'text', 
            text: `❌ EXECUTION FAILED\n\nError executing Jarvis plan:\n${error.message}\n\nPlease check that:\n- You're in Jarvis planning mode\n- There's an active plan in the database\n- The execute-jarvis-plan.js script is working`
          }
        ]
      };
    }
  }

  throw new Error(`Unknown tool: ${name}`);
});

// Start the server
async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error('🤖 Jarvis Executor MCP Server started');
}

if (require.main === module) {
  main().catch((error) => {
    console.error('❌ Server failed to start:', error);
    process.exit(1);
  });
}