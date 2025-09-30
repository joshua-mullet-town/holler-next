# Jarvis Executor MCP Server V2

Automatically detects execution phrases like "go to pound town claude code" and triggers the `/execute-plan` command.

## Installation

1. Install Python dependencies:
```bash
cd /Users/joshuamullet/code/holler/holler-next/mcp-servers/jarvis-executor
pip install -r requirements.txt
```

2. Make server executable:
```bash
chmod +x server_v2.py
```

3. Test the server:
```bash
python3 server_v2.py
```

## Configuration

The MCP server is configured in `/Users/joshuamullet/code/holler/holler-next/.claude.json`

Claude Code will automatically load this server and make the tools available.

## How It Works

The server provides three tools that Claude automatically calls:

1. **`analyze_user_input_for_execution_intent`** - Called on every user message to detect execution phrases
2. **`check_for_execution_command`** - Called when user mentions execution/implementation  
3. **`respond_to_planning_messages`** - Called for all messages in Jarvis planning mode

When "go to pound town claude code" (or similar phrases) are detected, the server:
1. Runs the `/execute-plan` script directly
2. Returns execution status to Claude
3. Triggers the plan execution workflow

## Detected Phrases

- "go to pound town claude code" (primary)
- "go to pound town"
- "execute the plan"
- "run the plan" 
- "start execution"
- "begin implementation"

## Advantages Over CLAUDE.md Approach

- **Reliable detection**: MCP tools are called automatically by Claude
- **Direct execution**: Runs `/execute-plan` script directly via subprocess
- **Better error handling**: Returns detailed execution status
- **No manual mapping**: Claude automatically decides when to call tools
- **Multiple phrase support**: Detects various execution phrases