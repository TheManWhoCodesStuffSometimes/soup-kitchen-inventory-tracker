
import React from 'react';
import { Summary as SummaryType } from '../types';

interface SummaryProps {
  summary: SummaryType;
}

export const Summary: React.FC<SummaryProps> = ({ summary }) => {
  return (
    <div className="bg-slate-800 p-6 rounded-xl shadow-md border border-slate-700">
      <h3 className="text-lg font-bold text-slate-100 mb-6 text-left border-b border-slate-700 pb-4">
        Entry Summary
      </h3>
      <div className="space-y-6">
        <div className="text-center">
          <label className="block text-sm font-medium text-slate-400 mb-1">Total Individual Items</label>
          <div className="text-5xl font-extrabold text-amber-500">
            {summary.totalItems}
          </div>
        </div>
        <div className="text-center">
          <label className="block text-sm font-medium text-slate-400 mb-1">Total Weight (lbs)</label>
          <div className="text-5xl font-extrabold text-amber-500">
            {summary.totalWeightLbs.toFixed(2)}
          </div>
        </div>
      </div>
    </div>
  );
};