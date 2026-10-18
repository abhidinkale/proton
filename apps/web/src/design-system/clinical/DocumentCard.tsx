import { forwardRef } from 'react';
import { FileText, Eye, Download, ShieldCheck, Clock } from 'lucide-react';

export interface DocumentCardProps {
  title: string;
  category: 'clinical_note' | 'imaging_report' | 'lab_panel' | 'discharge_summary' | 'consent';
  date: string;
  author?: string;
  fileSize?: string;
  signedOff?: boolean;
  onPreview?: () => void;
  onDownload?: () => void;
  className?: string;
}

export const DocumentCard = forwardRef<HTMLDivElement, DocumentCardProps>(function DocumentCard(
  {
    title,
    category,
    date,
    author,
    fileSize,
    signedOff = true,
    onPreview,
    onDownload,
    className = ''
  },
  ref
) {
  const categoryLabels = {
    clinical_note: 'Clinical Note',
    imaging_report: 'Imaging Report',
    lab_panel: 'Laboratory Panel',
    discharge_summary: 'Discharge Summary',
    consent: 'Patient Consent'
  };

  return (
    <div
      ref={ref}
      className={`p-4 rounded-2xl bg-white border border-[#E8E5DC] shadow-2xs hover:border-[#D5D2C9] transition-all flex flex-col justify-between ${className}`}
    >
      <div>
        <div className="flex items-start justify-between gap-2">
          <div className="w-8 h-8 rounded-xl bg-[#FAF9F6] border border-[#E8E5DC] flex items-center justify-center text-[#151719] shrink-0">
            <FileText size={16} />
          </div>

          <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold border ${
            signedOff
              ? 'bg-[#ECFDF5] text-[#065F46] border-[#A7F3D0]'
              : 'bg-[#FEF08A] text-[#854D0E] border-[#FDE047]'
          }`}>
            {signedOff ? <ShieldCheck size={11} /> : <Clock size={11} />}
            <span>{signedOff ? 'Signed' : 'Awaiting Sign'}</span>
          </span>
        </div>

        <div className="mt-3">
          <h4 className="text-xs font-bold text-[#151719] leading-snug line-clamp-2">{title}</h4>
          <p className="text-[10px] text-[#88909A] mt-1 font-mono uppercase tracking-wider">
            {categoryLabels[category]} • {date}
          </p>
          {author && <p className="text-[11px] text-[#575D65] mt-0.5">Author: {author}</p>}
        </div>
      </div>

      <div className="mt-4 pt-3 border-t border-[#F0ECE1] flex items-center justify-between text-xs">
        {fileSize && <span className="text-[10px] font-mono text-[#88909A]">{fileSize}</span>}

        <div className="flex items-center gap-2 ml-auto">
          {onPreview && (
            <button
              type="button"
              onClick={onPreview}
              className="inline-flex items-center gap-1 text-[11px] font-semibold text-[#151719] hover:underline cursor-pointer"
            >
              <Eye size={12} />
              <span>Preview</span>
            </button>
          )}

          {onDownload && (
            <button
              type="button"
              onClick={onDownload}
              className="p-1 rounded-full text-[#575D65] hover:text-[#151719] hover:bg-[#F9F8F5] cursor-pointer"
              title="Download document"
            >
              <Download size={13} />
            </button>
          )}
        </div>
      </div>
    </div>
  );
});

export default DocumentCard;
