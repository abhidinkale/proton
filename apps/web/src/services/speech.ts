import { API_BASE_URL } from '../config';

export interface SpeechToTextService {
  transcribe(audio: Blob): Promise<string>;
}

export class RealSpeechService implements SpeechToTextService {
  async transcribe(audio: Blob): Promise<string> {
    const formData = new FormData();
    formData.append('audio', audio, 'recording.webm');
    
    const response = await fetch(`${API_BASE_URL}/api/transcribe`, {
      method: 'POST',
      body: formData,
    });
    
    if (!response.ok) {
      throw new Error('Transcription service is currently unavailable. Please verify connectivity or try again.');
    }
    
    const data = await response.json();
    return data.transcript;
  }
}
