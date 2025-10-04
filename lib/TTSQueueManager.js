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
    console.log(`🎯 TTS DEBUG: ========== ADDMESSAGE CALLED ==========`);
    console.log(`🎯 TTS DEBUG: Input text: "${text.substring(0, 150)}..." (${text.length} chars)`);
    console.log(`🎯 TTS DEBUG: Options:`, options);
    console.log(`🎯 TTS DEBUG: TTS state:`, {
      isSupported: this.isSupported,
      isEnabled: this.isEnabled,
      queueLength: this.queue.length,
      isProcessing: this.isProcessing
    });

    if (!this.isSupported) {
      console.log('❌ TTS DEBUG: Speech synthesis not supported');
      return;
    }

    if (!this.isEnabled) {
      console.log('❌ TTS DEBUG: Queue manager not enabled');
      return;
    }

    // Clean up text - remove code blocks, tool usage, file paths
    console.log(`🧹 TTS DEBUG: Cleaning text for speech...`);
    const cleanText = this.cleanTextForSpeech(text);
    console.log(`🧹 TTS DEBUG: Cleaned text: "${cleanText.substring(0, 150)}..." (${cleanText.length} chars)`);
    
    if (cleanText.length === 0) {
      console.log('❌ TTS DEBUG: No speakable text after cleaning');
      return;
    }

    console.log(`✅ TTS DEBUG: Adding to queue: "${cleanText.substring(0, 50)}..."`);
    this.queue.push({ text: cleanText, options });
    console.log(`📋 TTS DEBUG: Queue now has ${this.queue.length} items`);
    console.log(`🚀 TTS DEBUG: Starting queue processing...`);
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
    console.log(`🔄 TTS DEBUG: ========== PROCESSQUEUE CALLED ==========`);
    console.log(`🔄 TTS DEBUG: Processing state: ${this.isProcessing}, Queue length: ${this.queue.length}`);
    
    if (this.isProcessing || this.queue.length === 0) {
      console.log(`🔄 TTS DEBUG: Exiting early - Processing: ${this.isProcessing}, Queue empty: ${this.queue.length === 0}`);
      return;
    }

    this.isProcessing = true;
    console.log(`🔄 TTS DEBUG: Starting queue processing with ${this.queue.length} items`);

    while (this.queue.length > 0) {
      const { text, options } = this.queue.shift();
      console.log(`🔊 TTS DEBUG: Processing queue item: "${text.substring(0, 100)}..." (${text.length} chars)`);
      
      try {
        console.log(`🚀 TTS DEBUG: Calling speakText...`);
        await this.speakText(text);
        console.log(`✅ TTS DEBUG: speakText completed successfully`);
      } catch (error) {
        console.error('❌ TTS DEBUG: Error speaking text:', error);
      }
    }

    this.isProcessing = false;
    console.log(`🔄 TTS DEBUG: Queue processing complete, setting isProcessing to false`);
  }

  speakText(text) {
    return new Promise((resolve, reject) => {
      console.log(`🎤 TTS DEBUG: ========== SPEAKTEXT CALLED ==========`);
      console.log(`🎤 TTS DEBUG: Text to speak: "${text.substring(0, 200)}..." (${text.length} chars)`);
      console.log(`🎤 TTS DEBUG: speechSynthesis available: ${!!window.speechSynthesis}`);
      console.log(`🎤 TTS DEBUG: speechSynthesis speaking: ${window.speechSynthesis?.speaking}`);
      
      if (!this.isSupported) {
        console.log(`❌ TTS DEBUG: Speech synthesis not supported`);
        reject(new Error('Speech synthesis not supported'));
        return;
      }

      console.log(`🎤 TTS DEBUG: Creating SpeechSynthesisUtterance...`);
      const utterance = new SpeechSynthesisUtterance(text);
      utterance.rate = 1.0;
      utterance.volume = 1.0;
      utterance.pitch = 1.0;

      console.log(`🎤 TTS DEBUG: Setting up utterance event handlers...`);
      utterance.onstart = () => {
        console.log('🎤 TTS DEBUG: ✅ Speech started!');
      };

      utterance.onend = () => {
        console.log('🎤 TTS DEBUG: ✅ Speech completed!');
        resolve();
      };

      utterance.onerror = (event) => {
        console.error('❌ TTS DEBUG: Speech error:', event.error);
        reject(new Error(`Speech error: ${event.error}`));
      };

      utterance.onpause = () => {
        console.log('🎤 TTS DEBUG: Speech paused');
      };

      utterance.onresume = () => {
        console.log('🎤 TTS DEBUG: Speech resumed');
      };

      console.log(`🚀 TTS DEBUG: Calling window.speechSynthesis.speak()...`);
      try {
        window.speechSynthesis.speak(utterance);
        console.log(`🚀 TTS DEBUG: speechSynthesis.speak() called successfully`);
      } catch (error) {
        console.error(`❌ TTS DEBUG: Error calling speak():`, error);
        reject(error);
      }
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