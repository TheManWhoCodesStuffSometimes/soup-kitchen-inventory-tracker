import React, { useState } from 'react';
import { AuthGate } from './components/AuthGate';
import { MainPage } from './components/MainPage';
import { CaptureRecorder } from './components/CaptureRecorder';
import { Dashboard } from './components/Dashboard';

type AppPage = 'main' | 'recorder' | 'dashboard';

const App: React.FC = () => {
    const [currentPage, setCurrentPage] = useState<AppPage>('main');

    const navigateToPage = (page: AppPage) => {
        setCurrentPage(page);
    };

    const renderCurrentPage = () => {
        switch (currentPage) {
            case 'main':
                return <MainPage onNavigate={navigateToPage} />;
            case 'recorder':
                return <CaptureRecorder onExit={() => navigateToPage('main')} />;
            case 'dashboard':
                return <Dashboard onNavigateHome={() => navigateToPage('main')} />;
            default:
                return <MainPage onNavigate={navigateToPage} />;
        }
    };

    return (
        <div className="min-h-screen bg-slate-900">
            <AuthGate>
                {renderCurrentPage()}
            </AuthGate>
        </div>
    );
};

export default App;
