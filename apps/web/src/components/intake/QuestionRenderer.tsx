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
        <label className="block text-base font-semibold text-ink mb-1">
          {item.text}
          {item.required && <span className="text-critical ml-1 font-bold">*</span>}
        </label>
        <p className="text-xs text-ink-2">
          {item.type === 'choice' && 'Select the best matching clinical option.'}
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
                    ? 'bg-accent/10 border-accent text-accent-ink ring-1 ring-accent'
                    : 'bg-paper border-rule text-ink hover:border-rule-strong hover:bg-paper-2'
                }`}
              >
                <span className="text-sm font-medium leading-snug">{display}</span>
                {isSelected && (
                  <div className="h-5 w-5 rounded-full bg-accent text-white flex items-center justify-center shrink-0 mt-0.5">
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
            className={`py-3 px-5 rounded-xl border font-semibold text-sm flex items-center justify-center gap-2 transition-all cursor-pointer ${
              value === true
                ? 'bg-accent text-white border-accent shadow-xs'
                : 'bg-paper border-rule text-ink hover:bg-paper-2 hover:border-rule-strong'
            }`}
          >
            {value === true && <Check size={16} strokeWidth={3} />}
            Yes
          </button>
          <button
            type="button"
            onClick={() => onChange(false)}
            className={`py-3 px-5 rounded-xl border font-semibold text-sm flex items-center justify-center gap-2 transition-all cursor-pointer ${
              value === false
                ? 'bg-accent text-white border-accent shadow-xs'
                : 'bg-paper border-rule text-ink hover:bg-paper-2 hover:border-rule-strong'
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
                  className={`py-2.5 rounded-xl border font-mono text-sm font-semibold transition-all cursor-pointer ${
                    isSelected
                      ? 'bg-accent border-accent text-white shadow-xs scale-105'
                      : num >= 8
                      ? 'bg-critical-wash/60 border-critical-line text-critical hover:border-critical'
                      : 'bg-paper border-rule text-ink hover:border-rule-strong hover:bg-paper-2'
                  }`}
                >
                  {num}
                </button>
              );
            })}
          </div>
          <div className="flex justify-between text-xs text-ink-2 px-1 font-medium">
            <span>1 = Very Mild</span>
            <span>5 = Moderate</span>
            <span className="text-critical font-semibold">10 = Severe / Worst</span>
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
              className="w-full bg-paper border border-rule rounded-xl px-4 py-2.5 text-sm text-ink placeholder-ink-3 focus:outline-hidden focus:border-accent focus:ring-1 focus:ring-accent"
            />
          ) : (
            <input
              type="text"
              value={value || ''}
              onChange={e => onChange(e.target.value)}
              placeholder="Type your response here..."
              className="w-full bg-paper border border-rule rounded-xl px-4 py-2.5 text-sm text-ink placeholder-ink-3 focus:outline-hidden focus:border-accent focus:ring-1 focus:ring-accent"
            />
          )}
        </div>
      )}

      {error && (
        <div className="p-3 bg-critical-wash border border-critical-line rounded-xl text-xs text-critical">
          {error}
        </div>
      )}
    </div>
  );
};

export default QuestionRenderer;
