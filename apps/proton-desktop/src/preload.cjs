/**
 * Electron Preload Script for Proton Clinical Console
 * Exposes a minimal, secure bridge to the renderer.
 * Invariant: Medplum credentials and tokens are NEVER exposed here.
 */

const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('protonNative', {
  isElectron: true,
  platform: process.platform,

  // Audio Recording
  getAudioDevices: async () => {
    return await navigator.mediaDevices.enumerateDevices();
  },
  sendConsultationAudioChunk: (chunk) => {
    ipcRenderer.send('audio:chunk', chunk);
  },
  onAudioStreamStatus: (callback) => {
    ipcRenderer.on('audio:status', (_event, value) => callback(value));
  },
  saveConsultationAudio: async (encounterId, bufferBase64) => {
    return await ipcRenderer.invoke('audio:saveConsultation', { encounterId, bufferBase64 });
  },
  getConsultationAudio: async (encounterId) => {
    return await ipcRenderer.invoke('audio:getConsultation', { encounterId });
  },

  // Offline FHIR Store
  storeFhirResource: async (resource) => {
    return await ipcRenderer.invoke('fhir:storeResource', resource);
  },
  readFhirResource: async (resourceType, id) => {
    return await ipcRenderer.invoke('fhir:readResource', { resourceType, id });
  },
  searchFhirResources: async (resourceType, params = {}) => {
    return await ipcRenderer.invoke('fhir:searchResources', { resourceType, params });
  },
  executeFhirBatch: async (bundle) => {
    return await ipcRenderer.invoke('fhir:executeBatch', bundle);
  },

  // C-CDA XML Medical Document Ingestion
  parseCcdaXml: async (xmlContent) => {
    return await ipcRenderer.invoke('ccda:parseXml', xmlContent);
  },

  // In-Clinic Hardware Readiness
  getHardwareStatus: async () => {
    return await ipcRenderer.invoke('hardware:getStatus');
  }
});
