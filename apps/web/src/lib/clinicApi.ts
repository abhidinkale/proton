/**
 * Proton Clinic API client.
 *
 * Typed access to the durable clinic workspace: patients, schedule, encounter
 * notes, the attention queue, preferences and the hash-chained audit trail.
 * Everything here is persisted server-side in SQLite, so a reload or a second
 * browser tab sees the same clinical state.
 */

import { apiJson, ApiError } from './api';

export type QueueCategory =
  | 'WAITING'
  | 'IN_CONSULTATION'
  | 'READY_FOR_REVIEW'
  | 'COMPLETED'
  | 'CANCELLED';

export type AppointmentStatusCode =
  | 'SCHEDULED'
  | 'READY'
  | 'IN_ROOM'
  | 'COMPLETED'
  | 'CANCELLED'
  | 'NO_SHOW';

export type Priority = 'low' | 'normal' | 'urgent' | 'critical';
export type NotificationSeverity = 'critical' | 'warning' | 'info';

export interface ClinicPatientSummary {
  id: string;
  mrn: string;
  name: string;
  age: number;
  gender: string;
  dob: string | null;
  phone: string | null;
  chiefComplaint: string;
  visitType: string;
  time: string;
  status: QueueCategory;
  appointmentId: string | null;
  room: string | null;
  priority: Priority;
  criticalAllergies: string[];
  primaryCondition: string | null;
  conditions: string[];
  medications: string[];
  vitalsSummary: string | null;
  needsAttention: boolean;
  attentionReason: string | null;
  draftNotes: number;
  riskScore: 'low' | 'moderate' | 'critical';
}

export interface ClinicAppointment {
  id: string;
  patientId: string;
  patientName: string;
  patientAge?: number;
  patientGender?: string;
  mrn?: string;
  date: string;
  time: string;
  startMinutes: number;
  durationMinutes: number;
  appointmentType: string;
  status: AppointmentStatusCode;
  queueCategory: QueueCategory;
  roomOrVirtual: string;
  priority: Priority;
  chiefComplaint?: string;
  criticalAllergies?: string[];
  assignedDoctorName?: string;
  waitTimeMinutes?: number;
  notes?: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface ClinicNoteContent {
  subjective: string;
  objective: string;
  assessment: string;
  plan: string;
}

export interface ClinicNote {
  id: string;
  patientId: string;
  patientName: string;
  appointmentId: string | null;
  status: 'DRAFT' | 'SIGNED' | 'AMENDED';
  template: string;
  title: string;
  note: ClinicNoteContent;
  diagnoses: string[];
  prescriptions: unknown[];
  provenance: string;
  author: string;
  createdAt: string;
  updatedAt: string;
  signedAt: string | null;
  signature: {
    actorId: string;
    actorName: string;
    npi?: string;
    role?: string;
    attestation: string;
    method: string;
  } | null;
}

export interface ClinicNotification {
  id: string;
  patientId: string | null;
  type: string;
  severity: NotificationSeverity;
  title: string;
  body: string;
  actionPath: string | null;
  sourceId: string | null;
  createdAt: string;
  readAt: string | null;
  resolvedAt: string | null;
}

export interface ClinicAuditEvent {
  id: string;
  action: string;
  resourceType: string;
  resourceId: string | null;
  patientId: string | null;
  actorId: string | null;
  actorName: string | null;
  summary: string;
  at: string;
  prevHash: string | null;
  hash: string;
}

export interface ClinicOverview {
  date: string;
  generatedAt: string;
  capacity: number;
  metrics: {
    scheduled: number;
    waiting: number;
    inRoom: number;
    toReview: number;
    completed: number;
    draftNotes: number;
    unapprovedWrites: number;
    safetyIntercepts: number;
    notificationsUnread: number;
    avgWaitMinutes: number;
    signatureRate: number;
    loadPercent: number;
  };
  appointments: ClinicAppointment[];
  timeline: Array<{
    id: string;
    patientId: string;
    patientName: string;
    time: string;
    startMinutes: number;
    durationMinutes: number;
    priority: Priority;
    queueCategory: QueueCategory;
    room: string;
  }>;
  nextAppointment: ClinicAppointment | null;
  attention: ClinicNotification[];
  drafts: ClinicNote[];
  activity: ClinicAuditEvent[];
}

export interface ClinicSlot {
  startMinutes: number;
  time: string;
  durationMinutes: number;
  available: boolean;
  appointmentId: string | null;
  patientName: string | null;
}

export interface Availability {
  date: string;
  durationMinutes: number;
  openMinutes: number;
  closeMinutes: number;
  slots: ClinicSlot[];
  availableCount: number;
  bookedCount: number;
}

export interface ClinicPreferences {
  appearance: 'system' | 'light' | 'dark';
  density: 'comfortable' | 'compact';
  reduceMotion: boolean;
  defaultNoteTemplate: string;
  showSyntheticBanner: boolean;
  notificationsEnabled: boolean;
}

export type InvoiceStatus = 'DRAFT' | 'SENT' | 'PAID' | 'VOID';

export interface ClinicInvoice {
  id: string;
  appointmentId: string | null;
  patientId: string;
  patientName: string;
  mrn: string | null;
  date: string;
  time: string;
  visitType: string;
  cptCode: string;
  cptDescription: string;
  icd10: string;
  payer: string;
  amountCents: number;
  insuranceEstimateCents: number;
  patientResponsibilityCents: number;
  status: InvoiceStatus;
  noteId: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface BillingSummary {
  totalCents: number;
  collectedCents: number;
  outstandingCents: number;
  invoiceCount: number;
  byStatus: Record<InvoiceStatus, number>;
}

export interface EducationProgress {
  bookmarks: string[];
  completed: string[];
  claimed: string[];
}

export interface PatientChart {
  patient: Record<string, unknown> & {
    id: string;
    name: string;
    mrn?: string;
    age?: number;
    gender?: string;
    dob?: string;
    patientPhone?: string;
    chiefComplaint?: string;
    visitType?: string;
    allergies?: string[];
    conditions?: string[];
    medications?: string[];
    vitals?: Record<string, string>;
    recentLabs?: Array<Record<string, unknown>>;
    documents?: Array<Record<string, unknown>>;
    clinicalHistory?: unknown[];
    consultationTranscript?: string;
    preparationState?: string;
    status?: string;
  };
  summary: ClinicPatientSummary;
  appointments: ClinicAppointment[];
  notes: ClinicNote[];
  notifications: ClinicNotification[];
}

export class ClinicConflictError extends ApiError {
  conflict?: ClinicAppointment | null;
  constructor(error: ApiError) {
    super(error.message, { status: error.status, code: error.code, body: error.body });
    this.name = 'ClinicConflictError';
    const body = (error.body || {}) as { conflict?: ClinicAppointment };
    this.conflict = body.conflict || null;
  }
}

function jsonHeaders(): HeadersInit {
  return { 'Content-Type': 'application/json' };
}

async function call<T>(path: string, init?: RequestInit): Promise<T> {
  try {
    return await apiJson<T>(`/api/clinic${path}`, init);
  } catch (error) {
    if (error instanceof ApiError && error.status === 409 && error.code === 'APPOINTMENT_CONFLICT') {
      throw new ClinicConflictError(error);
    }
    throw error;
  }
}

export const clinicApi = {
  health: () => call<{ status: string; durable: boolean; date: string; patients: number; appointments: number; unreadNotifications: number }>('/health'),

  overview: (date?: string) =>
    call<ClinicOverview>(`/overview${date ? `?date=${encodeURIComponent(date)}` : ''}`),

  listPatients: (params: { query?: string; filter?: string; date?: string } = {}) => {
    const search = new URLSearchParams();
    if (params.query) search.set('q', params.query);
    if (params.filter && params.filter !== 'all') search.set('filter', params.filter);
    if (params.date) search.set('date', params.date);
    const qs = search.toString();
    return call<{ count: number; patients: ClinicPatientSummary[] }>(`/patients${qs ? `?${qs}` : ''}`);
  },

  getPatient: (id: string) => call<PatientChart>(`/patients/${encodeURIComponent(id)}`),

  createPatient: (input: {
    name: string;
    age?: number;
    gender?: string;
    dob?: string;
    mrn?: string;
    phone?: string;
    chiefComplaint?: string;
    visitType?: string;
    allergies?: string[] | string;
    conditions?: string[];
    medications?: string[];
    date?: string;
    time?: string;
    durationMinutes?: number;
    roomOrVirtual?: string;
    book?: boolean;
  }) =>
    call<{ patient: PatientChart['patient']; summary: ClinicPatientSummary; appointment: ClinicAppointment | null; conflict?: { message: string; appointment: ClinicAppointment | null } }>(
      '/patients',
      { method: 'POST', headers: jsonHeaders(), body: JSON.stringify(input) }
    ),

  updatePatient: (id: string, patch: Record<string, unknown>) =>
    call<PatientChart>(`/patients/${encodeURIComponent(id)}`, {
      method: 'PATCH',
      headers: jsonHeaders(),
      body: JSON.stringify(patch)
    }),

  listAppointments: (params: { date?: string; from?: string; to?: string; patientId?: string; includeCancelled?: boolean } = {}) => {
    const search = new URLSearchParams();
    if (params.date) search.set('date', params.date);
    if (params.from) search.set('from', params.from);
    if (params.to) search.set('to', params.to);
    if (params.patientId) search.set('patientId', params.patientId);
    if (params.includeCancelled) search.set('includeCancelled', 'true');
    const qs = search.toString();
    return call<{ count: number; appointments: ClinicAppointment[] }>(`/appointments${qs ? `?${qs}` : ''}`);
  },

  availability: (params: { date?: string; durationMinutes?: number; stepMinutes?: number } = {}) => {
    const search = new URLSearchParams();
    if (params.date) search.set('date', params.date);
    if (params.durationMinutes) search.set('durationMinutes', String(params.durationMinutes));
    if (params.stepMinutes) search.set('stepMinutes', String(params.stepMinutes));
    const qs = search.toString();
    return call<Availability>(`/availability${qs ? `?${qs}` : ''}`);
  },

  createAppointment: (input: {
    patientId: string;
    date?: string;
    time?: string;
    durationMinutes?: number;
    appointmentType?: string;
    chiefComplaint?: string;
    roomOrVirtual?: string;
    priority?: Priority;
    allowConflict?: boolean;
  }) =>
    call<{ appointment: ClinicAppointment }>('/appointments', {
      method: 'POST',
      headers: jsonHeaders(),
      body: JSON.stringify(input)
    }),

  rescheduleAppointment: (id: string, input: { date: string; time: string }) =>
    call<{ appointment: ClinicAppointment }>(`/appointments/${encodeURIComponent(id)}/reschedule`, {
      method: 'POST',
      headers: jsonHeaders(),
      body: JSON.stringify(input)
    }),

  updateAppointment: (id: string, patch: Record<string, unknown>) =>
    call<{ appointment: ClinicAppointment }>(`/appointments/${encodeURIComponent(id)}`, {
      method: 'PATCH',
      headers: jsonHeaders(),
      body: JSON.stringify(patch)
    }),

  cancelAppointment: (id: string) =>
    call<{ appointment: ClinicAppointment }>(`/appointments/${encodeURIComponent(id)}/cancel`, {
      method: 'POST',
      headers: jsonHeaders()
    }),

  listNotes: (params: { patientId?: string; status?: string } = {}) => {
    const search = new URLSearchParams();
    if (params.patientId) search.set('patientId', params.patientId);
    if (params.status) search.set('status', params.status);
    const qs = search.toString();
    return call<{ count: number; notes: ClinicNote[] }>(`/notes${qs ? `?${qs}` : ''}`);
  },

  saveDraft: (input: {
    id?: string;
    patientId: string;
    patientName?: string;
    appointmentId?: string | null;
    template?: string;
    title?: string;
    note: ClinicNoteContent;
    diagnoses?: string[];
    prescriptions?: unknown[];
  }) =>
    call<{ note: ClinicNote }>('/notes', {
      method: 'POST',
      headers: jsonHeaders(),
      body: JSON.stringify(input)
    }),

  signNote: (input: {
    noteId?: string;
    patientId?: string;
    patientName?: string;
    appointmentId?: string | null;
    title?: string;
    note?: ClinicNoteContent;
    diagnoses?: string[];
    prescriptions?: unknown[];
    attestation?: string;
  }) =>
    call<{
      note: ClinicNote;
      alreadySigned: boolean;
      mirrorStatus?: 'mirrored' | 'failed' | 'already_signed';
      mirrorError?: string;
      attestationId?: string | null;
      syncedEncounterId?: string | null;
    }>('/encounters/sign', {
      method: 'POST',
      headers: jsonHeaders(),
      body: JSON.stringify(input)
    }),

  listNotifications: (params: { unreadOnly?: boolean; includeResolved?: boolean; limit?: number } = {}) => {
    const search = new URLSearchParams();
    if (params.unreadOnly) search.set('unread', 'true');
    if (params.includeResolved) search.set('includeResolved', 'true');
    if (params.limit) search.set('limit', String(params.limit));
    const qs = search.toString();
    return call<{ count: number; unread: number; notifications: ClinicNotification[] }>(
      `/notifications${qs ? `?${qs}` : ''}`
    );
  },

  markNotificationRead: (id: string) =>
    call<{ notification: ClinicNotification }>(`/notifications/${encodeURIComponent(id)}/read`, {
      method: 'POST',
      headers: jsonHeaders()
    }),

  resolveNotification: (id: string) =>
    call<{ notification: ClinicNotification }>(`/notifications/${encodeURIComponent(id)}/resolve`, {
      method: 'POST',
      headers: jsonHeaders()
    }),

  markAllNotificationsRead: () =>
    call<{ updated: number }>('/notifications/read-all', { method: 'POST', headers: jsonHeaders() }),

  listAudit: (limit = 50) => call<{ count: number; events: ClinicAuditEvent[] }>(`/audit?limit=${limit}`),

  verifyAudit: () =>
    call<{ valid: boolean; totalEventsVerified: number; headHash: string | null; brokenAt?: string }>('/audit/verify'),

  search: (query: string) =>
    call<{
      patients: ClinicPatientSummary[];
      notes: ClinicNote[];
      appointments: ClinicAppointment[];
      total: number;
    }>(`/search?q=${encodeURIComponent(query)}`),

  getPreferences: () => call<{ preferences: ClinicPreferences }>('/preferences'),

  updatePreferences: (patch: Partial<ClinicPreferences>) =>
    call<{ preferences: ClinicPreferences }>('/preferences', {
      method: 'PATCH',
      headers: jsonHeaders(),
      body: JSON.stringify(patch)
    }),

  listInvoices: (params: { status?: InvoiceStatus | 'all' } = {}) => {
    const qs = params.status && params.status !== 'all' ? `?status=${params.status}` : '';
    return call<{ invoices: ClinicInvoice[]; summary: BillingSummary }>(`/billing${qs}`);
  },

  updateInvoiceStatus: (id: string, status: InvoiceStatus) =>
    call<{ invoice: ClinicInvoice }>(`/billing/${encodeURIComponent(id)}`, {
      method: 'PATCH',
      headers: jsonHeaders(),
      body: JSON.stringify({ status })
    }),

  getEducationProgress: () => call<{ progress: EducationProgress }>('/education/progress'),

  updateEducationProgress: (patch: Partial<EducationProgress>) =>
    call<{ progress: EducationProgress }>('/education/progress', {
      method: 'PATCH',
      headers: jsonHeaders(),
      body: JSON.stringify(patch)
    })
};

/** Local calendar date (`YYYY-MM-DD`) — matches how the clinic API keys days. */
export function localDateString(date = new Date()): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}
