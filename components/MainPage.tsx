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
    <div className="min-h-screen bg-slate-900 flex flex-col">
      {/* Mobile-optimized container with proper padding */}
      <div className="flex-1 flex flex-col justify-center px-4 py-8 sm:px-6 lg:px-8">
        <div className="max-w-4xl mx-auto w-full">
          {/* Header - Mobile responsive typography */}
          <header className="text-center mb-8 sm:mb-12 lg:mb-16">
            <h1 className="text-3xl font-extrabold tracking-tight text-slate-100 sm:text-4xl md:text-5xl lg:text-6xl mb-2 sm:mb-4">
              Soup Kitchen
            </h1>
            <h2 className="text-xl font-bold text-amber-500 sm:text-2xl md:text-3xl lg:text-4xl mb-4 sm:mb-6">
              Inventory System
            </h2>
            <p className="mt-3 text-base sm:text-lg md:text-xl text-slate-300 max-w-3xl mx-auto leading-relaxed px-2">
              Intelligently track and manage your food donations with ease. 
              Record new inventory or view your comprehensive dashboard.
            </p>
            <div className="mt-4 sm:mt-6 h-1 w-24 sm:w-32 bg-amber-500 mx-auto rounded-full" />
          </header>

          {/* Date display - Mobile optimized */}
          <div className="text-center text-slate-400 mb-8 sm:mb-12 font-medium text-sm sm:text-base lg:text-lg">
            {currentDate}
          </div>

          {/* Action Cards - Mobile-first grid */}
          <div className="space-y-6 sm:space-y-0 sm:grid sm:grid-cols-1 md:grid-cols-2 sm:gap-6 lg:gap-8 max-w-4xl mx-auto">
            {/* Inventory Recorder Card */}
            <div className="bg-slate-800 p-6 sm:p-8 rounded-2xl shadow-xl border border-slate-700 hover:shadow-2xl transition-all duration-300 hover:border-amber-500/30 touch-manipulation">
              <div className="text-center mb-6">
                <div className="w-12 h-12 sm:w-16 sm:h-16 bg-amber-600 rounded-full flex items-center justify-center mx-auto mb-4">
                  <svg className="w-6 h-6 sm:w-8 sm:h-8 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
                  </svg>
                </div>
                <h3 className="text-xl sm:text-2xl font-bold text-slate-100 mb-3">Record Inventory</h3>
                <p className="text-sm sm:text-base text-slate-400 leading-relaxed">
                  Add new donations using smart barcode scanning, photo analysis, or voice descriptions.
                </p>
              </div>
              <Button 
                onClick={() => onNavigate('recorder')} 
                variant="primary" 
                className="w-full text-base sm:text-lg py-3 sm:py-4 font-bold min-h-[48px] touch-manipulation"
              >
                Go To Inventory Recorder
              </Button>
            </div>

            {/* Dashboard Card */}
            <div className="bg-slate-800 p-6 sm:p-8 rounded-2xl shadow-xl border border-slate-700 hover:shadow-2xl transition-all duration-300 hover:border-amber-500/30 touch-manipulation">
              <div className="text-center mb-6">
                <div className="w-12 h-12 sm:w-16 sm:h-16 bg-blue-600 rounded-full flex items-center justify-center mx-auto mb-4">
                  <svg className="w-6 h-6 sm:w-8 sm:h-8 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                  </svg>
                </div>
                <h3 className="text-xl sm:text-2xl font-bold text-slate-100 mb-3">View Dashboard</h3>
                <p className="text-sm sm:text-base text-slate-400 leading-relaxed">
                  View all recorded inventory, filter by date ranges, and export data to CSV.
                </p>
              </div>
              <Button 
                onClick={() => onNavigate('dashboard')} 
                variant="secondary" 
                className="w-full text-base sm:text-lg py-3 sm:py-4 font-bold min-h-[48px] touch-manipulation"
              >
                Go To Dashboard
              </Button>
            </div>
          </div>

          {/* Footer - Mobile responsive */}
          <footer className="text-center mt-12 sm:mt-16 text-slate-500">
            <p className="text-xs sm:text-sm">
              Powered by AI • Built for Community Impact
            </p>
          </footer>
        </div>
      </div>
    </div>
  );
};
