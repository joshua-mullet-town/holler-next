/**
 * Supercharged TTS Manager - Research-based Web Speech API optimization
 * Based on production implementations and voice quality research
 */

class SuperchargedTTSManager {
  constructor() {
    this.queue = [];
    this.isProcessing = false;
    this.isEnabled = false;
    this.isSupported = 'speechSynthesis' in window;
    this.bestVoice = null;
    this.voiceQualityCache = new Map();
    
    if (!this.isSupported) {
      console.warn('🔇 SUPERCHARGED TTS: Speech synthesis not supported in this browser');
      return;
    }

    // Initialize voice selection when voices are loaded
    this.initializeVoices();
  }

  initializeVoices() {
    // Voices may load asynchronously
    if (speechSynthesis.getVoices().length === 0) {
      speechSynthesis.addEventListener('voiceschanged', () => {
        this.selectBestVoice();
      });
    } else {
      this.selectBestVoice();
    }
  }

  selectBestVoice() {
    const voices = speechSynthesis.getVoices();
    console.log('🎤 SUPERCHARGED TTS: Analyzing', voices.length, 'available voices');

    // Research-based voice quality scoring
    const voiceScores = voices.map(voice => ({
      voice,
      score: this.calculateVoiceQuality(voice)
    }));

    // Sort by quality score (highest first)
    voiceScores.sort((a, b) => b.score - a.score);
    
    // Select the best voice
    this.bestVoice = voiceScores[0]?.voice || voices[0];
    
    console.log('✅ SUPERCHARGED TTS: Selected best voice:', {
      name: this.bestVoice.name,
      lang: this.bestVoice.lang,
      quality: this.bestVoice.localService ? 'Local' : 'Cloud',
      score: voiceScores[0]?.score
    });

    // Log top 3 voices for debugging
    console.log('🏆 SUPERCHARGED TTS: Top 3 voices:');
    voiceScores.slice(0, 3).forEach((item, index) => {
      console.log(`${index + 1}. ${item.voice.name} (${item.voice.lang}) - Score: ${item.score}`);
    });
  }

  calculateVoiceQuality(voice) {
    let score = 0;

    // Research finding: Cloud voices are usually higher quality
    if (!voice.localService) {
      score += 50; // Cloud/remote voices get bonus
    }

    // Research finding: These names indicate high-quality voices
    const highQualityIndicators = [
      'neural', 'natural', 'enhanced', 'premium', 'wavenet', 
      'studio', 'journey', 'news', 'alloy', 'echo', 'nova'
    ];
    
    const lowQualityIndicators = [
      'robot', 'whisper', 'bad', 'low', 'basic', 'default',
      'monotone', 'computer', 'artificial'
    ];

    const voiceName = voice.name.toLowerCase();
    
    // Bonus for high-quality indicators
    highQualityIndicators.forEach(indicator => {
      if (voiceName.includes(indicator)) {
        score += 30;
      }
    });

    // Penalty for low-quality indicators  
    lowQualityIndicators.forEach(indicator => {
      if (voiceName.includes(indicator)) {
        score -= 50;
      }
    });

    // Research finding: English voices tend to be highest quality
    if (voice.lang.startsWith('en')) {
      score += 20;
    }

    // Research finding: Prefer US English as most optimized
    if (voice.lang === 'en-US') {
      score += 10;
    }

    // Research finding: Microsoft Edge has the best voices
    if (voice.name.includes('Microsoft') || voice.name.includes('Edge')) {
      score += 25;
    }

    // Research finding: Google voices are also high quality
    if (voice.name.includes('Google')) {
      score += 20;
    }

    return score;
  }

  enable() {
    this.isEnabled = true;
    console.log('🔊 SUPERCHARGED TTS: Queue manager enabled with voice:', this.bestVoice?.name);
    return true;
  }

  disable() {
    this.isEnabled = false;
    if (this.isSupported) {
      window.speechSynthesis.cancel();
    }
    this.queue = [];
    this.isProcessing = false;
    console.log('🔇 SUPERCHARGED TTS: Queue manager disabled');
  }

  addMessage(text, options = {}) {
    if (!this.isSupported) {
      console.log('🔇 SUPERCHARGED TTS: Speech synthesis not supported');
      return;
    }

    if (!this.isEnabled) {
      console.log('🔇 SUPERCHARGED TTS: Queue manager not enabled');
      return;
    }

    // Clean up text for better speech
    const cleanText = this.optimizeTextForSpeech(text);
    
    if (cleanText.length === 0) {
      console.log('🔇 SUPERCHARGED TTS: No speakable text after optimization');
      return;
    }

    console.log(`🔊 SUPERCHARGED TTS: Adding to queue: "${cleanText.substring(0, 50)}..."`);
    this.queue.push({ text: cleanText, options });
    this.processQueue();
  }

  optimizeTextForSpeech(text) {
    // Research-based text optimization for natural speech
    
    // Remove code blocks and technical markup
    text = text.replace(/```[\s\S]*?```/g, '');
    text = text.replace(/`[^`]+`/g, '');
    
    // Remove file paths and technical references
    text = text.replace(/[\/\\][\w\/\\.-]+\.(js|ts|json|md|txt|py|jsx|tsx|css|html)/gi, '');
    text = text.replace(/https?:\/\/[^\s]+/g, '');
    
    // Convert markdown to speech-friendly format
    text = text.replace(/#{1,6}\s+/g, ''); // Remove headers
    text = text.replace(/\*\*(.*?)\*\*/g, '$1'); // Bold to normal
    text = text.replace(/\*(.*?)\*/g, '$1'); // Italic to normal
    text = text.replace(/\[([^\]]+)\]\([^)]+\)/g, '$1'); // Links to text only
    
    // Fix common speech issues
    text = text.replace(/\s+/g, ' '); // Multiple spaces to single
    text = text.replace(/([.!?])\s*([A-Z])/g, '$1 $2'); // Add space after sentences
    text = text.trim();
    
    // Research finding: Add subtle pauses for better natural flow
    text = text.replace(/([.!?])/g, '$1 '); // Ensure pause after sentences
    text = text.replace(/,/g, ', '); // Ensure pause after commas
    
    return text;
  }

  async processQueue() {
    if (this.isProcessing || this.queue.length === 0) {
      return;
    }

    this.isProcessing = true;

    while (this.queue.length > 0) {
      const { text, options } = this.queue.shift();
      
      try {
        await this.speakText(text, options);
      } catch (error) {
        console.error('❌ SUPERCHARGED TTS: Error speaking text:', error);
      }
    }

    this.isProcessing = false;
  }

  speakText(text, options = {}) {
    return new Promise((resolve, reject) => {
      if (!this.isSupported) {
        reject(new Error('Speech synthesis not supported'));
        return;
      }

      const utterance = new SpeechSynthesisUtterance(text);
      
      // Apply research-based optimal settings
      this.applyOptimalSettings(utterance, options);

      utterance.onend = () => {
        console.log('🔊 SUPERCHARGED TTS: Speech completed');
        resolve();
      };

      utterance.onerror = (event) => {
        console.error('❌ SUPERCHARGED TTS: Speech error:', event.error);
        reject(new Error(`Speech error: ${event.error}`));
      };

      console.log(`🔊 SUPERCHARGED TTS: Speaking with ${this.bestVoice?.name}: "${text.substring(0, 50)}..."`);
      window.speechSynthesis.speak(utterance);
    });
  }

  applyOptimalSettings(utterance, options = {}) {
    // Use the best voice we selected
    if (this.bestVoice) {
      utterance.voice = this.bestVoice;
    }

    // Research-based optimal parameters for natural speech
    
    // Rate: Slightly slower than default for better comprehension
    utterance.rate = options.rate || 0.85;
    
    // Pitch: Slightly higher than default for more pleasant sound
    utterance.pitch = options.pitch || 1.1;
    
    // Volume: Slightly lower to prevent distortion
    utterance.volume = options.volume || 0.8;

    // Voice-specific optimizations based on research
    if (this.bestVoice) {
      const voiceName = this.bestVoice.name.toLowerCase();
      
      // Microsoft/Edge voices: work best with these settings
      if (voiceName.includes('microsoft') || voiceName.includes('edge')) {
        utterance.rate = 0.9;
        utterance.pitch = 1.0;
      }
      
      // Google voices: slightly different optimal settings
      if (voiceName.includes('google')) {
        utterance.rate = 0.8;
        utterance.pitch = 0.9;
      }
      
      // Natural/Neural voices: use default settings as they're pre-optimized
      if (voiceName.includes('natural') || voiceName.includes('neural')) {
        utterance.rate = 1.0;
        utterance.pitch = 1.0;
      }
    }
  }

  getStatus() {
    return {
      isSupported: this.isSupported,
      isEnabled: this.isEnabled,
      queueLength: this.queue.length,
      isProcessing: this.isProcessing,
      bestVoice: this.bestVoice ? {
        name: this.bestVoice.name,
        lang: this.bestVoice.lang,
        localService: this.bestVoice.localService
      } : null,
      availableVoices: speechSynthesis.getVoices().length
    };
  }

  // Debug method to test different voices
  async testVoice(voiceName, text = "Hello! This is a test of voice quality.") {
    const voices = speechSynthesis.getVoices();
    const voice = voices.find(v => v.name.includes(voiceName));
    
    if (!voice) {
      console.error('Voice not found:', voiceName);
      return;
    }

    const utterance = new SpeechSynthesisUtterance(text);
    utterance.voice = voice;
    utterance.rate = 0.85;
    utterance.pitch = 1.1;
    utterance.volume = 0.8;

    console.log(`🎤 Testing voice: ${voice.name}`);
    window.speechSynthesis.speak(utterance);
  }
}

export default SuperchargedTTSManager;