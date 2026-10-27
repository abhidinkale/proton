import { useCallback, useEffect, useMemo, useState } from 'react';

/**
 * Dashboard personalization.
 *
 * Two things a clinician can change, and both persist per user:
 *
 *  1. Accent — one colour, applied as CSS custom properties on <html>. Every
 *     accent-darkened surface is a token, so nothing hardcodes blue.
 *  2. Layout — which panels are shown, and the order inside each column.
 *
 * Deliberately not persisted: density is a per-session comfort choice on top,
 * but we keep it here too because a doctor who prefers compact wants it next
 * login as well.
 */

export type AccentId = 'blue' | 'teal' | 'violet' | 'amber' | 'rose' | 'graphite';
export type Density = 'comfortable' | 'compact';

export interface AccentOption {
  id: AccentId;
  label: string;
  /** Representative swatch for the picker — must match the CSS token. */
  swatch: string;
  /** One line of guidance, shown on hover. */
  note: string;
}

export const ACCENTS: AccentOption[] = [
  { id: 'blue', label: 'Clinic blue', swatch: '#4D6BFE', note: 'Default. Calm, legible under fluorescent light.' },
  { id: 'teal', label: 'Teal', swatch: '#0F766E', note: 'Quiet, reads well next to vital-sign greens.' },
  { id: 'violet', label: 'Violet', swatch: '#6A4CD9', note: 'More presence; good for demo lighting.' },
  { id: 'amber', label: 'Amber', swatch: '#B26A0B', note: 'Warm; sits next to paper without contrast fights.' },
  { id: 'rose', label: 'Rose', swatch: '#B23A5A', note: 'Editorial. Use sparingly — reads as an alert colour.' },
  { id: 'graphite', label: 'Graphite', swatch: '#2A2E33', note: 'Monochrome. For clinicians who dislike colour.' }
];

export type MainPanelId = 'signatureGate' | 'flow' | 'queue' | 'notes' | 'activity';
export type RailPanelId = 'calendar' | 'schedule' | 'careLoop' | 'frontDesk';
export type PanelId = MainPanelId | RailPanelId;

export interface PanelMeta {
  label: string;
  hint: string;
  region: 'main' | 'rail';
}

export const PANEL_META: Record<PanelId, PanelMeta> = {
  signatureGate: {
    label: 'Signature gate',
    hint: 'Signed vs. unsigned writes for the selected day.',
    region: 'main'
  },
  flow: {
    label: 'Patient flow',
    hint: 'Hourly visits, with new / insurance filters.',
    region: 'main'
  },
  queue: {
    label: 'Patient queue',
    hint: 'Every patient on the books, filterable by stage.',
    region: 'main'
  },
  notes: {
    label: 'Notes to sign',
    hint: 'Drafts waiting on your signature.',
    region: 'main'
  },
  activity: { label: 'Recent activity', hint: 'Audit trail for the selected day.', region: 'main' },
  calendar: { label: 'Month calendar', hint: 'Days with visits, jump to any date.', region: 'rail' },
  schedule: { label: "Today's schedule", hint: 'Timeline for the selected day.', region: 'rail' },
  careLoop: { label: 'Care loop', hint: 'Patients waiting on a reply.', region: 'rail' },
  frontDesk: { label: 'Front desk', hint: 'Register, book, resume an encounter.', region: 'rail' }
};

export const PANEL_ORDER_MAIN: MainPanelId[] = ['signatureGate', 'flow', 'queue', 'notes', 'activity'];
export const PANEL_ORDER_RAIL: RailPanelId[] = ['calendar', 'schedule', 'careLoop', 'frontDesk'];

export interface DashboardPrefs {
  accent: AccentId;
  density: Density;
  order: { main: MainPanelId[]; rail: RailPanelId[] };
  hidden: PanelId[];
}

/** Panels a doctor should not meet on their first visit. */
const DEFAULT_HIDDEN: PanelId[] = ['notes', 'activity'];

const DEFAULT_PREFS: DashboardPrefs = {
  accent: 'blue',
  density: 'comfortable',
  order: { main: [...PANEL_ORDER_MAIN], rail: [...PANEL_ORDER_RAIL] },
  // The first screen a doctor sees stays quiet: the signature prompt covers
  // notes, and the audit trail is opt-in. Both are one toggle away.
  hidden: [...DEFAULT_HIDDEN]
};

function storageKey(userKey: string): string {
  return `proton.dashboard.v1.${userKey || 'anonymous'}`;
}

function sanitize(raw: unknown): DashboardPrefs {
  if (!raw || typeof raw !== 'object') {
    // Copy every array: a shallow spread would share DEFAULT_PREFS' arrays, and
    // one in-place edit anywhere would poison the defaults for the session.
    return { ...DEFAULT_PREFS, order: { ...DEFAULT_PREFS.order }, hidden: [...DEFAULT_PREFS.hidden] };
  }
  const input = raw as Partial<DashboardPrefs>;
  const accent = ACCENTS.some((option) => option.id === input.accent) ? (input.accent as AccentId) : 'blue';
  const density: Density = input.density === 'compact' ? 'compact' : 'comfortable';

  const keep = <T extends PanelId>(values: unknown, fallback: T[]): T[] => {
    const next = Array.isArray(values) ? values.filter((value): value is T => fallback.includes(value as T)) : [];
    // Anything new in the product lands at the end rather than disappearing.
    for (const value of fallback) if (!next.includes(value)) next.push(value);
    return next;
  };

  const hidden = Array.isArray(input.hidden)
    ? (input.hidden.filter((value) => PANEL_META[value as PanelId]) as PanelId[])
    : [];

  return {
    accent,
    density,
    order: {
      main: keep<MainPanelId>(input.order?.main, PANEL_ORDER_MAIN),
      rail: keep<RailPanelId>(input.order?.rail, PANEL_ORDER_RAIL)
    },
    hidden
  };
}

function readPrefs(userKey: string): DashboardPrefs {
  try {
    const stored = window.localStorage.getItem(storageKey(userKey));
    return stored ? sanitize(JSON.parse(stored)) : sanitize(null);
  } catch {
    return sanitize(null);
  }
}

function writePrefs(userKey: string, prefs: DashboardPrefs) {
  try {
    window.localStorage.setItem(storageKey(userKey), JSON.stringify(prefs));
  } catch {
    /* Storage can be unavailable in private windows; the desk still works. */
  }
}

export interface DashboardPrefsApi {
  prefs: DashboardPrefs;
  hidden: Set<PanelId>;
  setAccent: (accent: AccentId) => void;
  setDensity: (density: Density) => void;
  togglePanel: (panel: PanelId) => void;
  movePanel: (panel: PanelId, direction: -1 | 1) => void;
  reset: () => void;
  isCustomized: boolean;
}

export function useDashboardPrefs(userKey: string): DashboardPrefsApi {
  const [prefs, setPrefs] = useState<DashboardPrefs>(() => readPrefs(userKey));

  // The accent lives on <html> so the rail, top bar and focus rings inherit it.
  useEffect(() => {
    document.documentElement.dataset.accent = prefs.accent;
  }, [prefs.accent]);

  // Density is a second root attribute: index.css keys the compact rules off it,
  // so it has to be written here or the picker in the panel does nothing.
  useEffect(() => {
    document.documentElement.dataset.density = prefs.density;
  }, [prefs.density]);

  useEffect(() => {
    writePrefs(userKey, prefs);
  }, [userKey, prefs]);

  const update = useCallback((mutate: (draft: DashboardPrefs) => DashboardPrefs) => {
    setPrefs((current) => mutate(structuredClone(current)));
  }, []);

  const setAccent = useCallback((accent: AccentId) => update((draft) => ({ ...draft, accent })), [update]);
  const setDensity = useCallback(
    (density: Density) => update((draft) => ({ ...draft, density })),
    [update]
  );

  const togglePanel = useCallback(
    (panel: PanelId) =>
      update((draft) => {
        const isHidden = draft.hidden.includes(panel);
        return {
          ...draft,
          hidden: isHidden ? draft.hidden.filter((entry) => entry !== panel) : [...draft.hidden, panel]
        };
      }),
    [update]
  );

  const movePanel = useCallback(
    (panel: PanelId, direction: -1 | 1) =>
      update((draft) => {
        const region = PANEL_META[panel].region;
        const order = region === 'main' ? [...draft.order.main] : [...draft.order.rail];
        const index = order.indexOf(panel as never);
        const target = index + direction;
        if (index < 0 || target < 0 || target >= order.length) return draft;
        [order[index], order[target]] = [order[target], order[index]];
        return {
          ...draft,
          order: region === 'main' ? { ...draft.order, main: order as MainPanelId[] } : { ...draft.order, rail: order as RailPanelId[] }
        };
      }),
    [update]
  );

  const reset = useCallback(() => {
    const next = sanitize(null);
    setPrefs(next);
  }, []);

  const hidden = useMemo(() => new Set(prefs.hidden), [prefs.hidden]);

  const isCustomized =
    prefs.accent !== 'blue' ||
    prefs.density !== 'comfortable' ||
    [...prefs.hidden].sort().join() !== [...DEFAULT_HIDDEN].sort().join() ||
    prefs.order.main.join() !== PANEL_ORDER_MAIN.join() ||
    prefs.order.rail.join() !== PANEL_ORDER_RAIL.join();

  return { prefs, hidden, setAccent, setDensity, togglePanel, movePanel, reset, isCustomized };
}
