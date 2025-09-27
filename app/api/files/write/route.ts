import { NextRequest, NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';

export async function POST(request: NextRequest) {
  try {
    const { filePath, content } = await request.json();
    
    if (!filePath) {
      return NextResponse.json({ error: 'File path is required' }, { status: 400 });
    }

    if (content === undefined) {
      return NextResponse.json({ error: 'Content is required' }, { status: 400 });
    }

    // Security check - only allow writing to specific directories
    const allowedPaths = [
      '/Users/joshuamullet/code/holler',
      '/Users/joshuamullet/code/clawtree',
      '/Users/joshuamullet/code/mullet-town',
      '/Users/joshuamullet/code/carving-creek',
      '/Users/joshuamullet/code/claude-code-webui',
      '/Users/joshuamullet/code'
    ];
    
    const isAllowed = allowedPaths.some(allowedPath => 
      filePath.startsWith(allowedPath)
    );
    
    if (!isAllowed) {
      return NextResponse.json({ error: 'File path not allowed' }, { status: 403 });
    }

    // Additional security - only allow .md files
    if (!filePath.endsWith('.md')) {
      return NextResponse.json({ error: 'Only .md files can be written' }, { status: 403 });
    }

    // Ensure directory exists
    const dirPath = path.dirname(filePath);
    if (!fs.existsSync(dirPath)) {
      fs.mkdirSync(dirPath, { recursive: true });
    }

    // Write the file
    fs.writeFileSync(filePath, content, 'utf8');
    
    return NextResponse.json({ 
      success: true, 
      message: 'File saved successfully' 
    });
    
  } catch (error) {
    console.error('❌ Error writing file:', error);
    return NextResponse.json({ error: 'Failed to write file' }, { status: 500 });
  }
}