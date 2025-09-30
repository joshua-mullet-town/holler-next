/**
 * TTS Queue Manager - Handles sequential text-to-speech using Web Speech API
 */

class TTSQueueManager {
  constructor() {
    this.queue = [];
    this.isProcessing = false;
    this.isEnabled = false;
    this.isSupported = 'speechSynthesis' in window;
    
    if (!this.isSupported) {
      console.warn('🔇 TTS: Speech synthesis not supported in this browser');
    }
  }

  enable() {
    this.isEnabled = true;
    console.log('🔊 TTS: Queue manager enabled');
    return true;
  }

  disable() {
    this.isEnabled = false;
    if (this.isSupported) {
      window.speechSynthesis.cancel();
    }
    this.queue = [];
    this.isProcessing = false;
    console.log('🔇 TTS: Queue manager disabled');
  }

  addMessage(text, options = {}) {
    if (!this.isSupported) {
      console.log('🔇 TTS: Speech synthesis not supported');
      return;
    }

    if (!this.isEnabled) {
      console.log('🔇 TTS: Queue manager not enabled');
      return;
    }

    // Clean up text - remove code blocks, tool usage, file paths
    const cleanText = this.cleanTextForSpeech(text);
    
    if (cleanText.length === 0) {
      console.log('🔇 TTS: No speakable text after cleaning');
      return;
    }

    console.log(`🔊 TTS: Adding to queue: "${cleanText.substring(0, 50)}..."`);
    this.queue.push({ text: cleanText, options });
    this.processQueue();
  }

  cleanTextForSpeech(text) {
    // Remove code blocks
    text = text.replace(/```[\s\S]*?```/g, '');
    
    // Remove inline code
    text = text.replace(/`[^`]+`/g, '');
    
    // Remove file paths
    text = text.replace(/[\/\\][\w\/\\.-]+\.(js|ts|json|md|txt|py|jsx|tsx)/gi, '');
    
    // Remove markdown formatting
    text = text.replace(/[#*_`]/g, '');
    
    // Remove excessive whitespace
    text = text.replace(/\s+/g, ' ').trim();
    
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
        await this.speakText(text);
      } catch (error) {
        console.error('❌ TTS: Error speaking text:', error);
      }
    }

    this.isProcessing = false;
  }

  speakText(text) {
    return new Promise((resolve, reject) => {
      if (!this.isSupported) {
        reject(new Error('Speech synthesis not supported'));
        return;
      }

      const utterance = new SpeechSynthesisUtterance(text);
      utterance.rate = 1.0;
      utterance.volume = 1.0;
      utterance.pitch = 1.0;

      utterance.onend = () => {
        console.log('🔊 TTS: Speech completed');
        resolve();
      };

      utterance.onerror = (event) => {
        console.error('❌ TTS: Speech error:', event.error);
        reject(new Error(`Speech error: ${event.error}`));
      };

      console.log(`🔊 TTS: Speaking: "${text.substring(0, 50)}..."`);
      window.speechSynthesis.speak(utterance);
    });
  }

  getStatus() {
    return {
      isSupported: this.isSupported,
      isEnabled: this.isEnabled,
      queueLength: this.queue.length,
      isProcessing: this.isProcessing
    };
  }
}

export default TTSQueueManager;