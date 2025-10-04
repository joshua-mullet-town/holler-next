#!/bin/bash

# Claude Network Activity Monitor
# Shows all Claude PIDs and their network activity, refreshing every second

while true; do
    # Build entire output in a variable first (no flickering!)
    OUTPUT=""
    OUTPUT+="🔍 CLAUDE NETWORK ACTIVITY MONITOR\n"
    OUTPUT+="==================================\n"
    OUTPUT+="$(date)\n"
    OUTPUT+="\n"
    
    # Get all Claude processes
    CLAUDE_PIDS=$(pgrep -f "claude" 2>/dev/null)
    
    if [ -z "$CLAUDE_PIDS" ]; then
        OUTPUT+="❌ No Claude processes found\n"
    else
        OUTPUT+="PID      COMMAND           CPU%    CONNECTIONS    WORKING_DIR\n"
        OUTPUT+="--------------------------------------------------------------\n"
        
        for PID in $CLAUDE_PIDS; do
            # Get process info
            PS_INFO=$(ps -p $PID -o pid,comm,pcpu,args 2>/dev/null | tail -n 1)
            
            if [ -n "$PS_INFO" ]; then
                # Parse ps output
                CPU=$(echo "$PS_INFO" | awk '{print $3}')
                CMD=$(echo "$PS_INFO" | awk '{print $2}' | head -c 15)
                
                # Count network connections for this PID
                CONNECTIONS=$(lsof -i -p $PID 2>/dev/null | grep -v COMMAND | wc -l | tr -d ' ')
                
                # Get working directory for context
                WORKDIR=$(lsof -p $PID 2>/dev/null | grep cwd | awk '{print $9}' | head -c 25)
                if [ -z "$WORKDIR" ]; then
                    WORKDIR="unknown"
                fi
                
                # Show activity indicator based on CPU usage
                if (( $(echo "$CPU > 1.0" | bc -l 2>/dev/null || echo 0) )); then
                    ACTIVITY="🔥 ACTIVE"
                elif (( $(echo "$CPU > 0.1" | bc -l 2>/dev/null || echo 0) )); then
                    ACTIVITY="⚡ BUSY"
                elif [ "$CONNECTIONS" -gt 0 ]; then
                    ACTIVITY="🌐 CONNECTED"
                else
                    ACTIVITY="💤 IDLE"
                fi
                
                # Add to output buffer
                OUTPUT+=$(printf "%-8s %-15s %-6s %-12s %s\n" "$PID" "$CMD" "$CPU%" "$CONNECTIONS" "$WORKDIR")
                OUTPUT+=$(printf "         %s\n" "$ACTIVITY")
            fi
        done
    fi
    
    OUTPUT+="\n"
    OUTPUT+="💡 Legend: 🔥=High CPU, ⚡=Medium CPU, 🌐=Has connections, 💤=Idle\n"
    OUTPUT+="Press Ctrl+C to exit | Refreshing in 2 seconds...\n"
    
    # Clear screen and display everything at once
    clear
    echo -e "$OUTPUT"
    
    sleep 2
done