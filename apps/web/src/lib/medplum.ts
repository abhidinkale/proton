import { MedplumClient } from '@medplum/core';
import { MEDPLUM_BASE_URL, MEDPLUM_CLIENT_ID } from '../config';

export const medplum = new MedplumClient({
  baseUrl: MEDPLUM_BASE_URL,
  clientId: MEDPLUM_CLIENT_ID,
});
