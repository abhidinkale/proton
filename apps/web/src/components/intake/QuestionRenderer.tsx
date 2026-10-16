import React from 'react';
import type { QuestionnaireItem } from '../../types/intake';
import { Check } from 'lucide-react';

interface QuestionRendererProps {
  item: QuestionnaireItem;
  value: any;
  onChange: (val: any) => void;
  error?: string;
}

export const QuestionRenderer: React.FC<QuestionRendererProps> = ({
  item,
  value,
  onChange,
  error
}) => {
  return (
    <div className="space-y-4">
      <div>
        <label className="block text-base font-medium text-slate-100 mb-1">
          {item.text}
          {item.required && <span className="text-red-400 ml-1 font-semibold">*</span>}
        </label>
        <p className="text-xs text-slate-400">
          {item.type === 'choice' && 'Select the best matching option.'}
          {item.type === 'boolean' && 'Select Yes or No.'}
          {item.type === 'integer' && 'Select an integer intensity rating.'}
          {item.type === 'text' && 'Type your description in the box below.'}
        </p>
      </div>

      {/* 1. Choice Options */}
      {item.type === 'choice' && item.answerOption && (
        <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2">
          {item.answerOption.map((opt, idx) => {
            const code = opt.valueCoding?.code || opt.valueString || opt.code || `opt-${idx}`;
            const display = opt.valueCoding?.display || opt.valueString || opt.display || code;
            const isSelected = value === code;

            return (
              <button
                key={code}
                type="button"
                onClick={() => onChange(code)}
                className={`p-3.5 rounded-xl border text-left flex items-start justify-between gap-3 transition-all cursor-pointer ${
                  isSelected
                    ? 'bg-sky-500/15 border-sky-400 text-white ring-1 ring-sky-400'
                    : 'bg-[#151c2c] border-slate-700/80 text-slate-300 hover:border-slate-500 hover:bg-[#1a2336]'
                }`}
              >
                <span className="text-sm font-medium leading-snug">{display}</span>
                {isSelected && (
                  <div className="h-5 w-5 rounded-full bg-sky-500 text-slate-950 flex items-center justify-center shrink-0 mt-0.5">
                    <Check size={13} strokeWidth={3} />
                  </div>
                )}
              </button>
            );
          })}
        </div>
      )}

      {/* 2. Boolean Options */}
      {item.type === 'boolean' && (
        <div className="grid grid-cols-2 gap-3 max-w-sm">
          <button
            type="button"
            onClick={() => onChange(true)}
            className={`py-3 px-5 rounded-xl border font-medium text-sm flex items-center justify-center gap-2 transition-all cursor-pointer ${
              value === true
                ? 'bg-sky-500 text-slate-950 border-sky-400 shadow-md font-semibold'
                : 'bg-[#151c2c] border-slate-700 text-slate-300 hover:bg-[#1a2336] hover:border-slate-500'
            }`}
          >
            {value === true && <Check size={16} strokeWidth={3} />}
            Yes
          </button>
          <button
            type="button"
            onClick={() => onChange(false)}
            className={`py-3 px-5 rounded-xl border font-medium text-sm flex items-center justify-center gap-2 transition-all cursor-pointer ${
              value === false
                ? 'bg-sky-500 text-slate-950 border-sky-400 shadow-md font-semibold'
                : 'bg-[#151c2c] border-slate-700 text-slate-300 hover:bg-[#1a2336] hover:border-slate-500'
            }`}
          >
            {value === false && <Check size={16} strokeWidth={3} />}
            No
          </button>
        </div>
      )}

      {/* 3. Integer (e.g. Pain Rating 1-10) */}
      {item.type === 'integer' && (
        <div className="space-y-3">
          <div className="grid grid-cols-5 sm:grid-cols-10 gap-2">
            {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map(num => {
              const isSelected = value === num;
              return (
                <button
                  key={num}
                  type="button"
                  onClick={() => onChange(num)}
                  className={`py-2.5 rounded-lg border font-mono text-sm font-semibold transition-all cursor-pointer ${
                    isSelected
                      ? 'bg-sky-500 border-sky-400 text-slate-950 shadow-md scale-105'
                      : num >= 8
                      ? 'bg-[#1e1520] border-red-900/40 text-red-300 hover:border-red-600'
                      : 'bg-[#151c2c] border-slate-700 text-slate-300 hover:border-slate-500'
                  }`}
                >
                  {num}
                </button>
              );
            })}
          </div>
          <div className="flex justify-between text-xs text-slate-400 px-1">
            <span>1 = Very Mild</span>
            <span>5 = Moderate</span>
            <span className="text-red-400 font-medium">10 = Severe / Worst</span>
          </div>
        </div>
      )}

      {/* 4. Text / String Input */}
      {(item.type === 'text' || item.type === 'string') && (
        <div>
          {item.type === 'text' ? (
            <textarea
              rows={3}
              value={value || ''}
              onChange={e => onChange(e.target.value)}
              placeholder="Type your response here..."
              className="w-full bg-[#151c2c] border border-slate-700 rounded-xl px-4 py-2.5 text-sm text-slate-100 placeholder-slate-500 focus:outline-none focus:border-sky-400 focus:ring-1 focus:ring-sky-400"
            />
          ) : (
            <input
              type="text"
              value={value || ''}
              onChange={e => onChange(e.target.value)}
              placeholder="Type your response here..."
              className="w-full bg-[#151c2c] border border-slate-700 rounded-xl px-4 py-2.5 text-sm text-slate-100 placeholder-slate-500 focus:outline-none focus:border-sky-400 focus:ring-1 focus:ring-sky-400"
            />
          )}
        </div>
      )}

      {error && (
        <div className="p-2 bg-red-950/40 border border-red-800 rounded-lg text-xs text-red-300">
          {error}
        </div>
      )}
    </div>
  );
};

export default QuestionRenderer;
