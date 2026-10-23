import { API_BASE_URL } from '../config';
import { apiFetch } from '../lib/api';

export interface SpeechToTextService {
  transcribe(audio: Blob): Promise<string>;
}

export class RealSpeechService implements SpeechToTextService {
  async transcribe(audio: Blob): Promise<string> {
    const formData = new FormData();
    formData.append('audio', audio, 'recording.webm');
    
    const response = await apiFetch(`${API_BASE_URL}/api/transcribe`, {
      method: 'POST',
      body: formData,
    });
    
    if (!response.ok) {
      const errPayload = await response.json().catch(() => ({}));
      if (errPayload.error === 'TRANSCRIPTION_INPUT_INVALID') {
        const error = new Error(errPayload.message || 'No valid audio input was provided.');
        (error as any).code = 'TRANSCRIPTION_INPUT_INVALID';
        throw error;
      }
      throw new Error(errPayload.error || 'AI transcription service unavailable. Please retry or continue manually.');
    }
    
    const data = await response.json();
    return data.transcript;
  }
}
