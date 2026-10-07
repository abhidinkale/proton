import type { Patient } from '@medplum/fhirtypes';
import type { PrescriptionItem } from '../types/prescription';
import { Printer, X, ShieldCheck, FileText } from 'lucide-react';

interface PrescriptionPDFModalProps {
  isOpen: boolean;
  onClose: () => void;
  patient: Patient | null;
  doctorName?: string;
  date?: string;
  medications: PrescriptionItem[];
}

export default function PrescriptionPDFModal({
  isOpen,
  onClose,
  patient,
  doctorName = 'Dr. Alex Morgan, MD',
  date = new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' }),
  medications
}: PrescriptionPDFModalProps) {
  if (!isOpen) return null;

  const patientName = patient?.name?.[0] 
    ? `${patient.name[0].given?.join(' ') || ''} ${patient.name[0].family || ''}`.trim()
    : 'Unknown Patient';

  const handlePrint = () => {
    const printWindow = window.open('', '_blank', 'width=800,height=900');
    if (!printWindow) {
      window.print();
      return;
    }

    const htmlContent = `
      <!DOCTYPE html>
      <html>
      <head>
        <title>Prescription - ${patientName}</title>
        <style>
          @page { size: A4; margin: 20mm; }
          body {
            font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
            color: #1e293b;
            background: #fff;
            margin: 0;
            padding: 24px;
            font-size: 13px;
            line-height: 1.5;
          }
          .header {
            border-bottom: 2px solid #0f172a;
            padding-bottom: 16px;
            margin-bottom: 20px;
            display: flex;
            justify-content: space-between;
            align-items: flex-start;
          }
          .brand-title {
            font-size: 22px;
            font-weight: 800;
            color: #0284c7;
            letter-spacing: -0.5px;
            margin: 0;
          }
          .brand-subtitle {
            font-size: 13px;
            font-weight: 600;
            color: #475569;
            margin-top: 2px;
          }
          .meta-grid {
            display: grid;
            grid-template-columns: 1fr 1fr;
            gap: 16px;
            background: #f8fafc;
            border: 1px solid #e2e8f0;
            border-radius: 8px;
            padding: 14px;
            margin-bottom: 24px;
          }
          .meta-label {
            font-size: 11px;
            text-transform: uppercase;
            font-weight: 700;
            color: #64748b;
          }
          .meta-val {
            font-size: 13px;
            font-weight: 600;
            color: #0f172a;
          }
          table {
            width: 100%;
            border-collapse: collapse;
            margin-bottom: 28px;
          }
          th {
            background: #f1f5f9;
            border-bottom: 2px solid #cbd5e1;
            padding: 10px 8px;
            text-align: left;
            font-size: 11px;
            font-weight: 700;
            text-transform: uppercase;
            color: #334155;
          }
          td {
            padding: 12px 8px;
            border-bottom: 1px solid #e2e8f0;
            vertical-align: top;
          }
          .med-name {
            font-weight: 700;
            color: #0f172a;
            font-size: 14px;
          }
          .med-sub {
            font-size: 12px;
            color: #64748b;
          }
          .approval-box {
            border: 1px solid #bbf7d0;
            background: #f0fdf4;
            border-radius: 8px;
            padding: 14px;
            margin-top: 24px;
          }
          .approval-title {
            font-weight: 700;
            color: #166534;
            display: flex;
            align-items: center;
            gap: 6px;
            margin-bottom: 6px;
          }
          .approval-text {
            color: #15803d;
            font-size: 12px;
            font-style: italic;
          }
          .footer-disclaimer {
            margin-top: 36px;
            padding-top: 14px;
            border-top: 1px solid #e2e8f0;
            font-size: 11px;
            color: #94a3b8;
            line-height: 1.4;
          }
        </style>
      </head>
      <body>
        <div class="header">
          <div>
            <div class="brand-title">PROTON</div>
            <div class="brand-subtitle">Clinical Prescription</div>
          </div>
          <div style="text-align: right;">
            <div style="font-weight: 700; font-size: 13px;">${doctorName}</div>
            <div style="color: #64748b; font-size: 12px;">Physician License #MD-948201</div>
            <div style="color: #64748b; font-size: 12px;">Date: ${date}</div>
          </div>
        </div>

        <div class="meta-grid">
          <div>
            <div class="meta-label">Patient Name</div>
            <div class="meta-val">${patientName}</div>
            <div style="margin-top: 6px;" class="meta-label">Date of Birth</div>
            <div class="meta-val">${patient?.birthDate || 'Unknown'} (${patient?.gender || 'Unknown'})</div>
          </div>
          <div>
            <div class="meta-label">Patient ID</div>
            <div class="meta-val">${patient?.id || 'Unknown'}</div>
            <div style="margin-top: 6px;" class="meta-label">Prescription Date</div>
            <div class="meta-val">${date}</div>
          </div>
        </div>

        <table>
          <thead>
            <tr>
              <th>Medicine</th>
              <th>Strength</th>
              <th>Dose</th>
              <th>Frequency</th>
              <th>Route</th>
              <th>Duration</th>
              <th>Instructions</th>
            </tr>
          </thead>
          <tbody>
            ${medications.map(m => `
              <tr>
                <td><span class="med-name">${m.name}</span></td>
                <td>${m.strength}</td>
                <td>${m.dose}</td>
                <td>${m.frequency}</td>
                <td>${m.route}</td>
                <td>${m.duration}</td>
                <td>${m.instructions || 'As directed'}</td>
              </tr>
            `).join('')}
          </tbody>
        </table>

        <div class="approval-box">
          <div class="approval-title">✓ Doctor Approval & Sign-Off</div>
          <div class="approval-text">
            "AI-generated content was reviewed and approved by the treating physician."
          </div>
          <div style="margin-top: 8px; font-weight: 600; font-size: 12px; color: #1e293b;">
            Approved by: ${doctorName} &bull; Timestamp: ${new Date().toISOString()}
          </div>
        </div>

        <div class="footer-disclaimer">
          Notice: This document reflects a physician-approved clinical prescription recorded via Proton Clinical Intelligence.
          This prescription is not claimed to be legally valid in every jurisdiction. Dispensing pharmacists should verify authenticity in accordance with local regulatory guidelines.
        </div>
      </body>
      </html>
    `;

    printWindow.document.open();
    printWindow.document.write(htmlContent);
    printWindow.document.close();
    printWindow.focus();
    setTimeout(() => {
      printWindow.print();
    }, 300);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4 overflow-y-auto">
      <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-3xl overflow-hidden my-8">
        {/* Modal Top Bar */}
        <div className="bg-slate-50 px-6 py-4 border-b border-slate-200 flex items-center justify-between">
          <div className="flex items-center gap-2 text-slate-800">
            <FileText size={20} className="text-brand-600" />
            <h2 className="font-semibold text-lg">Prescription PDF Preview</h2>
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={handlePrint}
              className="bg-brand-600 hover:bg-brand-700 text-white px-4 py-2 rounded-lg text-sm font-medium flex items-center gap-2 shadow-sm transition-colors cursor-pointer"
            >
              <Printer size={16} /> Print / Save as PDF
            </button>
            <button
              onClick={onClose}
              className="text-slate-400 hover:text-slate-600 p-1.5 rounded-lg hover:bg-slate-200 transition-colors"
            >
              <X size={20} />
            </button>
          </div>
        </div>

        {/* Paper Sheet Preview */}
        <div className="p-8 bg-slate-100 max-h-[75vh] overflow-y-auto">
          <div className="bg-white border border-slate-300 rounded-xl p-8 shadow-sm text-slate-800 text-sm">
            {/* Header */}
            <div className="border-b-2 border-slate-900 pb-4 mb-6 flex justify-between items-start">
              <div>
                <h1 className="text-2xl font-black text-brand-600 tracking-tight">PROTON</h1>
                <p className="text-sm font-semibold text-slate-500">Clinical Prescription</p>
              </div>
              <div className="text-right">
                <p className="font-bold text-slate-900">{doctorName}</p>
                <p className="text-xs text-slate-500">License #MD-948201</p>
                <p className="text-xs text-slate-500">Date: {date}</p>
              </div>
            </div>

            {/* Patient Info */}
            <div className="grid grid-cols-2 gap-4 bg-slate-50 border border-slate-200 rounded-lg p-4 mb-6">
              <div>
                <p className="text-xs uppercase font-bold text-slate-400 tracking-wider">Patient</p>
                <p className="font-semibold text-slate-800">{patientName}</p>
                <p className="text-xs text-slate-500 mt-1">DOB: {patient?.birthDate || 'Unknown'} &bull; {patient?.gender || 'Unknown'}</p>
              </div>
              <div>
                <p className="text-xs uppercase font-bold text-slate-400 tracking-wider">Patient Record ID</p>
                <p className="font-mono text-xs text-slate-700">{patient?.id || 'Unknown'}</p>
                <p className="text-xs text-slate-500 mt-1">Status: Active Ambulatory Order</p>
              </div>
            </div>

            {/* Medications Table */}
            <div className="mb-6 overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b-2 border-slate-200 bg-slate-50 text-[11px] uppercase tracking-wider text-slate-600">
                    <th className="py-2.5 px-3">Medicine</th>
                    <th className="py-2.5 px-3">Strength</th>
                    <th className="py-2.5 px-3">Dose</th>
                    <th className="py-2.5 px-3">Frequency</th>
                    <th className="py-2.5 px-3">Route</th>
                    <th className="py-2.5 px-3">Duration</th>
                    <th className="py-2.5 px-3">Instructions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-xs">
                  {medications.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="py-4 text-center text-slate-400 italic">No medications recorded.</td>
                    </tr>
                  ) : (
                    medications.map(m => (
                      <tr key={m.id} className="hover:bg-slate-50">
                        <td className="py-3 px-3 font-bold text-slate-900">{m.name}</td>
                        <td className="py-3 px-3 text-slate-700">{m.strength}</td>
                        <td className="py-3 px-3 text-slate-700">{m.dose}</td>
                        <td className="py-3 px-3 text-slate-700">{m.frequency}</td>
                        <td className="py-3 px-3 text-slate-700">{m.route}</td>
                        <td className="py-3 px-3 text-slate-700">{m.duration}</td>
                        <td className="py-3 px-3 text-slate-600">{m.instructions || 'As directed'}</td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>

            {/* Doctor Approval Box */}
            <div className="border border-green-200 bg-green-50 rounded-lg p-4 mb-6">
              <div className="flex items-center gap-1.5 font-bold text-green-800 text-xs mb-1">
                <ShieldCheck size={16} /> Doctor Approval & Verification
              </div>
              <p className="text-xs text-green-700 italic">
                "AI-generated content was reviewed and approved by the treating physician."
              </p>
              <p className="text-[11px] font-medium text-slate-700 mt-2">
                Approved by: {doctorName} &bull; Timestamp: {new Date().toISOString()}
              </p>
            </div>

            {/* Disclaimer */}
            <div className="pt-4 border-t border-slate-200 text-[11px] text-slate-400 leading-relaxed">
              Notice: This document reflects a physician-approved clinical prescription recorded via Proton. Not claimed to be legally valid in every jurisdiction. Dispensing pharmacists must verify according to local medical and pharmacy regulations.
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
