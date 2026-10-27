/**
 * Care Loop client.
 *
 * Talks to `/api/clinic/live/*`, which reads the same Postgres rows the patient
 * Android app writes. This is intentionally separate from `clinicApi.ts`: that
 * client targets the older seeded workspace, and mixing the two would make it
 * easy to render demo data beside real data without noticing.
 */

import { apiJson } from './api';

export type LiveAppointmentStatus =
  | 'BOOKED'
  | 'CONFIRMED'
  | 'CANCELLED'
  | 'COMPLETED'
  | 'NO_SHOW';

export interface LiveAppointment {
  id: string;
  patientId: string;
  patientName: string;
  dateOfBirth: string | null;
  sex: string | null;
  clinicianId: string;
  patientLocalId: string | null;
  scheduledFor: string;
  durationMinutes: number;
  status: LiveAppointmentStatus;
  confirmedAt: string | null;
  reason: string | null;
  createdAt: string;
  updatedAt: string;
  openMessageCount: number;
  needsAttention: boolean;
}

export type AttentionSeverity = 'critical' | 'warning' | 'info';

export interface LiveAttentionItem {
  id: string;
  patientId: string;
  patientName: string;
  kind: string;
  title: string;
  body: string;
  severity: AttentionSeverity;
  requiresTriage: boolean;
  appointmentId: string | null;
  createdAt: string;
}

export interface LiveThreadSummary {
  patientId: string;
  patientName: string;
  lastMessageAt: string;
  lastMessage: string;
  openCount: number;
  messageCount: number;
}

export interface LiveThreadMessage {
  id: string;
  patientId: string;
  patientName: string;
  body: string;
  kind: string;
  authorName: string | null;
  direction: 'INBOUND' | 'CLINIC';
  appointmentId: string | null;
  readAt: string | null;
  resolvedAt: string | null;
  createdAt: string;
}

export interface LiveThread {
  patientId: string;
  patientName: string;
  openCount: number;
  messages: LiveThreadMessage[];
}

export interface LiveOverview {
  generatedAt: string;
  persistence: 'postgres';
  window: { from: string; to: string };
  metrics: {
    scheduled: number;
    confirmed: number;
    unconfirmed: number;
    cancelled: number;
    needsAttention: number;
    patients: number;
  };
  appointments: LiveAppointment[];
  attention: LiveAttentionItem[];
  threads: LiveThreadSummary[];
}

function jsonHeaders(): HeadersInit {
  return { 'Content-Type': 'application/json' };
}

export const careLoopApi = {
  overview: (window?: { from: string; to: string }) => {
    const qs = window
      ? `?from=${encodeURIComponent(window.from)}&to=${encodeURIComponent(window.to)}`
      : '';
    return apiJson<LiveOverview>(`/api/clinic/live/overview${qs}`);
  },

  thread: (patientId: string) =>
    apiJson<LiveThread>(
      `/api/clinic/live/messages?patientId=${encodeURIComponent(patientId)}`
    ),

  confirm: (appointmentId: string) =>
    apiJson<{ appointment: LiveAppointment }>(
      `/api/clinic/live/appointments/${encodeURIComponent(appointmentId)}/confirm`,
      { method: 'POST', headers: jsonHeaders() }
    ),

  reschedule: (appointmentId: string, scheduledFor: string) =>
    apiJson<{ appointment: LiveAppointment }>(
      `/api/clinic/live/appointments/${encodeURIComponent(appointmentId)}/reschedule`,
      {
        method: 'POST',
        headers: jsonHeaders(),
        body: JSON.stringify({ scheduledFor })
      }
    ),

  cancel: (appointmentId: string) =>
    apiJson<{ appointment: LiveAppointment }>(
      `/api/clinic/live/appointments/${encodeURIComponent(appointmentId)}/cancel`,
      { method: 'POST', headers: jsonHeaders() }
    ),

  reply: (patientId: string, body: string) =>
    apiJson<{ message: LiveThreadMessage }>('/api/clinic/live/messages', {
      method: 'POST',
      headers: jsonHeaders(),
      body: JSON.stringify({ patientId, body })
    }),

  resolve: (target: { patientId?: string; messageId?: string }) =>
    apiJson<{ resolved: number }>('/api/clinic/live/messages/resolve', {
      method: 'POST',
      headers: jsonHeaders(),
      body: JSON.stringify(target)
    })
};

/** "9:40 AM" in the browser's own timezone. */
export function formatClock(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return '—';
  return date.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
}

/** "Today", "Tomorrow", or a short date, relative to the device. */
export function formatDayLabel(iso: string, now = new Date()): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return '';

  const startOf = (value: Date) =>
    new Date(value.getFullYear(), value.getMonth(), value.getDate()).getTime();
  const days = Math.round((startOf(date) - startOf(now)) / 86_400_000);

  if (days === 0) return 'Today';
  if (days === 1) return 'Tomorrow';
  if (days === -1) return 'Yesterday';
  return date.toLocaleDateString([], { month: 'short', day: 'numeric' });
}

/** "2 min ago" for a queue item, capped at the date after a week. */
export function formatAgo(iso: string, now = new Date()): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return '';
  const minutes = Math.max(0, Math.round((now.getTime() - date.getTime()) / 60_000));
  if (minutes < 1) return 'just now';
  if (minutes === 1) return '1 min ago';
  if (minutes < 60) return `${minutes} min ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours} hr ago`;
  return formatDayLabel(iso, now);
}
