import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  TrendingUp,
  FileText,
  Send,
  CheckCircle2,
  X,
  Printer,
  Download,
  ShieldCheck,
  CreditCard,
  LoaderCircle,
  AlertTriangle,
  RotateCcw,
  Ban,
  RefreshCw
} from 'lucide-react';
import Layout from '../components/Layout';
import {
  clinicApi,
  type BillingSummary,
  type ClinicInvoice,
  type InvoiceStatus
} from '../lib/clinicApi';

const STATUS_META: Record<InvoiceStatus, { label: string; badge: string; dot: string }> = {
  DRAFT: {
    label: 'Draft',
    badge: 'bg-accent-wash text-accent-ink',
    dot: 'var(--accent-line)'
  },
  SENT: {
    label: 'Sent',
    badge: 'bg-caution-wash text-caution',
    dot: 'var(--c-caution-line)'
  },
  PAID: {
    label: 'Paid',
    badge: 'bg-settled-wash text-settled',
    dot: '#86EFAC'
  },
  VOID: {
    label: 'Void',
    badge: 'bg-paper-2 text-ink-2',
    dot: '#D1D5DB'
  }
};

const FILTERS: Array<{ key: InvoiceStatus | 'all'; label: string }> = [
  { key: 'all', label: 'All' },
  { key: 'DRAFT', label: 'Draft' },
  { key: 'SENT', label: 'Sent' },
  { key: 'PAID', label: 'Paid' },
  { key: 'VOID', label: 'Void' }
];

function formatCurrency(cents: number): string {
  return `$ ${(cents / 100).toLocaleString('en-US', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  })}`;
}

function initials(name: string): string {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() || '')
    .join('');
}

function downloadInvoiceCsv(invoice: ClinicInvoice) {
  const rows = [
    ['Field', 'Value'],
    ['Invoice', invoice.id],
    ['Patient', invoice.patientName],
    ['MRN', invoice.mrn || ''],
    ['Date of service', `${invoice.date} ${invoice.time}`],
    ['Visit type', invoice.visitType],
    ['CPT', invoice.cptCode],
    ['CPT description', invoice.cptDescription],
    ['ICD-10', invoice.icd10],
    ['Payer', invoice.payer],
    ['Total billed (USD)', (invoice.amountCents / 100).toFixed(2)],
    ['Insurance estimate (USD)', (invoice.insuranceEstimateCents / 100).toFixed(2)],
    ['Patient responsibility (USD)', (invoice.patientResponsibilityCents / 100).toFixed(2)],
    ['Status', invoice.status]
  ];
  const csv = rows.map((row) => row.map((cell) => `"${String(cell).replaceAll('"', '""')}"`).join(',')).join('\n');
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `${invoice.id}.csv`;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

export default function Billing() {
  const [invoices, setInvoices] = useState<ClinicInvoice[]>([]);
  const [summary, setSummary] = useState<BillingSummary | null>(null);
  const [filter, setFilter] = useState<InvoiceStatus | 'all'>('all');
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [pendingInvoiceId, setPendingInvoiceId] = useState<string | null>(null);
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [selectedInvoice, setSelectedInvoice] = useState<ClinicInvoice | null>(null);

  const showToast = (message: string) => {
    setToastMessage(message);
    window.setTimeout(() => setToastMessage(null), 3200);
  };

  const loadLedger = useCallback(async () => {
    setIsLoading(true);
    setLoadError(null);
    try {
      // Always fetch the complete ledger so the KPI cards stay accurate while a
      // status tab is selected.
      const result = await clinicApi.listInvoices();
      setInvoices(result.invoices);
      setSummary(result.summary);
    } catch (error) {
      setLoadError((error as Error).message || 'The billing ledger could not be loaded.');
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadLedger();
  }, [loadLedger]);

  const changeStatus = async (invoice: ClinicInvoice, status: InvoiceStatus) => {
    setPendingInvoiceId(invoice.id);
    try {
      const { invoice: updated } = await clinicApi.updateInvoiceStatus(invoice.id, status);
      setInvoices((current) => current.map((entry) => (entry.id === updated.id ? updated : entry)));
      setSelectedInvoice((current) => (current && current.id === updated.id ? updated : current));
      // Recompute totals from the server so the summary is authoritative.
      const result = await clinicApi.listInvoices();
      setSummary(result.summary);
      setInvoices(result.invoices);
      showToast(
        status === 'SENT'
          ? `Invoice ${invoice.cptCode} sent to ${invoice.payer}.`
          : status === 'PAID'
            ? `Invoice ${invoice.cptCode} marked paid.`
            : status === 'VOID'
              ? `Invoice ${invoice.cptCode} voided.`
              : `Invoice ${invoice.cptCode} reopened as a draft.`
      );
    } catch (error) {
      showToast((error as Error).message || 'The invoice could not be updated.');
    } finally {
      setPendingInvoiceId(null);
    }
  };

  const filteredInvoices = useMemo(
    () => (filter === 'all' ? invoices : invoices.filter((invoice) => invoice.status === filter)),
    [invoices, filter]
  );

  const totals = summary ?? {
    totalCents: 0,
    collectedCents: 0,
    outstandingCents: 0,
    invoiceCount: 0,
    byStatus: { DRAFT: 0, SENT: 0, PAID: 0, VOID: 0 }
  };

  const draftInvoices = invoices.filter((invoice) => invoice.status === 'DRAFT');
  const sentInvoices = invoices.filter((invoice) => invoice.status === 'SENT');
  const awaitingSubmissionCents = draftInvoices.reduce((sum, invoice) => sum + invoice.amountCents, 0);

  const donutSegments = useMemo(() => {
    const circumference = 2 * Math.PI * 38;
    const groups = [
      { key: 'PAID', value: totals.byStatus.PAID, color: 'var(--c-on-solid)' },
      { key: 'SENT', value: totals.byStatus.SENT, color: 'var(--c-on-solid)' },
      { key: 'DRAFT', value: totals.byStatus.DRAFT, color: 'var(--c-on-solid)' },
      { key: 'VOID', value: totals.byStatus.VOID, color: 'var(--c-ink-3)' }
    ];
    const total = groups.reduce((sum, group) => sum + group.value, 0);
    let offset = 0;
    return groups
      .filter((group) => group.value > 0)
      .map((group) => {
        const length = total > 0 ? (group.value / total) * circumference : 0;
        const segment = { ...group, length, offset, circumference };
        offset += length;
        return segment;
      });
  }, [totals]);

  return (
    <Layout>
      <div className="space-y-6 animate-in fade-in pb-12 relative">
        {toastMessage && (
          <div className="fixed bottom-6 right-6 z-50 flex items-center gap-2.5 px-4 py-2.5 bg-solid text-white rounded-2xl shadow-xl text-xs font-semibold animate-in fade-in slide-in-from-bottom-2">
            <CheckCircle2 size={16} className="text-settled-on-solid shrink-0" />
            <span>{toastMessage}</span>
          </div>
        )}

        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-ink">
              Billing & invoices
            </h1>
            <p className="text-xs sm:text-sm text-ink-2 mt-0.5">
              Every invoice is derived from a signed encounter — no invented claims.
            </p>
          </div>

          <button
            type="button"
            onClick={() => { void loadLedger(); }}
            disabled={isLoading}
            className="inline-flex items-center gap-1.5 self-start rounded-full border border-rule bg-paper px-3.5 py-1.5 text-xs font-semibold text-ink shadow-xs transition-colors hover:bg-canvas disabled:opacity-60 cursor-pointer"
          >
            <RefreshCw size={13} className={isLoading ? 'animate-spin' : ''} />
            Refresh ledger
          </button>
        </div>

        {loadError && (
          <div className="flex items-start gap-2 rounded-2xl border border-caution-line bg-caution-wash px-4 py-3 text-xs text-caution">
            <AlertTriangle size={15} className="mt-0.5 shrink-0" />
            <div>
              <p className="font-semibold">Billing ledger unavailable</p>
              <p className="mt-0.5 opacity-80">{loadError}</p>
            </div>
          </div>
        )}

        {/* Analytics */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          <div className="lg:col-span-4 bg-paper rounded-3xl border border-rule p-6 shadow-[0_2px_12px_rgba(0,0,0,0.02)] flex flex-col items-center justify-center relative">
            <div className="relative w-48 h-48 flex items-center justify-center">
              <svg className="w-full h-full transform -rotate-90" viewBox="0 0 100 100">
                <circle cx="50" cy="50" r="38" fill="transparent" stroke="var(--c-on-solid)" strokeWidth="12" />
                {donutSegments.map((segment) => (
                  <circle
                    key={segment.key}
                    cx="50"
                    cy="50"
                    r="38"
                    fill="transparent"
                    stroke={segment.color}
                    strokeWidth="12"
                    strokeDasharray={`${segment.length} ${segment.circumference - segment.length}`}
                    strokeDashoffset={-segment.offset}
                    strokeLinecap="butt"
                  />
                ))}
              </svg>

              <div className="absolute inset-0 flex flex-col items-center justify-center text-center">
                <span className="text-2xl font-extrabold tracking-tight text-ink font-mono">
                  {isLoading && !summary ? '—' : formatCurrency(totals.totalCents)}
                </span>
                <span className="text-[10px] uppercase font-bold tracking-wider text-ink-3 mt-0.5">
                  Total billed
                </span>
              </div>
            </div>

            <div className="w-full mt-4 pt-4 border-t border-rule flex items-center justify-around text-[11px]">
              {(['PAID', 'SENT', 'DRAFT'] as const).map((status) => (
                <div key={status} className="flex items-center gap-1.5">
                  <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: STATUS_META[status].dot }} />
                  <span className="text-ink-2">
                    {STATUS_META[status].label} · {totals.byStatus[status]}
                  </span>
                </div>
              ))}
            </div>
          </div>

          <div className="lg:col-span-8 grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="bg-accent-wash rounded-3xl border border-accent-line p-5 flex flex-col justify-between text-accent-ink shadow-xs">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold uppercase tracking-wider">Collected</span>
                <div className="flex items-center gap-0.5 px-2 py-0.5 rounded-full bg-paper/70 text-[10px] font-bold">
                  <TrendingUp className="w-3 h-3" />
                  <span>{totals.byStatus.PAID}</span>
                </div>
              </div>
              <div className="my-4">
                <div className="text-2xl sm:text-3xl font-black font-mono tracking-tight">
                  {formatCurrency(totals.collectedCents)}
                </div>
                <div className="text-[10px] opacity-80 mt-1">Payments settled</div>
              </div>
              <div className="text-[10px] font-medium opacity-75">
                {totals.byStatus.PAID} paid {totals.byStatus.PAID === 1 ? 'invoice' : 'invoices'}
              </div>
            </div>

            <div className="bg-accent-wash rounded-3xl border border-accent-line p-5 flex flex-col justify-between text-accent-ink shadow-xs">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold uppercase tracking-wider">Outstanding</span>
                <div className="flex items-center gap-0.5 px-2 py-0.5 rounded-full bg-paper/70 text-[10px] font-bold">
                  <Send className="w-3 h-3" />
                  <span>{totals.byStatus.SENT}</span>
                </div>
              </div>
              <div className="my-4">
                <div className="text-2xl sm:text-3xl font-black font-mono tracking-tight">
                  {formatCurrency(totals.outstandingCents)}
                </div>
                <div className="text-[10px] opacity-80 mt-1">Awaiting payment or submission</div>
              </div>
              <div className="text-[10px] font-medium opacity-75">
                {sentInvoices.length} sent · {draftInvoices.length} draft
              </div>
            </div>

            <div className="bg-caution-wash rounded-3xl border border-caution-line p-5 flex flex-col justify-between text-caution shadow-xs">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold uppercase tracking-wider">Patient responsibility</span>
                <div className="flex items-center gap-0.5 px-2 py-0.5 rounded-full bg-paper/70 text-[10px] font-bold">
                  <CreditCard className="w-3 h-3" />
                  <span>Est.</span>
                </div>
              </div>
              <div className="my-4">
                <div className="text-2xl sm:text-3xl font-black font-mono tracking-tight">
                  {formatCurrency(
                    invoices
                      .filter((invoice) => invoice.status !== 'VOID')
                      .reduce((sum, invoice) => sum + invoice.patientResponsibilityCents, 0)
                  )}
                </div>
                <div className="text-[10px] opacity-80 mt-1">After insurance estimate</div>
              </div>
              <div className="text-[10px] font-medium opacity-75">
                {totals.invoiceCount} total {totals.invoiceCount === 1 ? 'invoice' : 'invoices'}
              </div>
            </div>
          </div>
        </div>

        {/* Awaiting submission */}
        {draftInvoices.length > 0 && (
          <div>
            <div className="mb-3 flex items-center justify-between">
              <h2 className="text-sm font-bold text-ink uppercase tracking-wider">Awaiting submission</h2>
              <span className="font-mono text-[11px] text-ink-3">{formatCurrency(awaitingSubmissionCents)} uncoded</span>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {draftInvoices.slice(0, 4).map((invoice) => (
                <div key={invoice.id} className="bg-canvas rounded-3xl border border-rule p-4 flex items-center justify-between gap-4">
                  <div className="flex min-w-0 items-center gap-3">
                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-accent-wash text-xs font-bold text-accent-ink">
                      {initials(invoice.patientName)}
                    </div>
                    <div className="min-w-0">
                      <h4 className="truncate text-xs font-bold text-ink">{invoice.patientName}</h4>
                      <p className="truncate text-[11px] text-ink-2">
                        {invoice.cptCode} · {invoice.cptDescription}
                      </p>
                    </div>
                  </div>

                  <div className="flex shrink-0 items-center gap-2.5">
                    <span className="rounded-full bg-paper px-2.5 py-1 font-mono text-[10px] font-semibold text-ink-2">
                      {formatCurrency(invoice.amountCents)}
                    </span>
                    <button
                      type="button"
                      onClick={() => { void changeStatus(invoice, 'SENT'); }}
                      disabled={pendingInvoiceId === invoice.id}
                      className="inline-flex items-center gap-1.5 rounded-full bg-solid px-3 py-1.5 text-xs font-semibold text-white shadow-xs transition-colors hover:bg-solid disabled:opacity-60 cursor-pointer"
                    >
                      {pendingInvoiceId === invoice.id
                        ? <LoaderCircle size={12} className="animate-spin" />
                        : <Send size={11} />}
                      Send
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Ledger */}
        <div className="bg-paper rounded-3xl border border-rule p-5 sm:p-6 shadow-[0_2px_12px_rgba(0,0,0,0.02)] space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3 pb-2 border-b border-rule">
            <div className="flex items-center gap-2 overflow-x-auto">
              {FILTERS.map((entry) => {
                const count = entry.key === 'all' ? invoices.length : totals.byStatus[entry.key];
                return (
                  <button
                    key={entry.key}
                    type="button"
                    onClick={() => setFilter(entry.key)}
                    className={`shrink-0 rounded-full px-3 py-1 text-xs font-semibold transition-colors cursor-pointer ${
                      filter === entry.key
                        ? 'bg-solid text-white shadow-xs'
                        : 'text-ink-2 hover:bg-canvas'
                    }`}
                  >
                    {entry.label} ({count})
                  </button>
                );
              })}
            </div>
            <span className="font-mono text-[10.5px] text-ink-3">
              {filteredInvoices.length} of {invoices.length} displayed
            </span>
          </div>

          {isLoading && invoices.length === 0 ? (
            <div className="flex items-center justify-center gap-2 py-16 text-xs text-ink-2">
              <LoaderCircle size={16} className="animate-spin" />
              Loading the billing ledger…
            </div>
          ) : filteredInvoices.length === 0 ? (
            <div className="flex flex-col items-center justify-center gap-2 py-16 text-center">
              <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-paper-2 text-ink-3">
                <FileText size={20} />
              </div>
              <p className="text-sm font-semibold text-ink">
                {invoices.length === 0 ? 'No billable encounters yet' : `No ${filter.toLowerCase()} invoices`}
              </p>
              <p className="max-w-sm text-[11.5px] leading-relaxed text-ink-2">
                {invoices.length === 0
                  ? 'Complete an encounter and sign the note. The coded invoice then appears here automatically.'
                  : 'Switch tabs to see the rest of the ledger.'}
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="border-b border-rule text-ink-3 font-medium">
                    <th className="pb-3 font-semibold">Patient</th>
                    <th className="pb-3 font-semibold">Service date</th>
                    <th className="pb-3 font-semibold">CPT</th>
                    <th className="pb-3 font-semibold">Payer</th>
                    <th className="pb-3 font-semibold">Amount</th>
                    <th className="pb-3 font-semibold">Status</th>
                    <th className="pb-3 font-semibold text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-rule">
                  {filteredInvoices.map((invoice) => {
                    const meta = STATUS_META[invoice.status];
                    return (
                      <tr
                        key={invoice.id}
                        onClick={() => setSelectedInvoice(invoice)}
                        className="group cursor-pointer transition-colors hover:bg-canvas"
                      >
                        <td className="py-3">
                          <div className="font-semibold text-ink group-hover:text-accent-ink transition-colors">
                            {invoice.patientName}
                          </div>
                          <div className="font-mono text-[10px] text-ink-3">{invoice.mrn || invoice.patientId}</div>
                        </td>
                        <td className="py-3 font-mono text-ink-2">
                          {invoice.date}
                          <span className="ml-1 text-[10px] text-ink-3">{invoice.time}</span>
                        </td>
                        <td className="py-3">
                          <div className="font-mono font-bold text-ink">{invoice.cptCode}</div>
                          <div className="max-w-[190px] truncate text-[10px] text-ink-3">{invoice.cptDescription}</div>
                        </td>
                        <td className="max-w-[150px] truncate py-3 text-ink-2">{invoice.payer}</td>
                        <td className="py-3 font-mono font-bold text-ink">{formatCurrency(invoice.amountCents)}</td>
                        <td className="py-3">
                          <span className={`inline-block rounded-full px-2.5 py-0.5 text-[10px] font-bold ${meta.badge}`}>
                            {meta.label}
                          </span>
                        </td>
                        <td className="py-3 text-right">
                          <div className="flex items-center justify-end gap-1" onClick={(event) => event.stopPropagation()}>
                            <button
                              type="button"
                              onClick={() => setSelectedInvoice(invoice)}
                              className="rounded p-1 text-ink-3 hover:text-ink cursor-pointer"
                              title="View invoice"
                            >
                              <FileText className="w-3.5 h-3.5" />
                            </button>
                            {invoice.status === 'DRAFT' && (
                              <button
                                type="button"
                                onClick={() => { void changeStatus(invoice, 'SENT'); }}
                                disabled={pendingInvoiceId === invoice.id}
                                className="rounded p-1 text-ink-3 hover:text-accent-ink disabled:opacity-50 cursor-pointer"
                                title="Send to payer"
                              >
                                <Send className="w-3.5 h-3.5" />
                              </button>
                            )}
                            {invoice.status === 'SENT' && (
                              <button
                                type="button"
                                onClick={() => { void changeStatus(invoice, 'PAID'); }}
                                disabled={pendingInvoiceId === invoice.id}
                                className="rounded p-1 text-ink-3 hover:text-settled disabled:opacity-50 cursor-pointer"
                                title="Mark paid"
                              >
                                <CheckCircle2 className="w-3.5 h-3.5" />
                              </button>
                            )}
                            {(invoice.status === 'PAID' || invoice.status === 'VOID') && (
                              <button
                                type="button"
                                onClick={() => { void changeStatus(invoice, 'DRAFT'); }}
                                disabled={pendingInvoiceId === invoice.id}
                                className="rounded p-1 text-ink-3 hover:text-ink disabled:opacity-50 cursor-pointer"
                                title="Reopen as draft"
                              >
                                <RotateCcw className="w-3.5 h-3.5" />
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Invoice detail */}
        {selectedInvoice && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm animate-in fade-in">
            <div className="bg-paper border border-rule rounded-3xl shadow-2xl max-w-lg w-full overflow-hidden animate-in zoom-in-95">
              <div className="px-6 py-5 border-b border-rule flex items-center justify-between bg-paper-2">
                <div className="flex items-center gap-2.5">
                  <div className="w-9 h-9 rounded-2xl bg-solid text-white flex items-center justify-center">
                    <CreditCard size={18} />
                  </div>
                  <div>
                    <h3 className="font-bold text-ink text-base">Invoice {selectedInvoice.id.slice(0, 18)}</h3>
                    <p className="text-[11px] text-ink-2">
                      {selectedInvoice.date} · {selectedInvoice.time} · {selectedInvoice.visitType}
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setSelectedInvoice(null)}
                  className="w-8 h-8 rounded-full hover:bg-paper-2 text-ink-2 flex items-center justify-center transition-colors cursor-pointer"
                  aria-label="Close invoice"
                >
                  <X size={16} />
                </button>
              </div>

              <div className="p-6 space-y-4 text-xs">
                <div className="p-3.5 bg-canvas border border-rule rounded-2xl flex items-center justify-between">
                  <div>
                    <span className="text-[10px] uppercase font-bold text-ink-3">Patient</span>
                    <h4 className="font-bold text-sm text-ink">{selectedInvoice.patientName}</h4>
                    <span className="text-[11px] text-ink-2">
                      {selectedInvoice.mrn || 'MRN not recorded'} · Payer: {selectedInvoice.payer}
                    </span>
                  </div>
                  <div className="text-right">
                    <span className="text-[10px] uppercase font-bold text-ink-3">Status</span>
                    <div>
                      <span className={`inline-block px-2.5 py-0.5 rounded-full text-[11px] font-bold ${STATUS_META[selectedInvoice.status].badge}`}>
                        {STATUS_META[selectedInvoice.status].label}
                      </span>
                    </div>
                  </div>
                </div>

                <div className="space-y-1.5">
                  <span className="text-[10px] uppercase font-bold tracking-wider text-ink-3">Coding attribution</span>
                  <div className="p-3 bg-paper border border-rule rounded-xl space-y-2">
                    <div className="flex items-center justify-between gap-3">
                      <span className="font-semibold text-ink">CPT</span>
                      <span className="font-mono text-ink bg-paper-2 px-2 py-0.5 rounded text-[11px] font-bold">
                        {selectedInvoice.cptCode}
                      </span>
                    </div>
                    <div className="flex items-center justify-between gap-3">
                      <span className="font-semibold text-ink">Description</span>
                      <span className="text-right text-ink-2">{selectedInvoice.cptDescription}</span>
                    </div>
                    <div className="flex items-center justify-between gap-3">
                      <span className="font-semibold text-ink">ICD-10</span>
                      <span className="truncate font-mono text-ink-2">{selectedInvoice.icd10}</span>
                    </div>
                    <div className="flex items-center justify-between gap-3">
                      <span className="font-semibold text-ink">Signed note</span>
                      <span className={`font-mono text-[11px] ${selectedInvoice.noteId ? 'text-settled' : 'text-caution'}`}>
                        {selectedInvoice.noteId ? `attached · ${selectedInvoice.noteId.slice(0, 16)}` : 'none'}
                      </span>
                    </div>
                  </div>
                </div>

                <div className="space-y-1.5">
                  <span className="text-[10px] uppercase font-bold tracking-wider text-ink-3">Fee breakdown</span>
                  <div className="border border-rule rounded-xl divide-y divide-rule">
                    <div className="p-2.5 flex items-center justify-between">
                      <span className="text-ink-2">Total professional charge</span>
                      <span className="font-mono font-semibold text-ink">{formatCurrency(selectedInvoice.amountCents)}</span>
                    </div>
                    <div className="p-2.5 flex items-center justify-between">
                      <span className="text-ink-2">Estimated insurance payment (80%)</span>
                      <span className="font-mono font-semibold text-ink">{formatCurrency(selectedInvoice.insuranceEstimateCents)}</span>
                    </div>
                    <div className="p-2.5 flex items-center justify-between">
                      <span className="text-ink-2">Estimated patient responsibility</span>
                      <span className="font-mono font-semibold text-ink">{formatCurrency(selectedInvoice.patientResponsibilityCents)}</span>
                    </div>
                    <div className="p-2.5 bg-paper-2 flex items-center justify-between font-bold">
                      <span className="text-ink">Total billed</span>
                      <span className="font-mono text-base text-ink">{formatCurrency(selectedInvoice.amountCents)}</span>
                    </div>
                  </div>
                </div>

                <div className="pt-3 border-t border-rule space-y-3">
                  <div className="flex flex-wrap items-center gap-2">
                    {selectedInvoice.status === 'DRAFT' && (
                      <button
                        type="button"
                        onClick={() => { void changeStatus(selectedInvoice, 'SENT'); }}
                        disabled={pendingInvoiceId === selectedInvoice.id}
                        className="inline-flex items-center gap-1.5 rounded-full bg-solid px-3.5 py-1.5 font-semibold text-white transition-colors hover:bg-solid disabled:opacity-60 cursor-pointer"
                      >
                        {pendingInvoiceId === selectedInvoice.id
                          ? <LoaderCircle size={13} className="animate-spin" />
                          : <Send size={13} />}
                        Send to payer
                      </button>
                    )}
                    {selectedInvoice.status === 'SENT' && (
                      <button
                        type="button"
                        onClick={() => { void changeStatus(selectedInvoice, 'PAID'); }}
                        disabled={pendingInvoiceId === selectedInvoice.id}
                        className="inline-flex items-center gap-1.5 rounded-full bg-settled px-3.5 py-1.5 font-semibold text-white transition-colors hover:bg-solid disabled:opacity-60 cursor-pointer"
                      >
                        {pendingInvoiceId === selectedInvoice.id
                          ? <LoaderCircle size={13} className="animate-spin" />
                          : <CheckCircle2 size={13} />}
                        Mark paid
                      </button>
                    )}
                    {(selectedInvoice.status === 'PAID' || selectedInvoice.status === 'VOID') && (
                      <button
                        type="button"
                        onClick={() => { void changeStatus(selectedInvoice, 'DRAFT'); }}
                        disabled={pendingInvoiceId === selectedInvoice.id}
                        className="inline-flex items-center gap-1.5 rounded-full bg-solid px-3.5 py-1.5 font-semibold text-white transition-colors hover:bg-solid disabled:opacity-60 cursor-pointer"
                      >
                        <RotateCcw size={13} />
                        Reopen as draft
                      </button>
                    )}
                    {selectedInvoice.status !== 'VOID' && selectedInvoice.status !== 'PAID' && (
                      <button
                        type="button"
                        onClick={() => { void changeStatus(selectedInvoice, 'VOID'); }}
                        disabled={pendingInvoiceId === selectedInvoice.id}
                        className="inline-flex items-center gap-1.5 rounded-full border border-rule px-3.5 py-1.5 font-semibold text-ink-2 transition-colors hover:bg-canvas disabled:opacity-60 cursor-pointer"
                      >
                        <Ban size={13} />
                        Void
                      </button>
                    )}
                  </div>

                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-1.5 text-[11px] text-ink-2">
                      <ShieldCheck size={14} className="text-settled" />
                      <span>Status changes are written to the audit chain</span>
                    </div>

                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => window.print()}
                        className="px-3.5 py-1.5 rounded-full border border-rule text-ink hover:bg-canvas font-semibold flex items-center gap-1.5 transition-colors cursor-pointer"
                      >
                        <Printer size={13} />
                        <span>Print</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          downloadInvoiceCsv(selectedInvoice);
                          showToast(`Invoice ${selectedInvoice.cptCode} exported as CSV.`);
                        }}
                        className="px-4 py-1.5 rounded-full bg-solid hover:bg-solid text-white font-semibold flex items-center gap-1.5 transition-colors cursor-pointer shadow-xs"
                      >
                        <Download size={13} />
                        <span>Export CSV</span>
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </Layout>
  );
}
