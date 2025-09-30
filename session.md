# Jarvis Mode - Voice Collaborative AI Development System

## 🎯 Vision Complete: Tag-Team Planner/Executor System

**CORE CONCEPT**: Voice-collaborative development where user walks around hands-free while Claude handles the technical execution through intelligent session cycling.

## ✅ COMPLETED MAJOR MILESTONES

### 1. **Jarvis Mode Toggle & Session Management** ✅
- **UI Toggle**: Replaced autonomous mode with Jarvis Mode toggle (🤖 blue glow)
- **Session State**: Added `jarvisMode: boolean` and `mode: "planning"|"execution"` to SQLite sessions table  
- **Plan Storage**: Persistent plan management in SQLite sessions table

### 2. **Magic Phrase Execution System** ✅
- **Natural Language Mapping**: "go to pound town claude code" → `/execute-plan` via CLAUDE.md
- **Slash Command**: `/execute-plan` triggers complete execution workflow
- **Non-Blocking Job Queue**: Script schedules commands with backend, exits immediately to prevent deadlock

### 3. **Planning → Execution Transition** ✅
- **Trigger**: Magic phrase automatically detected by Claude Code natural language mapping
- **Process**: 
  1. Updates session mode: planning → execution
  2. Schedules `/clear` command (10 seconds)
  3. Schedules execution prompt (15 seconds)  
  4. Backend handles delayed execution while script exits
- **Fresh Context**: `/clear` actually works with proper timing, ensuring clean execution start

### 4. **Voice-Optimized Planning Prompts** ✅
- **Concise Responses**: Short, decision-focused prompts for screen-free users
- **Plan Building**: Comprehensive planning stored in SQLite sessions table
- **Context Management**: Clean conversation context without metadata bloat

## 🚧 REMAINING CRITICAL COMPONENTS

### 1. **Completion Detection System** ✅ FULLY WORKING!
**PRIORITY: HIGH** - Core to the domino cycle workflow *(✅ COMPLETE)*

**🎉 BREAKTHROUGH ACHIEVED**: Execution → Planning auto-transition is now working!

**Implementation Complete**:
```javascript
// ✅ WORKING: Monitor for Claude session completion
fileMonitor.on('stop', (event) => {
  // ✅ WORKING: Check execution mode completion
  if (hollerSession && hollerSession.jarvisMode && hollerSession.mode === 'execution') {
    handleJarvisExecutionCompletion(hollerSession, event, io, terminalManager);
  }
});

// ✅ WORKING: Switch to planning mode + inject prompt
async function handleJarvisExecutionCompletion(hollerSession, event, io, terminalManager) {
  // 1. Update session mode: execution → planning
  session.mode = 'planning';
  sessionManager.updateSessionMode(session.id, 'planning');
  
  // 2. Inject planning prompt after 2-second delay
  setTimeout(() => injectPlanningPrompt(hollerSession, terminalManager), 2000);
}
```

**Auto-Transition Workflow** (✅ Working):
1. **Monitor**: Listen for Claude session completion events (✅ WORKING)
2. **Check**: Is `jarvisMode: true` AND `mode: "execution"`? (✅ WORKING)  
3. **Action**: Switch to planning mode + inject planning prompt (✅ WORKING)
4. **Cycle**: User can now voice-collaborate on next steps (✅ WORKING)

**Planning Prompt Injection**:
- **Content**: Contextual prompt with execution summary and next steps
- **Delivery**: Automatically sent to terminal to trigger Claude response
- **Voice-Ready**: Response will be read aloud via TTS system

### 2. **Text-to-Speech for Planning Mode** ✅ FULLY WORKING!
**PRIORITY: HIGH** - Essential for hands-free voice collaboration *(✅ COMPLETE)*

**🎉 BREAKTHROUGH ACHIEVED**: TTS is now working end-to-end! Key discoveries:

**HAPPY ACCIDENT**: System captures **every** assistant message, not just final responses! This provides:
- **Immediate feedback** for each Claude response part
- **Better conversational flow** - user hears Claude's thinking as it progresses  
- **More responsive voice collaboration** vs waiting for complete responses

**What We Fixed**:
1. **Server Crashes**: Removed broken duplicate code in server-working.js that caused crashes on message send
2. **Session Correlation**: Manual session ID correlation works - system finds correct Holler session for Claude session
3. **React State Timing**: Fixed React state race condition using useRef + useState pattern
4. **TTS Manager Initialization**: Enhanced dynamic import with robust fallback system
5. **Performance**: Removed right panel file I/O overhead that was causing slowdowns

**Critical Technical Solution - React State Timing Issue**:
```javascript
// PROBLEM: React state updates are async, socket events fired before TTS manager was available
// SOLUTION: Use useRef for immediate access + useState for React lifecycle
const [ttsManager, setTtsManager] = useState<any>(null);
const ttsManagerRef = useRef<any>(null);

// Set both immediately during initialization
setTtsManager(ttsInstance);
ttsManagerRef.current = ttsInstance;

// Use ref in socket handlers for immediate access
const activeTtsManager = ttsManagerRef.current || ttsManager;
```

**Backend Pipeline** (✅ Working):
```javascript
// 1. File monitor detects Claude 'stop' events (✅ WORKING)
// 2. Find Holler session by Claude ID (✅ WORKING)  
// 3. Check: session.jarvisMode === true && session.mode === "planning" (✅ WORKING)
// 4. Extract assistant message with type: "text" only (✅ WORKING)
// 5. Emit 'jarvis-tts' socket event to frontend (✅ WORKING)
```

**Frontend Pipeline** (✅ Working):
```javascript  
// 1. Receive 'jarvis-tts' socket event (✅ WORKING)
// 2. Find session and verify Jarvis mode (✅ WORKING)
// 3. Auto-enable TTS manager if needed (✅ WORKING)
// 4. Queue message for speech synthesis (✅ WORKING)
// 5. Web Speech API speaks the message (✅ WORKING)
```

**Message Extraction Rules**:
- **Target**: Every assistant message (not just final ones)
- **Content Type**: Text content only (skip tool usage, thinking, etc.)
- **Scope**: Current message being processed (example: individual responses in multi-part Claude replies)
- **Filter Out**: Tool descriptions, file paths, code snippets in speech

**TTS Implementation - Web Speech API Research**:
- **Technology**: Web Speech API SpeechSynthesis (built into modern browsers)
- **Browser Support**: Chrome, Edge, Safari (excellent support in 2025)
- **Text Limit**: 32,767 characters maximum per utterance
- **Voice Settings**: Default system voice initially (getVoices() for future customization)
- **User Control**: Always auto-speak for Jarvis planning mode
- **Interrupt**: cancel() method available (future feature)

**Implementation Code Pattern**:
```javascript
// Browser support check
if ('speechSynthesis' in window) {
  const utterance = new SpeechSynthesisUtterance(text);
  utterance.rate = 1.0;     // Normal speed
  utterance.volume = 1.0;   // Full volume
  utterance.pitch = 1.0;    // Normal pitch
  
  // Event handlers
  utterance.onstart = () => console.log('Speech started');
  utterance.onend = () => console.log('Speech ended');
  utterance.onerror = (error) => console.error('Speech error:', error);
  
  // Speak the text
  window.speechSynthesis.speak(utterance);
} else {
  throw new Error('Speech synthesis not supported');
}
```

**Error Handling**:
- **No Message Found**: Log error, continue silently
- **TTS Not Available**: Log error to console with timestamp
- **Unexpected Errors**: Log to console for debugging
- **Format**: `{ error: "TTS failed", timestamp: "...", details: "..." }`

**Workflow**:
1. **Monitor**: Listen for 'stop' event completion
2. **Check**: Is `jarvisMode: true` AND `mode: "planning"`?
3. **Extract**: Get last assistant text message (clean content)
4. **Speak**: Use Web Speech API to read response aloud
5. **Debug**: Log errors to console for joint debugging

## 🎬 TARGET USER EXPERIENCE

### **Complete Domino Cycle**:
1. **Planning Mode**: User voice-collaborates with Claude, plan builds in SQLite
2. **Magic Phrase**: "go to pound town claude code" → automatic execution trigger
3. **Execution Mode**: Fresh context, one-shot implementation, no user interaction needed
4. **Auto-Transition**: Completion detected → back to planning mode automatically
5. **Voice Response**: Claude's planning response read aloud → cycle continues

### **Voice-First Design**:
- **No Screen Required**: User can walk around, think aloud, collaborate naturally
- **Intelligent Transitions**: System handles all technical session management
- **Fresh Context Cycles**: Each execution starts clean, avoiding token bloat
- **Persistent Plans**: Context carries forward through cycles via SQLite

## 🔧 REMAINING TECHNICAL CHALLENGES

### **Event Detection**:
- Hook into Claude Code session lifecycle events
- Reliable completion detection (not just token streaming end)
- Distinguish between pause vs. completion

### **TTS Integration**:
- Text-to-speech library integration (Web Speech API? External tool?)
- Message content extraction and cleaning
- Audio output management

### **Error Handling**:
- Failed execution detection
- Session state recovery
- Graceful degradation when components fail

## 🎯 SUCCESS METRICS

✅ **Magic phrase triggers execution** - WORKING  
✅ **Context clears properly** - WORKING  
✅ **Non-blocking job queue** - WORKING  
✅ **Execution → Planning auto-transition** - WORKING  
✅ **TTS for planning responses** - WORKING  

**🎉 GOAL ACHIEVED**: Complete hands-free development cycles with voice collaboration and automatic technical execution are now fully functional!

**CORE DOMINO CYCLE**: Planning → Magic Phrase → Execution → Auto-Transition → Planning (with TTS)