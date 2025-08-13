import React from 'react';
import { Button } from './ui';

interface MainPageProps {
  onNavigate: (page: 'main' | 'recorder' | 'dashboard') => void;
}

export const MainPage: React.FC<MainPageProps> = ({ onNavigate }) => {
  const currentDate = new Date().toLocaleDateString('en-US', {
    weekday: 'long', year: 'numeric', month: 'long', day: 'numeric'
  });

  return (
    <div className="max-w-4xl mx-auto p-4 sm:p-6 lg:p-8 font-sans min-h-screen flex flex-col justify-center">
      <header className="text-center mb-16">
        <h1 className="text-5xl font-extrabold tracking-tight text-slate-100 sm:text-6xl mb-4">
          Soup Kitchen
        </h1>
        <h2 className="text-3xl font-bold text-amber-500 sm:text-4xl mb-6">
          Inventory System
        </h2>
        <p className="mt-3 text-xl text-slate-300 max-w-3xl mx-auto leading-relaxed">
          Intelligently track and manage your food donations with ease. 
          Record new inventory or view your comprehensive dashboard.
        </p>
        <div className="mt-6 h-1 w-32 bg-amber-500 mx-auto rounded-full" />
      </header>

      <div className="text-center text-slate-400 mb-12 font-medium text-lg">
        {currentDate}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-8 max-w-2xl mx-auto">
        {/* Inventory Recorder Card */}
        <div className="bg-slate-800 p-8 rounded-2xl shadow-xl border border-slate-700 hover:shadow-2xl transition-all duration-300 hover:border-amber-500/30">
          <div className="text-center mb-6">
            <div className="w-16 h-16 bg-amber-600 rounded-full flex items-center justify-center mx-auto mb-4">
              <svg className="w-8 h-8 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
              </svg>
            </div>
            <h3 className="text-2xl font-bold text-slate-100 mb-3">Record Inventory</h3>
            <p className="text-slate-400 leading-relaxed">
              Add new donations using smart barcode scanning, photo analysis, or voice descriptions.
            </p>
          </div>
          <Button 
            onClick={() => onNavigate('recorder')} 
            variant="primary" 
            className="w-full text-lg py-4 font-bold"
          >
            Go To Inventory Recorder
          </Button>
        </div>

        {/* Dashboard Card */}
        <div className="bg-slate-800 p-8 rounded-2xl shadow-xl border border-slate-700 hover:shadow-2xl transition-all duration-300 hover:border-amber-500/30">
          <div className="text-center mb-6">
            <div className="w-16 h-16 bg-blue-600 rounded-full flex items-center justify-center mx-auto mb-4">
              <svg className="w-8 h-8 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
              </svg>
            </div>
            <h3 className="text-2xl font-bold text-slate-100 mb-3">View Dashboard</h3>
            <p className="text-slate-400 leading-relaxed">
              View all recorded inventory, filter by date ranges, and export data to CSV.
            </p>
          </div>
          <Button 
            onClick={() => onNavigate('dashboard')} 
            variant="secondary" 
            className="w-full text-lg py-4 font-bold"
          >
            Go To Dashboard
          </Button>
        </div>
      </div>

      <footer className="text-center mt-16 text-slate-500">
        <p className="text-sm">
          Powered by AI • Built for Community Impact
        </p>
      </footer>
    </div>
  );
};
