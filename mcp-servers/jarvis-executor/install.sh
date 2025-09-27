#!/bin/bash

# Install Jarvis Executor MCP Server

echo "🤖 Installing Jarvis Executor MCP Server..."

# Check if Python 3 is available
if ! command -v python3 &> /dev/null; then
    echo "❌ Python 3 is required but not installed"
    exit 1
fi

# Install Python dependencies
echo "📦 Installing Python dependencies..."
pip3 install -r requirements.txt

# Make server executable
chmod +x server.py

echo "✅ Jarvis Executor MCP Server installed successfully!"
echo ""
echo "🔧 Configuration:"
echo "   - Server: /Users/joshuamullet/code/holler/holler-next/mcp-servers/jarvis-executor/server.py"
echo "   - Config: /Users/joshuamullet/code/holler/holler-next/.mcp.json"
echo ""
echo "🎯 Magic Phrase: 'go to pound town claude code'"
echo ""
echo "📋 Available Tools:"
echo "   - detect_execution_phrase(text) - Scans for magic phrase"
echo "   - execute_plan(session_id) - Triggers execution mode"
echo "   - get_active_jarvis_session() - Gets current Jarvis session"
echo "   - update_session_mode(session_id, mode) - Updates session mode"
echo ""
echo "🚀 The MCP server should now be available in Claude Code!"