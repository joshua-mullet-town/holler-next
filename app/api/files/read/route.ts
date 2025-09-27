import { NextRequest, NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';

export async function POST(request: NextRequest) {
  try {
    const { filePath } = await request.json();
    
    if (!filePath) {
      return NextResponse.json({ error: 'File path is required' }, { status: 400 });
    }

    // Security check - only allow reading from specific directories
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

    // Check if file exists and read it
    if (!fs.existsSync(filePath)) {
      return NextResponse.json({ error: 'File not found' }, { status: 404 });
    }

    const content = fs.readFileSync(filePath, 'utf8');
    
    return new NextResponse(content, {
      status: 200,
      headers: {
        'Content-Type': 'text/plain; charset=utf-8',
      },
    });
    
  } catch (error) {
    console.error('❌ Error reading file:', error);
    return NextResponse.json({ error: 'Failed to read file' }, { status: 500 });
  }
}