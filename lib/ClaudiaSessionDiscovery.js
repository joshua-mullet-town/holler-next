/**
 * Claudia-inspired Session Discovery Service
 * Based on Claudia's proven approach to Claude session discovery
 * Scans all directories in ~/.claude/projects/ and dynamically detects project paths
 */

const fs = require('fs').promises;
const fsSync = require('fs');
const path = require('path');
const os = require('os');

class ClaudiaSessionDiscovery {
  static get claudeDir() {
    return path.join(os.homedir(), '.claude');
  }

  static get projectsDir() {
    return path.join(this.claudeDir, 'projects');
  }

  /**
   * Gets the actual project path by reading the cwd from the first JSONL entry
   * This is Claudia's approach - don't trust directory names, read from session files
   */
  static async getProjectPathFromSessions(projectDir) {
    try {
      const entries = await fs.readdir(projectDir);
      
      for (const entry of entries) {
        const filePath = path.join(projectDir, entry);
        const stat = await fs.stat(filePath);
        
        if (stat.isFile() && entry.endsWith('.jsonl')) {
          try {
            // Read first line of JSONL file
            const content = await fs.readFile(filePath, 'utf8');
            const lines = content.split('\n').filter(line => line.trim());
            
            if (lines.length > 0) {
              const firstEntry = JSON.parse(lines[0]);
              if (firstEntry.cwd) {
                return firstEntry.cwd;
              }
            }
          } catch (err) {
            // Continue to next file if this one fails
            continue;
          }
        }
      }
      
      throw new Error('No valid JSONL files found with cwd field');
    } catch (error) {
      throw new Error(`Failed to determine project path: ${error.message}`);
    }
  }

  /**
   * Lists all projects in ~/.claude/projects directory
   * Returns projects with their sessions and metadata
   */
  static async listAllProjects() {
    try {
      if (!fsSync.existsSync(this.projectsDir)) {
        console.log('⚠️ Claude projects directory not found:', this.projectsDir);
        return [];
      }

      const projects = [];
      const entries = await fs.readdir(this.projectsDir);

      for (const entry of entries) {
        const projectDir = path.join(this.projectsDir, entry);
        const stat = await fs.stat(projectDir);

        if (stat.isDirectory()) {
          try {
            // Get actual project path from session files (Claudia's approach)
            let projectPath;
            try {
              projectPath = await this.getProjectPathFromSessions(projectDir);
            } catch (err) {
              console.log(`⚠️ Could not determine project path for ${entry}, skipping:`, err.message);
              continue;
            }

            // List all JSONL files (sessions) in this directory
            const sessionFiles = await fs.readdir(projectDir);
            const sessions = [];
            let mostRecentSession = null;

            for (const file of sessionFiles) {
              if (file.endsWith('.jsonl')) {
                const sessionId = file.replace('.jsonl', '');
                const sessionPath = path.join(projectDir, file);
                const sessionStat = await fs.stat(sessionPath);

                const sessionData = {
                  sessionId,
                  projectId: entry,
                  projectPath,
                  createdAt: sessionStat.birthtime || sessionStat.ctime,
                  modifiedAt: sessionStat.mtime,
                  filePath: sessionPath,
                  fileSize: sessionStat.size
                };

                sessions.push(sessionData);

                // Track most recent session
                if (!mostRecentSession || sessionStat.mtime > mostRecentSession.modifiedAt) {
                  mostRecentSession = sessionData;
                }
              }
            }

            // Sort sessions by modification time (newest first)
            sessions.sort((a, b) => b.modifiedAt - a.modifiedAt);

            projects.push({
              id: entry,
              path: projectPath,
              sessions,
              createdAt: stat.birthtime || stat.ctime,
              mostRecentSession: mostRecentSession ? mostRecentSession.modifiedAt : null,
              sessionCount: sessions.length
            });
          } catch (error) {
            console.log(`⚠️ Error processing project ${entry}:`, error.message);
            continue;
          }
        }
      }

      // Sort projects by most recent session activity
      projects.sort((a, b) => {
        const aTime = a.mostRecentSession || a.createdAt;
        const bTime = b.mostRecentSession || b.createdAt;
        return new Date(bTime) - new Date(aTime);
      });

      return projects;
    } catch (error) {
      console.error('❌ Error listing projects:', error);
      return [];
    }
  }

  /**
   * Gets the most recent session across ALL projects
   * This replaces our buggy getMostRecentSession logic
   */
  static async getMostRecentSession() {
    try {
      const projects = await this.listAllProjects();
      let mostRecentSession = null;

      for (const project of projects) {
        if (project.sessions.length > 0) {
          const projectMostRecent = project.sessions[0]; // Already sorted newest first
          
          if (!mostRecentSession || projectMostRecent.modifiedAt > mostRecentSession.modifiedAt) {
            mostRecentSession = projectMostRecent;
          }
        }
      }

      if (mostRecentSession) {
        return {
          sessionId: mostRecentSession.sessionId,
          projectPath: mostRecentSession.projectPath,
          createdAt: mostRecentSession.createdAt.getTime(),
          modifiedAt: mostRecentSession.modifiedAt.getTime(),
          timestamp: mostRecentSession.modifiedAt.toISOString(),
          filePath: mostRecentSession.filePath,
          fileSize: mostRecentSession.fileSize
        };
      }

      return null;
    } catch (error) {
      console.error('❌ Error getting most recent session:', error);
      return null;
    }
  }

  /**
   * Debug function to show discovery results
   */
  static async debugDiscovery() {
    console.log('\n🔍🔍🔍 CLAUDIA SESSION DISCOVERY DEBUG 🔍🔍🔍');
    
    const projects = await this.listAllProjects();
    console.log(`📊 Found ${projects.length} projects total`);
    
    let totalSessions = 0;
    for (const project of projects) {
      console.log(`📁 Project: ${project.path} (${project.sessionCount} sessions)`);
      totalSessions += project.sessionCount;
      
      // Show most recent sessions in this project
      const recentSessions = project.sessions.slice(0, 3);
      for (const session of recentSessions) {
        console.log(`  📄 ${session.sessionId} - Modified: ${session.modifiedAt.toISOString()}`);
      }
    }
    
    console.log(`📊 Total sessions across all projects: ${totalSessions}`);
    
    const mostRecent = await this.getMostRecentSession();
    if (mostRecent) {
      console.log(`🏆 Most recent session: ${mostRecent.sessionId} from ${mostRecent.projectPath}`);
      console.log(`⏰ Modified: ${mostRecent.timestamp}`);
    }
    
    console.log('🔍🔍🔍 END CLAUDIA DISCOVERY DEBUG 🔍🔍🔍\n');
  }
}

module.exports = ClaudiaSessionDiscovery;