/**
 * Kokoro TTS Proof of Concept - Standalone implementation for testing
 * This runs alongside the existing TTS system without replacing anything
 */

let KokoroTTS;

class KokoroTTSProof {
  constructor() {
    this.model = null;
    this.isInitializing = false;
    this.isInitialized = false;
    this.currentVoice = 'af_bella'; // Default to a nice female voice
    this.availableVoices = [
      'af_bella',
      'af_sarah', 
      'am_adam',
      'am_michael'
    ];
  }

  async initialize() {
    if (this.isInitializing || this.isInitialized) {
      return this.isInitialized;
    }

    this.isInitializing = true;
    console.log('🤖 KOKORO POC: Starting model initialization...');

    try {
      // Dynamic import to avoid issues with SSR
      if (!KokoroTTS) {
        console.log('🤖 KOKORO POC: Importing kokoro-js...');
        const module = await import('kokoro-js');
        KokoroTTS = module.KokoroTTS;
        console.log('🤖 KOKORO POC: Import successful');
      }

      console.log('🤖 KOKORO POC: Loading model (this may take 30-60 seconds on first use)...');
      
      this.model = await KokoroTTS.from_pretrained("onnx-community/Kokoro-82M-ONNX", {
        dtype: "q8",     // Compressed model for faster loading
        device: "wasm",  // WebAssembly for broad browser compatibility
        progress_callback: (progress) => {
          console.log(`🤖 KOKORO POC: Loading progress: ${Math.round(progress.loaded / progress.total * 100)}%`);
        }
      });

      this.isInitialized = true;
      console.log('✅ KOKORO POC: Model loaded successfully!');
      console.log('🤖 KOKORO POC: Available voices:', this.availableVoices);
      
      return true;
    } catch (error) {
      console.error('❌ KOKORO POC: Failed to initialize:', error);
      this.isInitialized = false;
      throw error;
    } finally {
      this.isInitializing = false;
    }
  }

  async generateSpeech(text, voice = null) {
    if (!this.isInitialized) {
      console.log('🤖 KOKORO POC: Model not initialized, initializing now...');
      await this.initialize();
    }

    if (!this.model) {
      throw new Error('Kokoro model not available');
    }

    const selectedVoice = voice || this.currentVoice;
    console.log(`🤖 KOKORO POC: Generating speech with voice "${selectedVoice}": "${text.substring(0, 50)}..."`);

    try {
      const audio = await this.model.generate(text, {
        voice: selectedVoice
      });

      console.log(`✅ KOKORO POC: Speech generated successfully (${selectedVoice})`);
      return audio;
    } catch (error) {
      console.error('❌ KOKORO POC: Speech generation failed:', error);
      throw error;
    }
  }

  async playAudio(audioData) {
    return new Promise((resolve, reject) => {
      try {
        console.log('🔊 KOKORO POC: Processing audio data type:', typeof audioData);
        console.log('🔊 KOKORO POC: Audio data constructor:', audioData.constructor.name);
        console.log('🔊 KOKORO POC: Available methods:', Object.getOwnPropertyNames(Object.getPrototypeOf(audioData)));
        console.log('🔊 KOKORO POC: Direct properties:', Object.getOwnPropertyNames(audioData));
        
        let audioBlob;
        
        // Handle different audio formats from Kokoro
        if (audioData instanceof Blob) {
          audioBlob = audioData;
        } else if (audioData && audioData.toBlob && typeof audioData.toBlob === 'function') {
          // Kokoro RawAudio has .toBlob() method
          audioBlob = audioData.toBlob();
        } else if (audioData && audioData.blob && typeof audioData.blob === 'function') {
          // Alternative: .blob() method
          audioBlob = audioData.blob();
        } else if (audioData && audioData.save && typeof audioData.save === 'function') {
          // Kokoro might use .save() to get blob
          audioBlob = audioData.save();
        } else if (audioData && audioData.data) {
          // Handle if it's a RawAudio-like object with raw data
          audioBlob = new Blob([audioData.data], { type: 'audio/wav' });
        } else {
          // Try to convert directly
          audioBlob = new Blob([audioData], { type: 'audio/wav' });
        }
        
        console.log('🔊 KOKORO POC: Created blob:', audioBlob.size, 'bytes');
        
        const audioUrl = URL.createObjectURL(audioBlob);
        const audioElement = new Audio(audioUrl);
        
        audioElement.onended = () => {
          URL.revokeObjectURL(audioUrl); // Clean up memory
          console.log('✅ KOKORO POC: Audio playback completed');
          resolve();
        };
        
        audioElement.onerror = (error) => {
          URL.revokeObjectURL(audioUrl);
          console.error('❌ KOKORO POC: Audio playback error:', error);
          reject(error);
        };

        console.log('🔊 KOKORO POC: Starting audio playback...');
        audioElement.play().catch(reject);
      } catch (error) {
        console.error('❌ KOKORO POC: Failed to create audio element:', error);
        reject(error);
      }
    });
  }

  async speak(text, voice = null) {
    try {
      const audioBlob = await this.generateSpeech(text, voice);
      await this.playAudio(audioBlob);
      return true;
    } catch (error) {
      console.error('❌ KOKORO POC: Failed to speak text:', error);
      throw error;
    }
  }

  setVoice(voice) {
    if (this.availableVoices.includes(voice)) {
      this.currentVoice = voice;
      console.log(`🤖 KOKORO POC: Voice changed to: ${voice}`);
      return true;
    } else {
      console.warn(`❌ KOKORO POC: Unknown voice: ${voice}. Available voices:`, this.availableVoices);
      return false;
    }
  }

  getStatus() {
    return {
      isInitialized: this.isInitialized,
      isInitializing: this.isInitializing,
      currentVoice: this.currentVoice,
      availableVoices: this.availableVoices,
      modelLoaded: !!this.model
    };
  }

  // Utility method for testing different voices quickly
  async testAllVoices(text = "Hello! This is a test of the Kokoro AI voice.") {
    console.log('🤖 KOKORO POC: Testing all available voices...');
    
    for (const voice of this.availableVoices) {
      try {
        console.log(`🔊 Testing voice: ${voice}`);
        await this.speak(text, voice);
        // Small delay between voices
        await new Promise(resolve => setTimeout(resolve, 1000));
      } catch (error) {
        console.error(`❌ Failed to test voice ${voice}:`, error);
      }
    }
    
    console.log('✅ KOKORO POC: Voice testing completed');
  }
}

export default KokoroTTSProof;