export interface ProtonNativeBridge {
  isElectron: boolean;
  platform: string;

  getAudioDevices: () => Promise<MediaDeviceInfo[]>;
  sendConsultationAudioChunk: (chunk: ArrayBuffer | Uint8Array) => void;
  onAudioStreamStatus: (callback: (status: { receivedBytes: number; timestamp: number }) => void) => void;
  saveConsultationAudio: (encounterId: string, bufferBase64: string) => Promise<{ success: boolean; audioPath: string; bytes: number; binaryUri: string }>;
  getConsultationAudio: (encounterId: string) => Promise<{ exists: boolean; audioPath?: string; binaryUri?: string }>;

  storeFhirResource: (resource: any) => Promise<any>;
  readFhirResource: (resourceType: string, id: string) => Promise<any>;
  searchFhirResources: (resourceType: string, params?: Record<string, any>) => Promise<any[]>;
  executeFhirBatch: (bundle: any) => Promise<any>;

  parseCcdaXml: (xmlContent: string) => Promise<{
    success: boolean;
    patientName?: string;
    patientGender?: string;
    patientBirthDate?: string;
    counts?: { conditions: number; medications: number; allergies: number };
    bundle?: any;
    error?: string;
  }>;

  getHardwareStatus: () => Promise<{
    dicomPort: number;
    hl7Port: number;
    dicomReady: boolean;
    hl7Ready: boolean;
    mode: string;
    status: string;
    connectedDevices: Array<{ type: string; protocol: string; status: string }>;
  }>;
}

declare global {
  interface Window {
    protonNative?: ProtonNativeBridge;
  }
}
