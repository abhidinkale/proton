import { MedplumClient } from '@medplum/core';
import { MEDPLUM_BASE_URL, MEDPLUM_CLIENT_ID } from '../config';

const baseMedplum = new MedplumClient({
  baseUrl: MEDPLUM_BASE_URL,
  clientId: MEDPLUM_CLIENT_ID,
});

/**
 * Resilient Medplum Client with Native Electron & Offline Store Interception.
 * When running inside Proton Desktop without an active remote Medplum cloud connection,
 * transparently delegates to the Electron Native Local FHIR Store.
 */
class ResilientMedplumProxy {
  private client: MedplumClient;

  constructor(client: MedplumClient) {
    this.client = client;
  }

  getAccessToken(): string | undefined {
    return this.client.getAccessToken();
  }

  setAccessToken(token: string): void {
    this.client.setAccessToken(token);
  }

  async readResource<T = any>(resourceType: string, id: string): Promise<T> {
    if (typeof window !== 'undefined' && window.protonNative?.readFhirResource) {
      try {
        const local = await window.protonNative.readFhirResource(resourceType, id);
        if (local && !local.error) return local as T;
      } catch {
        // Fallback to client
      }
    }

    try {
      const res = await this.client.readResource(resourceType as any, id);
      return res as unknown as T;
    } catch (err) {
      if (typeof window !== 'undefined' && window.protonNative?.readFhirResource) {
        const local = await window.protonNative.readFhirResource(resourceType, id);
        if (local && !local.error) return local as T;
      }
      throw err;
    }
  }

  async searchResources<T = any>(resourceType: string, searchParams?: any): Promise<T[]> {
    if (typeof window !== 'undefined' && window.protonNative?.searchFhirResources) {
      try {
        const localResults = await window.protonNative.searchFhirResources(resourceType, searchParams);
        if (Array.isArray(localResults) && localResults.length > 0) {
          return localResults as T[];
        }
      } catch {
        // Fallback to client
      }
    }

    try {
      const res = await this.client.searchResources(resourceType as any, searchParams);
      return res as unknown as T[];
    } catch (err) {
      if (typeof window !== 'undefined' && window.protonNative?.searchFhirResources) {
        const localResults = await window.protonNative.searchFhirResources(resourceType, searchParams);
        if (Array.isArray(localResults)) {
          return localResults as T[];
        }
      }
      return [];
    }
  }

  async executeBatch<T = any>(bundle: any): Promise<T> {
    if (typeof window !== 'undefined' && window.protonNative?.executeFhirBatch) {
      try {
        const localBatchResult = await window.protonNative.executeFhirBatch(bundle);
        if (localBatchResult && !localBatchResult.error) {
          return localBatchResult as T;
        }
      } catch {
        // Fallback to remote
      }
    }

    try {
      const res = await this.client.executeBatch(bundle);
      return res as unknown as T;
    } catch (err) {
      if (typeof window !== 'undefined' && window.protonNative?.executeFhirBatch) {
        const localBatchResult = await window.protonNative.executeFhirBatch(bundle);
        if (localBatchResult && !localBatchResult.error) {
          return localBatchResult as T;
        }
      }
      throw err;
    }
  }
}

// Export the proxy wrapped client conforming to MedplumClient interface
export const medplum: MedplumClient = new Proxy(baseMedplum, {
  get(target, prop, receiver) {
    const helper = new ResilientMedplumProxy(target);
    const customMethod = (helper as any)[prop];
    if (typeof customMethod === 'function') {
      return customMethod.bind(helper);
    }
    const val = Reflect.get(target, prop, receiver);
    if (typeof val === 'function') {
      return val.bind(target);
    }
    return val;
  }
});
