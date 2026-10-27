import { useState } from 'react';
import { 
  FileText, CheckCircle2, Check, Layers
} from 'lucide-react';

interface BoundingBox {
  x: number;
  y: number;
  width: number;
  height: number;
  page: number;
}

interface LabObservation {
  key: string;
  name: string;
  loinc: string;
  value: number;
  unit: string;
  referenceRange: string;
  flag: 'NORMAL' | 'HIGH' | 'CRITICAL_HIGH' | 'LOW';
  confidence: number;
  boundingBox: BoundingBox;
}

export default function TesseractLabStudio({
  patientId: _patientId = 'Patient/synthetic-001',
  onClose
}: {
  patientId?: string;
  onClose?: () => void;
}) {
  const [selectedObsKey, setSelectedObsKey] = useState<string>('hba1c');
  const [isCommitted, setIsCommitted] = useState(false);

  const observations: LabObservation[] = [
    {
      key: 'glucose',
      name: 'Fasting Blood Glucose',
      loinc: '2345-7',
      value: 142,
      unit: 'mg/dL',
      referenceRange: '70 - 99 mg/dL',
      flag: 'HIGH',
      confidence: 0.98,
      boundingBox: { x: 8.5, y: 22.0, width: 83.0, height: 4.2, page: 1 }
    },
    {
      key: 'hba1c',
      name: 'Hemoglobin A1c',
      loinc: '4544-3',
      value: 8.2,
      unit: '%',
      referenceRange: '4.0 - 5.6 %',
      flag: 'CRITICAL_HIGH',
      confidence: 0.99,
      boundingBox: { x: 8.5, y: 28.5, width: 83.0, height: 4.2, page: 1 }
    },
    {
      key: 'creatinine',
      name: 'Serum Creatinine',
      loinc: '2160-0',
      value: 1.15,
      unit: 'mg/dL',
      referenceRange: '0.70 - 1.30 mg/dL',
      flag: 'NORMAL',
      confidence: 0.97,
      boundingBox: { x: 8.5, y: 35.0, width: 83.0, height: 4.2, page: 1 }
    },
    {
      key: 'egfr',
      name: 'eGFR non-African Amer',
      loinc: '33914-3',
      value: 68,
      unit: 'mL/min/1.73m2',
      referenceRange: '> 60 mL/min/1.73m2',
      flag: 'NORMAL',
      confidence: 0.95,
      boundingBox: { x: 8.5, y: 41.5, width: 83.0, height: 4.2, page: 1 }
    },
    {
      key: 'ldl',
      name: 'LDL-Cholesterol Calculated',
      loinc: '13457-7',
      value: 134,
      unit: 'mg/dL',
      referenceRange: '< 100 mg/dL',
      flag: 'HIGH',
      confidence: 0.96,
      boundingBox: { x: 8.5, y: 48.0, width: 83.0, height: 4.2, page: 1 }
    }
  ];

  const activeObs = observations.find(o => o.key === selectedObsKey) || observations[0];

  return (
    <div className="bg-[#FFFFFF] rounded-2xl border border-[#E8E6DF] shadow-xl overflow-hidden flex flex-col h-[750px] max-w-6xl w-full mx-auto">
      {/* Studio Header */}
      <div className="bg-[#151619] text-white px-6 py-3.5 flex items-center justify-between border-b border-[#24272E]">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-emerald-500/20 text-emerald-400 flex items-center justify-center font-bold">
            <Layers className="w-4 h-4" />
          </div>
          <div>
            <h3 className="text-sm font-bold tracking-tight">Tesseract Multi-Zone Lab Studio</h3>
            <p className="text-[11px] text-[#8C92A0]">Optical Bounding Box Inspection • FHIR R4 LOINC Extraction</p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <span className="text-[11px] font-mono bg-[#202228] border border-[#2D313A] px-2.5 py-1 rounded-full text-emerald-400">
            Engine: Tesseract 5.5.0 HOCR/TSV
          </span>
          {onClose && (
            <button
              onClick={onClose}
              className="text-[#8C92A0] hover:text-white text-xs px-2 py-1 cursor-pointer"
            >
              ✕ Close Studio
            </button>
          )}
        </div>
      </div>

      {/* Main Studio Body: Split Document View vs Extraction Table */}
      <div className="flex-1 grid grid-cols-12 gap-0 overflow-hidden">
        
        {/* LEFT: Scanned Document with Interactive SVG Bounding Boxes (Cols 1-7) */}
        <div className="col-span-7 bg-[#F4F3EF] p-6 border-r border-[#E8E6DF] flex flex-col overflow-y-auto">
          <div className="flex items-center justify-between mb-3 text-xs text-[#6A707E]">
            <span className="font-semibold flex items-center gap-1.5">
              <FileText className="w-4 h-4 text-emerald-600" />
              Source Scanned Document (Comprehensive Metabolic Panel)
            </span>
            <span className="text-[11px] font-mono text-[#8C92A0]">Page 1 of 1 • 300 DPI</span>
          </div>

          {/* Interactive Document Sheet Canvas */}
          <div className="relative bg-white rounded-xl shadow-md border border-[#DCD9D0] p-8 aspect-[1/1.3] select-none font-mono text-xs">
            {/* Header of faux lab report */}
            <div className="border-b-2 border-black pb-3 mb-6">
              <div className="text-base font-bold tracking-tight font-sans text-black">METROPOLITAN CLINICAL LABORATORIES</div>
              <div className="text-[10px] text-gray-600 font-sans mt-0.5">100 Hospital Drive, Suite 400 • CLIA # 05D2049182</div>
              <div className="grid grid-cols-2 gap-2 text-[10px] text-gray-800 font-sans mt-2 pt-2 border-t border-gray-200">
                <div>Patient: <strong>Arthur Pendelton</strong> (58M)</div>
                <div>Specimen: Fasting Serum</div>
                <div>MRN: 784920</div>
                <div>Collected: 2026-10-18 08:30 AM</div>
              </div>
            </div>

            {/* Document Lines with Interactive Overlays */}
            <div className="space-y-4 text-[11px] text-gray-800">
              <div className="font-bold border-b border-gray-300 pb-1 text-gray-900 grid grid-cols-12">
                <span className="col-span-5">TEST NAME</span>
                <span className="col-span-3 text-right">RESULT</span>
                <span className="col-span-4 text-right">REF RANGE</span>
              </div>

              {observations.map((obs) => {
                const isSelected = obs.key === selectedObsKey;
                return (
                  <div
                    key={obs.key}
                    onClick={() => setSelectedObsKey(obs.key)}
                    className={`relative grid grid-cols-12 py-1.5 px-2 rounded cursor-pointer transition-all ${
                      isSelected
                        ? 'bg-emerald-500/15 border-2 border-emerald-600 shadow-sm'
                        : 'hover:bg-amber-500/10 border border-transparent'
                    }`}
                  >
                    <span className="col-span-5 font-semibold">{obs.name}</span>
                    <span className={`col-span-3 text-right font-bold ${
                      obs.flag === 'CRITICAL_HIGH' ? 'text-rose-600' : obs.flag === 'HIGH' ? 'text-amber-700' : 'text-gray-900'
                    }`}>
                      {obs.value} {obs.unit}
                    </span>
                    <span className="col-span-4 text-right text-gray-500 text-[10px]">
                      {obs.referenceRange}
                    </span>

                    {/* Coordinate Tag Badge */}
                    {isSelected && (
                      <span className="absolute -top-3 right-2 bg-emerald-600 text-white font-mono text-[9px] px-1.5 py-0.2 rounded shadow">
                        Box [{obs.boundingBox.x}%, {obs.boundingBox.y}%]
                      </span>
                    )}
                  </div>
                );
              })}
            </div>

            {/* Visual Provenance Indicator */}
            <div className="absolute bottom-4 left-8 right-8 pt-3 border-t border-gray-200 flex items-center justify-between text-[10px] text-gray-500">
              <span>Verified by Tesseract Optical Scanner</span>
              <span className="font-bold text-emerald-700">100% Deterministic Extraction</span>
            </div>
          </div>
        </div>

        {/* RIGHT: Structured Observations & FHIR Commit (Cols 8-12) */}
        <div className="col-span-5 bg-white p-6 flex flex-col h-full overflow-y-auto">
          <div className="flex items-center justify-between mb-4">
            <span className="text-xs font-bold uppercase tracking-wider text-[#6A707E]">
              Extracted FHIR Observations
            </span>
            <span className="text-[11px] font-mono text-emerald-700 bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded-full font-bold">
              {observations.length} Observations
            </span>
          </div>

          {/* Active Inspected Observation Card */}
          <div className="p-4 rounded-xl bg-[#F9F8F5] border border-[#E8E6DF] mb-5">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-bold text-[#151619]">{activeObs.name}</span>
              <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                activeObs.flag === 'CRITICAL_HIGH' ? 'bg-rose-100 text-rose-800' :
                activeObs.flag === 'HIGH' ? 'bg-amber-100 text-amber-800' : 'bg-emerald-100 text-emerald-800'
              }`}>
                {activeObs.flag}
              </span>
            </div>
            <div className="text-xl font-bold text-[#151619] mt-1">
              {activeObs.value} <span className="text-xs font-normal text-[#717785]">{activeObs.unit}</span>
            </div>
            <div className="text-xs text-[#525763] mt-2 space-y-1">
              <div>LOINC Code: <strong className="font-mono text-[#151619]">{activeObs.loinc}</strong></div>
              <div>Reference Range: <span>{activeObs.referenceRange}</span></div>
              <div>OCR Confidence: <strong className="text-emerald-700 font-mono">{(activeObs.confidence * 100).toFixed(1)}%</strong></div>
            </div>
          </div>

          {/* Observations Table */}
          <div className="space-y-2 flex-1">
            <div className="text-[11px] font-bold uppercase tracking-wider text-[#8C92A0] mb-1">Select to Inspect Bounding Box</div>
            {observations.map((obs) => {
              const isSelected = obs.key === selectedObsKey;
              return (
                <div
                  key={obs.key}
                  onClick={() => setSelectedObsKey(obs.key)}
                  className={`p-3 rounded-xl border text-xs cursor-pointer transition-all flex items-center justify-between ${
                    isSelected
                      ? 'bg-emerald-50/60 border-emerald-400 shadow-2xs'
                      : 'bg-white border-[#E8E6DF] hover:border-gray-400'
                  }`}
                >
                  <div>
                    <div className="font-bold text-[#151619]">{obs.name}</div>
                    <div className="text-[11px] text-[#717785] font-mono mt-0.5">LOINC {obs.loinc}</div>
                  </div>
                  <div className="text-right">
                    <div className="font-bold text-[#151619]">{obs.value} {obs.unit}</div>
                    <div className={`text-[10px] font-bold ${
                      obs.flag === 'CRITICAL_HIGH' ? 'text-rose-600' : obs.flag === 'HIGH' ? 'text-amber-700' : 'text-emerald-700'
                    }`}>
                      {obs.flag}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          {/* 1-Click Commit to FHIR */}
          <div className="pt-4 border-t border-[#E8E6DF] mt-4">
            {isCommitted ? (
              <div className="p-3 bg-emerald-50 border border-emerald-300 rounded-xl text-center">
                <div className="flex items-center justify-center gap-1.5 text-emerald-800 text-xs font-bold">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                  PERSISTED TO MEDPLUM FHIR STORE
                </div>
                <div className="text-[11px] text-emerald-700 mt-1 font-mono">
                  Bundle: 5 Observations Created
                </div>
              </div>
            ) : (
              <button
                onClick={() => setIsCommitted(true)}
                className="w-full py-3 bg-[#151619] hover:bg-[#2A2E38] text-white font-bold text-xs rounded-xl shadow-md transition-all flex items-center justify-center gap-2 cursor-pointer"
              >
                <Check className="w-3.5 h-3.5 text-emerald-400" />
                Commit Extracted Observations to FHIR
              </button>
            )}
          </div>
        </div>

      </div>
    </div>
  );
}
