export interface StreamState {
  isConnected: boolean;
  isStreaming: boolean;
  error: string | null;
  volume: number; // 0-1 for visualization
}

export type LiveConfig = {
  model: string;
  systemInstruction: string;
  voiceName: string;
};

export interface ApplicantData {
  name: string;
  email: string;
  role: string;
  experience: string;
}