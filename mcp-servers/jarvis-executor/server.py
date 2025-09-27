#!/usr/bin/env python3
"""
🤖 JARVIS EXECUTOR MCP SERVER
Provides tools for Jarvis Mode plan execution workflow

This MCP server provides tools that Claude automatically invokes when:
- User expresses readiness to execute a plan
- User wants to start execution mode
- User indicates they want to move forward with implementation
- Context suggests execution should begin
"""

import asyncio
import json
import os
import re
from typing import Dict, Any, Optional
from mcp.server.fastmcp import FastMCP

# Initialize MCP server
mcp = FastMCP("jarvis-executor")

# Constants
SESSIONS_FILE = "/Users/joshuamullet/code/holler/holler-sessions.json"
MAGIC_PHRASE = "go to pound town claude code"

@mcp.tool()
async def detect_magic_phrase(text: str) -> Dict[str, Any]:
    """Detect the exact phrase 'go to pound town claude code' and trigger execution.
    
    When this exact phrase is detected, this tool will:
    1. Clear the current session context (/clear)
    2. Change session mode from planning to execution in holler-sessions.json
    3. Inject the execution prompt to start implementation
    
    Args:
        text: Text to scan for the magic phrase
        
    Returns:
        Dictionary with detection results and execution actions
    """
    
    # Normalize text for detection (case insensitive, extra whitespace handling)
    normalized_text = re.sub(r'\s+', ' ', text.lower().strip())
    normalized_phrase = MAGIC_PHRASE.lower()
    
    # Check if magic phrase is present
    phrase_detected = normalized_phrase in normalized_text
    
    if phrase_detected:
        print(f"🎯 JARVIS: MAGIC PHRASE DETECTED: '{MAGIC_PHRASE}'")
        print(f"🎯 JARVIS: In text: {text[:100]}...")
        
        # Get active session for execution
        active_session = await get_active_jarvis_session()
        
        if not active_session:
            return {
                "phrase_detected": True,
                "magic_phrase": MAGIC_PHRASE,
                "error": "No active Jarvis session found",
                "execution_triggered": False,
                "action_needed": "enable_jarvis_mode_first"
            }
        
        # Execute the plan workflow
        execution_result = await execute_plan(active_session["id"])
        
        if execution_result["success"]:
            return {
                "phrase_detected": True,
                "magic_phrase": MAGIC_PHRASE,
                "execution_triggered": True,
                "session_id": active_session["id"],
                "session_mode_updated": "execution",
                "clear_command": "/clear",
                "execution_prompt": execution_result["execution_prompt"],
                "workflow_complete": True,
                "message": "🚀 EXECUTION MODE ACTIVATED! Session cleared, mode updated to execution, execution prompt ready."
            }
        else:
            return {
                "phrase_detected": True,
                "magic_phrase": MAGIC_PHRASE,
                "execution_triggered": False,
                "error": execution_result.get("error", "Failed to execute plan"),
                "session_id": active_session["id"]
            }
    
    return {
        "phrase_detected": False,
        "magic_phrase": MAGIC_PHRASE,
        "execution_triggered": False,
        "message": "Magic phrase not detected. Continue planning."
    }

@mcp.tool()
async def execute_plan(session_id: str) -> Dict[str, Any]:
    """Execute the plan for a Jarvis session.
    
    Reads the plan from holler-sessions.json, updates mode to execution,
    and triggers context clearing + execution prompt.
    
    Args:
        session_id: The session ID to execute the plan for
        
    Returns:
        Dictionary with execution results and status
    """
    
    try:
        print(f"🚀 JARVIS: Starting plan execution for session {session_id}")
        
        # Read current sessions file
        sessions_data = await read_sessions_file()
        if not sessions_data:
            return {"success": False, "error": "Could not read sessions file"}
        
        # Find the target session
        target_session = None
        for session in sessions_data.get("sessions", []):
            if session.get("id") == session_id:
                target_session = session
                break
        
        if not target_session:
            return {"success": False, "error": f"Session {session_id} not found"}
        
        if not target_session.get("jarvisMode"):
            return {"success": False, "error": f"Session {session_id} is not in Jarvis mode"}
        
        # Get the plan
        plan = target_session.get("plan", "")
        if not plan:
            return {"success": False, "error": "No plan found for execution"}
        
        print(f"📋 JARVIS: Plan to execute: {plan[:200]}...")
        
        # Update session mode to execution
        target_session["mode"] = "execution"
        
        # Save updated sessions
        await write_sessions_file(sessions_data)
        print(f"✅ JARVIS: Updated session {session_id} mode to 'execution'")
        
        # Build execution prompt with ultra-think instructions
        execution_prompt = f"""🚀 **EXECUTION MODE: One-Shot Plan Implementation**

**ULTRA-THINK APPROACH**: You have ONE chance to execute this plan perfectly. Think deeply about each step before acting.

## Your Mission
Execute the following plan completely and thoroughly:

```
{plan}
```

## Critical Instructions
- **ONE SHOT EXECUTION**: This is your only opportunity - make it count
- **ULTRA-THINK**: Before each action, consider:
  - What exactly needs to be done?
  - What are the potential edge cases?
  - How can I verify this step worked?
  - What could go wrong and how do I prevent it?
- **BE THOROUGH**: Don't rush - think through each step carefully
- **VERIFY YOUR WORK**: Test and validate each change you make
- **COMPLETE THE MISSION**: Execute the entire plan, not just part of it

## Execution Context
- Session ID: {session_id}
- Mode: EXECUTION (one-shot)
- Plan Source: Jarvis Planning Session

---

**BEGIN EXECUTION NOW - ULTRA-THINK AND IMPLEMENT THE PLAN**
"""

        # Note: Context clearing and prompt injection would be handled by Claude Code
        # This tool provides the execution prompt and session management
        
        return {
            "success": True,
            "session_id": session_id,
            "mode_updated": "execution",
            "plan_length": len(plan),
            "execution_prompt": execution_prompt,
            "next_action": "clear_context_and_execute",
            "instructions": [
                "Use /clear command to clear context",
                "Send the execution_prompt to start one-shot execution",
                "Monitor for completion to trigger planning mode again"
            ]
        }
        
    except Exception as e:
        print(f"❌ JARVIS: Error in execute_plan: {str(e)}")
        return {"success": False, "error": str(e)}

@mcp.tool()
async def get_active_jarvis_session() -> Optional[Dict[str, Any]]:
    """Get the currently active Jarvis session.
    
    Returns:
        Dictionary with active session data or None if no active Jarvis session
    """
    
    try:
        sessions_data = await read_sessions_file()
        if not sessions_data:
            return None
        
        # Find active session that has Jarvis mode enabled
        active_session_id = sessions_data.get("activeSessionId")
        
        for session in sessions_data.get("sessions", []):
            if (session.get("id") == active_session_id and 
                session.get("jarvisMode") == True):
                return session
        
        # Fallback: find any Jarvis session
        for session in sessions_data.get("sessions", []):
            if session.get("jarvisMode") == True:
                return session
        
        return None
        
    except Exception as e:
        print(f"❌ JARVIS: Error getting active session: {str(e)}")
        return None

@mcp.tool()
async def update_session_mode(session_id: str, mode: str) -> Dict[str, Any]:
    """Update the mode of a specific session.
    
    Args:
        session_id: The session ID to update
        mode: New mode ("planning" or "execution")
        
    Returns:
        Dictionary with update results
    """
    
    try:
        sessions_data = await read_sessions_file()
        if not sessions_data:
            return {"success": False, "error": "Could not read sessions file"}
        
        # Find and update the session
        updated = False
        for session in sessions_data.get("sessions", []):
            if session.get("id") == session_id:
                session["mode"] = mode
                updated = True
                break
        
        if updated:
            await write_sessions_file(sessions_data)
            print(f"✅ JARVIS: Updated session {session_id} mode to '{mode}'")
            return {"success": True, "session_id": session_id, "new_mode": mode}
        else:
            return {"success": False, "error": f"Session {session_id} not found"}
        
    except Exception as e:
        print(f"❌ JARVIS: Error updating session mode: {str(e)}")
        return {"success": False, "error": str(e)}

# Helper functions for file operations
async def read_sessions_file() -> Optional[Dict[str, Any]]:
    """Read and parse the holler-sessions.json file."""
    try:
        if not os.path.exists(SESSIONS_FILE):
            print(f"❌ JARVIS: Sessions file not found: {SESSIONS_FILE}")
            return None
        
        with open(SESSIONS_FILE, 'r') as f:
            return json.load(f)
    except Exception as e:
        print(f"❌ JARVIS: Error reading sessions file: {str(e)}")
        return None

async def write_sessions_file(sessions_data: Dict[str, Any]) -> bool:
    """Write sessions data back to the holler-sessions.json file."""
    try:
        with open(SESSIONS_FILE, 'w') as f:
            json.dump(sessions_data, f, indent=2)
        return True
    except Exception as e:
        print(f"❌ JARVIS: Error writing sessions file: {str(e)}")
        return False

@mcp.tool()
async def get_current_plan() -> Dict[str, Any]:
    """Get the current plan from the active Jarvis session.
    
    Claude will automatically call this tool when it needs to see what
    plan is being worked on or when the user asks about the current plan.
    
    Returns:
        Dictionary with current plan details
    """
    
    try:
        active_session = await get_active_jarvis_session()
        
        if not active_session:
            return {
                "success": False,
                "error": "No active Jarvis session found",
                "suggestion": "Enable Jarvis Mode on a session first"
            }
        
        plan = active_session.get("plan", "")
        mode = active_session.get("mode", "planning")
        
        return {
            "success": True,
            "session_id": active_session["id"],
            "session_name": active_session.get("name", "Unnamed Session"),
            "current_mode": mode,
            "plan": plan if plan else "No plan created yet",
            "plan_length": len(plan) if plan else 0,
            "ready_for_execution": bool(plan and mode == "planning")
        }
        
    except Exception as e:
        print(f"❌ JARVIS: Error getting current plan: {str(e)}")
        return {"success": False, "error": str(e)}

if __name__ == "__main__":
    # Run the MCP server
    mcp.run()