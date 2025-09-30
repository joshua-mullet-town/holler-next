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
import requests
import re
from typing import Dict, Any, Optional
from mcp.server.fastmcp import FastMCP

# Initialize MCP server
mcp = FastMCP("jarvis-executor")

# Constants
HOLLER_API_BASE = "http://localhost:3002/api"
MAGIC_PHRASE = "go to pound town claude code"

@mcp.tool()
async def detect_magic_phrase(text: str) -> Dict[str, Any]:
    """Detect the exact phrase 'go to pound town claude code' and trigger execution.
    
    When this exact phrase is detected, this tool will:
    1. Clear the current session context (/clear)
    2. Change session mode from planning to execution in SQLite
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
    
    Reads the plan from SQLite, updates mode to execution,
    and triggers context clearing + execution prompt.
    
    Args:
        session_id: The session ID to execute the plan for
        
    Returns:
        Dictionary with execution results and status
    """
    
    try:
        print(f"🚀 JARVIS: Starting plan execution for session {session_id}")
        
        # Get session from SQLite API
        session_response = requests.get(f"{HOLLER_API_BASE}/sessions/{session_id}")
        if session_response.status_code != 200:
            return {"success": False, "error": f"Could not fetch session {session_id}"}
        
        session = session_response.json()
        
        if not session.get("jarvisMode"):
            return {"success": False, "error": f"Session {session_id} is not in Jarvis mode"}
        
        # Get the plan
        plan = session.get("plan", "")
        if not plan:
            return {"success": False, "error": "No plan found for execution"}
        
        print(f"📋 JARVIS: Plan to execute: {plan[:200]}...")
        
        # Update session mode to execution via API
        update_response = requests.put(f"{HOLLER_API_BASE}/sessions/{session_id}/mode", 
                                     json={"mode": "execution"})
        
        if update_response.status_code != 200:
            return {"success": False, "error": "Failed to update session mode"}
        
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
        # Get all sessions from SQLite API
        sessions_response = requests.get(f"{HOLLER_API_BASE}/sessions")
        if sessions_response.status_code != 200:
            return None
        
        sessions_data = sessions_response.json()
        sessions = sessions_data.get("sessions", [])
        active_session_id = sessions_data.get("activeSessionId")
        
        # Find active session that has Jarvis mode enabled
        for session in sessions:
            if (session.get("id") == active_session_id and 
                session.get("jarvisMode") == True):
                return session
        
        # Fallback: find any Jarvis session
        for session in sessions:
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
        # Update session mode via API
        response = requests.put(f"{HOLLER_API_BASE}/sessions/{session_id}/mode", 
                              json={"mode": mode})
        
        if response.status_code == 200:
            print(f"✅ JARVIS: Updated session {session_id} mode to '{mode}'")
            return {"success": True, "session_id": session_id, "new_mode": mode}
        else:
            return {"success": False, "error": f"API request failed with status {response.status_code}"}
        
    except Exception as e:
        print(f"❌ JARVIS: Error updating session mode: {str(e)}")
        return {"success": False, "error": str(e)}

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