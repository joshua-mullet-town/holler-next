import { NextRequest, NextResponse } from 'next/server';

export const runtime = 'nodejs';

export async function POST(req: NextRequest) {
  try {
    // Check if OpenAI API key is configured
    if (!process.env.OPENAI_API_KEY) {
      console.log('⚠️ No OpenAI API key configured for transcription');
      return NextResponse.json({
        success: false,
        error: 'Transcription service not configured',
        details: 'OPENAI_API_KEY environment variable not set. Please set it to enable voice transcription.',
        fallback: 'Please type your message manually or configure OpenAI API key'
      }, { status: 501 });
    }

    // Get the form data
    const formData = await req.formData();
    const audioFile = formData.get('audio') as File;
    
    if (!audioFile) {
      return NextResponse.json({ 
        success: false, 
        error: 'No audio file provided' 
      }, { status: 400 });
    }

    console.log(`🎙️ Transcribing audio: ${(audioFile.size / 1024).toFixed(1)}KB`);

    // Create form data for OpenAI Whisper API
    const openAIFormData = new FormData();
    openAIFormData.append('file', audioFile, audioFile.name || 'audio.webm');
    openAIFormData.append('model', 'whisper-1');

    // Call OpenAI Whisper API
    const response = await fetch('https://api.openai.com/v1/audio/transcriptions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${process.env.OPENAI_API_KEY}`,
      },
      body: openAIFormData
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('🚨 OpenAI API error:', errorText);
      return NextResponse.json({ 
        success: false, 
        error: 'Transcription service failed',
        details: errorText 
      }, { status: 500 });
    }

    const result = await response.json();
    const transcript = result.text?.trim() || '';

    console.log(`✅ Transcription completed: "${transcript.substring(0, 50)}..."`);
    
    return NextResponse.json({ 
      success: true, 
      transcript: transcript 
    });

  } catch (error) {
    console.error('🚨 Transcription error:', error);
    return NextResponse.json({ 
      success: false, 
      error: 'Internal transcription error',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}