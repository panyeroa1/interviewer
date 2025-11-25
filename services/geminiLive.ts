import { GoogleGenAI, LiveServerMessage, Modality } from '@google/genai';
import { getSystemInstruction, LIVE_API_MODEL } from '../constants';
import { createPcmBlob, decodeAudioData, base64ToUint8Array } from './audioUtils';
import { ApplicantData } from '../types';

export class GeminiLiveClient {
  private inputAudioContext: AudioContext | null = null;
  private outputAudioContext: AudioContext | null = null;
  private videoInterval: number | null = null;
  private session: any = null; // Session type isn't fully exported yet in some versions, using any for safety
  private nextStartTime = 0;
  private sources = new Set<AudioBufferSourceNode>();
  private onVolumeChange: (vol: number) => void;
  private onDisconnect: () => void;

  constructor(onVolumeChange: (vol: number) => void, onDisconnect: () => void) {
    this.onVolumeChange = onVolumeChange;
    this.onDisconnect = onDisconnect;
  }

  async connect(videoElement: HTMLVideoElement, applicantData: ApplicantData) {
    // Initialize GoogleGenAI here to ensure we use the latest API_KEY
    const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

    this.inputAudioContext = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 16000 });
    this.outputAudioContext = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 24000 });

    try {
      // 1. Setup Audio Input (Mic)
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const source = this.inputAudioContext.createMediaStreamSource(stream);
      
      // Using ScriptProcessor as per guidance (AudioWorklet is better but requires external file)
      const scriptProcessor = this.inputAudioContext.createScriptProcessor(4096, 1, 1);
      
      scriptProcessor.onaudioprocess = (e) => {
        const inputData = e.inputBuffer.getChannelData(0);
        
        // Calculate volume for UI visualization
        let sum = 0;
        for (let i = 0; i < inputData.length; i++) {
          sum += inputData[i] * inputData[i];
        }
        const rms = Math.sqrt(sum / inputData.length);
        this.onVolumeChange(rms * 5); // Boost factor for visibility

        if (this.session) {
          const pcmBlob = createPcmBlob(inputData, 16000);
          this.session.sendRealtimeInput({ media: pcmBlob });
        }
      };

      source.connect(scriptProcessor);
      scriptProcessor.connect(this.inputAudioContext.destination);

      // 2. Connect to Gemini Live
      const sessionPromise = ai.live.connect({
        model: LIVE_API_MODEL,
        config: {
          responseModalities: [Modality.AUDIO],
          speechConfig: {
            voiceConfig: { prebuiltVoiceConfig: { voiceName: 'Aoede' } }, // Requested voice
          },
          systemInstruction: getSystemInstruction(applicantData),
        },
        callbacks: {
          onopen: () => {
            console.log('Gemini Live Connection Opened');
          },
          onmessage: async (message: LiveServerMessage) => {
            this.handleServerMessage(message);
          },
          onclose: (e) => {
            console.log('Gemini Live Connection Closed', e);
            this.disconnect();
          },
          onerror: (e) => {
            console.error('Gemini Live Error', e);
            this.disconnect();
          },
        },
      });

      this.session = await sessionPromise;

      // 3. Setup Video Streaming (if videoElement provided)
      if (videoElement) {
          this.startVideoStream(videoElement);
      }
    } catch (error) {
      // Clean up if connection fails immediately
      this.disconnect();
      throw error;
    }
  }

  sendText(text: string) {
    if (!this.session) return;
    
    // Stop local audio immediately to simulate interruption
    this.stopAudioPlayback();

    // Send the text as a user turn
    this.session.send({
      clientContent: {
        turns: [{
          role: 'user',
          parts: [{ text }]
        }],
        turnComplete: true
      }
    });
  }

  private startVideoStream(videoElement: HTMLVideoElement) {
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    const FRAME_RATE = 1; // 1 FPS is usually sufficient for context without burning tokens/bandwidth

    this.videoInterval = window.setInterval(() => {
        if (!this.session || !ctx) return;
        
        // Ensure video is playing and has dimension
        if(videoElement.readyState === videoElement.HAVE_ENOUGH_DATA) {
            canvas.width = videoElement.videoWidth * 0.5; // Scale down for performance
            canvas.height = videoElement.videoHeight * 0.5;
            ctx.drawImage(videoElement, 0, 0, canvas.width, canvas.height);
            
            const base64Data = canvas.toDataURL('image/jpeg', 0.6).split(',')[1];
            
            this.session.sendRealtimeInput({
                media: {
                    mimeType: 'image/jpeg',
                    data: base64Data
                }
            });
        }
    }, 1000 / FRAME_RATE);
  }

  private async handleServerMessage(message: LiveServerMessage) {
    const { serverContent } = message;
    
    if (serverContent?.modelTurn?.parts?.[0]?.inlineData) {
        const audioData = serverContent.modelTurn.parts[0].inlineData.data;
        if (audioData && this.outputAudioContext) {
            this.playAudioChunk(audioData);
        }
    }

    if (serverContent?.interrupted) {
        this.stopAudioPlayback();
    }

    if (serverContent?.turnComplete) {
        // Handle turn complete logic if needed
    }
  }

  private async playAudioChunk(base64Audio: string) {
    if (!this.outputAudioContext) return;

    try {
        const audioBytes = base64ToUint8Array(base64Audio);
        const audioBuffer = await decodeAudioData(audioBytes, this.outputAudioContext);
        
        const source = this.outputAudioContext.createBufferSource();
        source.buffer = audioBuffer;
        
        const outputNode = this.outputAudioContext.createGain();
        source.connect(outputNode);
        outputNode.connect(this.outputAudioContext.destination);

        // Schedule playback
        this.nextStartTime = Math.max(this.nextStartTime, this.outputAudioContext.currentTime);
        source.start(this.nextStartTime);
        this.nextStartTime += audioBuffer.duration;

        this.sources.add(source);
        source.onended = () => {
            this.sources.delete(source);
        };
    } catch (err) {
        console.error("Error decoding audio chunk", err);
    }
  }

  private stopAudioPlayback() {
    this.sources.forEach(source => {
        try {
            source.stop();
        } catch (e) {
            // ignore if already stopped
        }
    });
    this.sources.clear();
    // Reset timer
    if(this.outputAudioContext) {
        this.nextStartTime = this.outputAudioContext.currentTime;
    }
  }

  disconnect() {
    this.onDisconnect();
    
    // Stop video loop
    if (this.videoInterval) {
        clearInterval(this.videoInterval);
        this.videoInterval = null;
    }

    // Close Audio Contexts
    this.inputAudioContext?.close();
    this.outputAudioContext?.close();
    this.inputAudioContext = null;
    this.outputAudioContext = null;
    this.session = null;
  }
}