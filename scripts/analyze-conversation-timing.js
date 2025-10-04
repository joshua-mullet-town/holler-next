#!/usr/bin/env node

/**
 * 🕰️ CONVERSATION TIMING ANALYZER
 * 
 * Analyzes Claude session JSONL files to determine:
 * 1. Longest gaps between consecutive assistant messages
 * 2. Patterns during execution vs planning phases
 * 3. Recommended timeout values for smart execution detection
 */

const fs = require('fs');
const path = require('path');

class ConversationTimingAnalyzer {
  constructor() {
    this.assistantMessages = [];
    this.userMessages = [];
    this.allMessages = [];
  }

  /**
   * Parse a Claude session JSONL file
   */
  parseSessionFile(filePath) {
    console.log(`📁 Analyzing: ${filePath}`);
    
    const content = fs.readFileSync(filePath, 'utf8');
    const lines = content.trim().split('\n').filter(line => line.trim());
    
    console.log(`📊 Total lines: ${lines.length}`);
    
    for (const line of lines) {
      try {
        const message = JSON.parse(line);
        
        // Skip non-message entries
        if (!message.type || !message.timestamp) continue;
        
        const timestamp = new Date(message.timestamp);
        const messageData = {
          type: message.type,
          timestamp,
          timestampMs: timestamp.getTime(),
          role: message.message?.role,
          contentLength: this.getContentLength(message.message),
          hasToolUse: this.hasToolUse(message.message),
          raw: message
        };
        
        this.allMessages.push(messageData);
        
        if (message.type === 'assistant' && message.message?.role === 'assistant') {
          this.assistantMessages.push(messageData);
        } else if (message.type === 'user' && message.message?.role === 'user') {
          this.userMessages.push(messageData);
        }
        
      } catch (error) {
        console.warn(`⚠️ Failed to parse line: ${error.message}`);
      }
    }
    
    console.log(`🤖 Assistant messages: ${this.assistantMessages.length}`);
    console.log(`👤 User messages: ${this.userMessages.length}`);
    console.log(`📝 All messages: ${this.allMessages.length}`);
  }

  /**
   * Get content length from message
   */
  getContentLength(message) {
    if (!message?.content) return 0;
    
    if (typeof message.content === 'string') {
      return message.content.length;
    }
    
    if (Array.isArray(message.content)) {
      return message.content.reduce((total, item) => {
        if (item.type === 'text' && item.text) {
          return total + item.text.length;
        }
        return total;
      }, 0);
    }
    
    return 0;
  }

  /**
   * Check if message has tool use
   */
  hasToolUse(message) {
    if (!message?.content || !Array.isArray(message.content)) return false;
    
    return message.content.some(item => item.type === 'tool_use');
  }

  /**
   * Analyze gaps between consecutive assistant messages
   */
  analyzeAssistantMessageGaps() {
    console.log('\n🔍 ANALYZING ASSISTANT MESSAGE GAPS');
    console.log('=' .repeat(50));
    
    if (this.assistantMessages.length < 2) {
      console.log('❌ Need at least 2 assistant messages to analyze gaps');
      return { gaps: [], stats: null };
    }
    
    const gaps = [];
    
    for (let i = 1; i < this.assistantMessages.length; i++) {
      const prev = this.assistantMessages[i - 1];
      const curr = this.assistantMessages[i];
      
      const gapMs = curr.timestampMs - prev.timestampMs;
      const gapSeconds = gapMs / 1000;
      
      // Find any user messages between these assistant messages
      const userMessagesBetween = this.userMessages.filter(msg => 
        msg.timestampMs > prev.timestampMs && msg.timestampMs < curr.timestampMs
      );
      
      const gap = {
        index: i,
        gapMs,
        gapSeconds,
        gapMinutes: gapSeconds / 60,
        prevMessage: {
          timestamp: prev.timestamp.toISOString(),
          contentLength: prev.contentLength,
          hasToolUse: prev.hasToolUse
        },
        currMessage: {
          timestamp: curr.timestamp.toISOString(),
          contentLength: curr.contentLength,
          hasToolUse: curr.hasToolUse
        },
        userMessagesBetween: userMessagesBetween.length,
        // Execution indicators
        likelyExecution: userMessagesBetween.length === 0 && gapSeconds > 5,
        // Planning indicators  
        likelyPlanning: userMessagesBetween.length > 0 || gapSeconds < 5
      };
      
      gaps.push(gap);
    }
    
    // Sort by gap duration
    const sortedGaps = [...gaps].sort((a, b) => b.gapSeconds - a.gapSeconds);
    
    // Calculate statistics
    const gapSeconds = gaps.map(g => g.gapSeconds);
    const stats = {
      count: gaps.length,
      total: gapSeconds.reduce((a, b) => a + b, 0),
      average: gapSeconds.reduce((a, b) => a + b, 0) / gaps.length,
      median: this.calculateMedian(gapSeconds),
      min: Math.min(...gapSeconds),
      max: Math.max(...gapSeconds),
      percentile95: this.calculatePercentile(gapSeconds, 95),
      percentile90: this.calculatePercentile(gapSeconds, 90),
      percentile75: this.calculatePercentile(gapSeconds, 75)
    };
    
    // Categorize gaps
    const executionGaps = gaps.filter(g => g.likelyExecution);
    const planningGaps = gaps.filter(g => g.likelyPlanning);
    
    console.log(`📊 OVERALL STATISTICS:`);
    console.log(`   Total gaps: ${stats.count}`);
    console.log(`   Average gap: ${stats.average.toFixed(1)}s`);
    console.log(`   Median gap: ${stats.median.toFixed(1)}s`);
    console.log(`   Min gap: ${stats.min.toFixed(1)}s`);
    console.log(`   Max gap: ${stats.max.toFixed(1)}s`);
    console.log(`   95th percentile: ${stats.percentile95.toFixed(1)}s`);
    console.log(`   90th percentile: ${stats.percentile90.toFixed(1)}s`);
    console.log(`   75th percentile: ${stats.percentile75.toFixed(1)}s`);
    
    console.log(`\n🤖 EXECUTION-LIKE GAPS (no user messages between):`);
    console.log(`   Count: ${executionGaps.length}`);
    if (executionGaps.length > 0) {
      const execSeconds = executionGaps.map(g => g.gapSeconds);
      console.log(`   Average: ${(execSeconds.reduce((a, b) => a + b, 0) / execSeconds.length).toFixed(1)}s`);
      console.log(`   Max: ${Math.max(...execSeconds).toFixed(1)}s`);
      console.log(`   95th percentile: ${this.calculatePercentile(execSeconds, 95).toFixed(1)}s`);
    }
    
    console.log(`\n💬 PLANNING-LIKE GAPS (with user interaction):`);
    console.log(`   Count: ${planningGaps.length}`);
    if (planningGaps.length > 0) {
      const planSeconds = planningGaps.map(g => g.gapSeconds);
      console.log(`   Average: ${(planSeconds.reduce((a, b) => a + b, 0) / planSeconds.length).toFixed(1)}s`);
      console.log(`   Max: ${Math.max(...planSeconds).toFixed(1)}s`);
    }
    
    console.log(`\n🏆 TOP 10 LONGEST GAPS:`);
    sortedGaps.slice(0, 10).forEach((gap, i) => {
      console.log(`   ${i + 1}. ${gap.gapSeconds.toFixed(1)}s (${gap.gapMinutes.toFixed(1)}m) - ${gap.likelyExecution ? 'EXECUTION' : 'PLANNING'}`);
      console.log(`      From: ${gap.prevMessage.timestamp}`);
      console.log(`      To:   ${gap.currMessage.timestamp}`);
      console.log(`      User messages between: ${gap.userMessagesBetween}`);
      console.log('');
    });
    
    return { gaps, stats, executionGaps, planningGaps, sortedGaps };
  }

  /**
   * Generate timeout recommendations
   */
  generateTimeoutRecommendations(analysis) {
    console.log('\n⏰ TIMEOUT RECOMMENDATIONS');
    console.log('=' .repeat(50));
    
    const { stats, executionGaps, sortedGaps } = analysis;
    
    // Conservative approach: Use 95th percentile + buffer
    const conservative = Math.ceil(stats.percentile95 + 5);
    
    // Aggressive approach: Use 75th percentile + small buffer  
    const aggressive = Math.ceil(stats.percentile75 + 2);
    
    // Execution-focused: Use execution gaps 95th percentile
    let executionFocused = conservative;
    if (executionGaps.length > 0) {
      const execSeconds = executionGaps.map(g => g.gapSeconds);
      executionFocused = Math.ceil(this.calculatePercentile(execSeconds, 95) + 3);
    }
    
    // Smart adaptive: Start with aggressive, escalate to conservative
    const smartAdaptive = {
      initial: aggressive,
      escalated: conservative,
      description: `Start with ${aggressive}s timeout, if triggered more than 2x in a row, escalate to ${conservative}s`
    };
    
    console.log(`🐌 CONSERVATIVE (95th percentile + 5s): ${conservative}s`);
    console.log(`   - Catches 95% of normal gaps`);
    console.log(`   - Very low false positives`);
    console.log(`   - May wait too long for actual completion`);
    
    console.log(`\n⚡ AGGRESSIVE (75th percentile + 2s): ${aggressive}s`);
    console.log(`   - Faster response time`);
    console.log(`   - May have false positives`);
    console.log(`   - Good for interactive feel`);
    
    console.log(`\n🎯 EXECUTION-FOCUSED: ${executionFocused}s`);
    console.log(`   - Based on execution-like gaps only`);
    console.log(`   - Optimized for long-running tasks`);
    
    console.log(`\n🧠 SMART ADAPTIVE:`);
    console.log(`   - Initial timeout: ${smartAdaptive.initial}s`);
    console.log(`   - Escalated timeout: ${smartAdaptive.escalated}s`);
    console.log(`   - Strategy: ${smartAdaptive.description}`);
    
    // Real-world analysis
    console.log(`\n🌍 REAL-WORLD ANALYSIS:`);
    const veryLongGaps = sortedGaps.filter(g => g.gapSeconds > 30);
    console.log(`   - Gaps > 30s: ${veryLongGaps.length}`);
    console.log(`   - Gaps > 60s: ${sortedGaps.filter(g => g.gapSeconds > 60).length}`);
    console.log(`   - Gaps > 120s: ${sortedGaps.filter(g => g.gapSeconds > 120).length}`);
    
    if (veryLongGaps.length > 0) {
      console.log(`\n   🔍 Very long gaps (>30s) analysis:`);
      veryLongGaps.slice(0, 5).forEach(gap => {
        console.log(`      ${gap.gapSeconds.toFixed(1)}s - ${gap.likelyExecution ? 'EXECUTION' : 'PLANNING'} - ${gap.userMessagesBetween} user msgs`);
      });
    }
    
    return {
      conservative,
      aggressive, 
      executionFocused,
      smartAdaptive,
      recommendations: {
        fastest: aggressive,
        balanced: executionFocused,
        safest: conservative,
        recommended: smartAdaptive.initial
      }
    };
  }

  /**
   * Helper: Calculate median
   */
  calculateMedian(numbers) {
    const sorted = [...numbers].sort((a, b) => a - b);
    const mid = Math.floor(sorted.length / 2);
    return sorted.length % 2 === 0 
      ? (sorted[mid - 1] + sorted[mid]) / 2
      : sorted[mid];
  }

  /**
   * Helper: Calculate percentile
   */
  calculatePercentile(numbers, percentile) {
    const sorted = [...numbers].sort((a, b) => a - b);
    const index = (percentile / 100) * (sorted.length - 1);
    const lower = Math.floor(index);
    const upper = Math.ceil(index);
    const weight = index - lower;
    
    if (upper >= sorted.length) return sorted[sorted.length - 1];
    return sorted[lower] * (1 - weight) + sorted[upper] * weight;
  }

  /**
   * Analyze the conversation and generate report
   */
  analyze(filePath) {
    this.parseSessionFile(filePath);
    const gapAnalysis = this.analyzeAssistantMessageGaps();
    const timeoutRecommendations = this.generateTimeoutRecommendations(gapAnalysis);
    
    console.log('\n🎯 EXECUTIVE SUMMARY');
    console.log('=' .repeat(50));
    console.log(`📊 Analyzed ${this.assistantMessages.length} assistant messages`);
    console.log(`⏱️ Longest gap: ${gapAnalysis.stats.max.toFixed(1)}s (${(gapAnalysis.stats.max / 60).toFixed(1)}m)`);
    console.log(`📈 95th percentile: ${gapAnalysis.stats.percentile95.toFixed(1)}s`);
    console.log(`🎯 Recommended timeout: ${timeoutRecommendations.recommendations.recommended}s`);
    
    return {
      gapAnalysis,
      timeoutRecommendations,
      summary: {
        totalAssistantMessages: this.assistantMessages.length,
        longestGapSeconds: gapAnalysis.stats.max,
        recommendedTimeoutSeconds: timeoutRecommendations.recommended
      }
    };
  }
}

// Main execution
function main() {
  const args = process.argv.slice(2);
  
  if (args.length === 0) {
    console.log('🕰️ CONVERSATION TIMING ANALYZER');
    console.log('Usage: node analyze-conversation-timing.js <session-file.jsonl>');
    console.log('');
    console.log('To analyze the most recent large session:');
    
    // Find the most recent large session file
    const claudeDir = path.join(require('os').homedir(), '.claude', 'projects');
    const { execSync } = require('child_process');
    
    try {
      const recentLargeFiles = execSync(
        `find "${claudeDir}" -name "*.jsonl" -type f -size +1M -exec ls -latr {} \\; | tail -3`,
        { encoding: 'utf8' }
      ).trim().split('\n');
      
      console.log('Recent large session files:');
      recentLargeFiles.forEach((line, i) => {
        const parts = line.split(/\s+/);
        const filePath = parts[parts.length - 1];
        const fileName = path.basename(filePath);
        const size = parts[4];
        console.log(`  ${i + 1}. ${fileName} (${size} bytes)`);
        console.log(`     node analyze-conversation-timing.js "${filePath}"`);
      });
    } catch (error) {
      console.log('❌ Could not find recent session files');
    }
    
    return;
  }
  
  const sessionFile = args[0];
  
  if (!fs.existsSync(sessionFile)) {
    console.error(`❌ File not found: ${sessionFile}`);
    process.exit(1);
  }
  
  const analyzer = new ConversationTimingAnalyzer();
  const results = analyzer.analyze(sessionFile);
  
  console.log('\n✅ Analysis complete! Use these insights to build your smart timeout system.');
}

if (require.main === module) {
  main();
}

module.exports = ConversationTimingAnalyzer;