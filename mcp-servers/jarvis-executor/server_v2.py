#!/usr/bin/env python3
"""
🚀 JARVIS EXECUTOR MCP SERVER V2 - AUTO PHRASE DETECTION
Automatically detects execution phrases and triggers /execute-plan command

This MCP server provides tools that Claude AUTOMATICALLY calls when:
- User says execution phrases like "go to pound town claude code"
- User expresses readiness to execute a plan  
- User wants to start implementation
"""

import asyncio
import json
import requests
import re
import subprocess
from typing import Dict, Any, Optional
from mcp.server.fastmcp import FastMCP

# Initialize MCP server
mcp = FastMCP("jarvis-executor-v2")

# Constants
HOLLER_API_BASE = "http://localhost:3002/api"
EXECUTION_PHRASES = [
    "go to pound town claude code",
    "go to pound town",
    "execute the plan", 
    "run the plan",
    "start execution",
    "begin implementation"
]

@mcp.tool()
async def analyze_user_input_for_execution_intent(user_message: str) -> Dict[str, Any]:
    """AUTOMATICALLY CALLED: Analyzes every user message to detect execution phrases.
    
    Claude should call this tool for EVERY user message to check if they want to execute a plan.
    This tool detects phrases like 'go to pound town claude code' and automatically runs /execute-plan.
    
    ALWAYS call this tool when the user sends any message in Jarvis planning mode.
    
    Args:
        user_message: The complete user message to analyze
        
    Returns:
        Execution status and actions taken
    """
    
    # Normalize text for detection
    normalized_text = re.sub(r'\s+', ' ', user_message.lower().strip())
    
    # Check for execution phrases
    detected_phrase = None
    for phrase in EXECUTION_PHRASES:
        if phrase.lower() in normalized_text:
            detected_phrase = phrase
            break
    
    if detected_phrase:
        print(f"🎯 JARVIS V2: EXECUTION PHRASE DETECTED: '{detected_phrase}'")
        print(f"🎯 JARVIS V2: In message: {user_message[:100]}...")
        
        # Execute /execute-plan command directly
        try:
            result = subprocess.run([
                "node", 
                "/Users/joshuamullet/code/holler/holler-next/scripts/execute-jarvis-plan.js"
            ], capture_output=True, text=True, timeout=30)
            
            if result.returncode == 0:
                return {
                    "execution_triggered": True,
                    "detected_phrase": detected_phrase,
                    "command_executed": "/execute-plan",
                    "command_output": result.stdout,
                    "status": "success",
                    "message": f"🚀 EXECUTION STARTED! Detected '{detected_phrase}' and ran /execute-plan successfully."
                }
            else:
                return {
                    "execution_triggered": True,
                    "detected_phrase": detected_phrase,
                    "command_executed": "/execute-plan",
                    "command_error": result.stderr,
                    "status": "error",
                    "message": f"❌ Detected '{detected_phrase}' but /execute-plan failed: {result.stderr}"
                }
                
        except subprocess.TimeoutExpired:
            return {
                "execution_triggered": True,
                "detected_phrase": detected_phrase,
                "command_executed": "/execute-plan",
                "status": "timeout", 
                "message": f"⏰ Detected '{detected_phrase}' but /execute-plan timed out"
            }
        except Exception as e:
            return {
                "execution_triggered": True,
                "detected_phrase": detected_phrase,
                "command_executed": "/execute-plan",
                "status": "exception",
                "message": f"💥 Detected '{detected_phrase}' but error executing: {str(e)}"
            }
    
    # No execution phrase detected
    return {
        "execution_triggered": False,
        "detected_phrase": None,
        "status": "monitoring",
        "message": "No execution phrase detected. Continue planning."
    }

@mcp.tool()
async def check_for_execution_command(text: str) -> Dict[str, Any]:
    """CRITICAL: Call this when user mentions execution, implementation, or 'go' commands.
    
    This tool specifically detects the phrase 'go to pound town claude code' and triggers execution.
    Call this whenever the user seems ready to execute their plan.
    
    Args:
        text: User input to check for execution commands
        
    Returns:
        Whether execution was triggered
    """
    
    if "go to pound town claude code" in text.lower():
        return await analyze_user_input_for_execution_intent(text)
    
    return {
        "execution_triggered": False,
        "message": "Not the magic execution phrase. Use analyze_user_input_for_execution_intent for broader detection."
    }

@mcp.tool() 
async def respond_to_planning_messages(user_input: str) -> Dict[str, Any]:
    """ALWAYS CALL: Processes all user messages in Jarvis planning mode.
    
    This tool should be called for EVERY user message to:
    1. Check for execution phrases
    2. Provide appropriate planning responses
    3. Trigger execution when ready
    
    Call this tool first for any user message in Jarvis mode.
    
    Args:
        user_input: The user's complete message
        
    Returns:
        Appropriate response and any execution actions
    """
    
    # First check for execution intent
    execution_check = await analyze_user_input_for_execution_intent(user_input)
    
    if execution_check["execution_triggered"]:
        return execution_check
    
    # Regular planning mode response
    return {
        "execution_triggered": False,
        "mode": "planning",
        "message": "Continuing in planning mode. Ready to help create your plan. Say 'go to pound town claude code' when ready to execute."
    }

if __name__ == "__main__":
    # Run the MCP server
    mcp.run()