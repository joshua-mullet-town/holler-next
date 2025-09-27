/**
 * Directories API
 * GET /api/directories
 * 
 * Returns available directories in the code folder
 */

import { NextResponse } from 'next/server';
import { readdirSync, statSync } from 'fs';
import path from 'path';

export async function GET() {
  try {
    const codeDir = '/Users/joshuamullet/code';
    const items = readdirSync(codeDir);
    
    const directories = items
      .filter(item => {
        const itemPath = path.join(codeDir, item);
        try {
          return statSync(itemPath).isDirectory();
        } catch {
          return false;
        }
      })
      .map(dir => {
        const fullPath = path.join(codeDir, dir);
        const stats = statSync(fullPath);
        return {
          path: fullPath,
          mtime: stats.mtime
        };
      })
      .sort((a, b) => b.mtime.getTime() - a.mtime.getTime()) // Most recent first
      .map(item => item.path);
    
    return NextResponse.json({
      success: true,
      directories
    });
    
  } catch (error) {
    console.error('❌ Directory listing error:', error);
    
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Directory listing failed',
      directories: []
    }, { status: 500 });
  }
}