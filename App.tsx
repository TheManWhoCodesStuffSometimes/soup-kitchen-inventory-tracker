import React, { useState, useEffect, useCallback } from 'react';
import { InventoryItem, Summary, VoiceAnalysisResult, ImageAnalysisResult, Category } from './types';
import { InventoryItemCard } from './components/InventoryItemCard';
import { Summary as SummaryComponent } from './components/Summary';
import { CameraModal } from './components/CameraModal';
import { VoiceModal } from './components/VoiceModal';
import { Button, Spinner, PlusIcon } from './components/ui';
import { processVoiceWithN8n, processImageWithN8n, submitInventoryToN8n } from './services/apiService';
import { CATEGORIES } from './constants';

function generateFormId() {
    return `SK${new Date().toISOString().replace(/[-:.]/g, '')}`;
}

const App: React.FC = () => {
    const [items, setItems] = useState<InventoryItem[]>([]);
    const [summary, setSummary] = useState<Summary>({ totalItems: 0, totalWeightLbs: 0 });
    const [formId] = useState(generateFormId());
    
    const [isCameraOpen, setIsCameraOpen] = useState(false);
    const [isVoiceOpen, setIsVoiceOpen] = useState(false);
    const [activeItemIndex, setActiveItemIndex] = useState<number | null>(null);

    const [isLoading, setIsLoading] = useState(false);
    const [statusMessage, setStatusMessage] = useState<{type: 'success' | 'error', text: string} | null>(null);


    const getNewItem = (): InventoryItem => {
        const defaultExpiration = new Date();
        defaultExpiration.setDate(defaultExpiration.getDate() + 30);
        return {
            id: crypto.randomUUID(),
            category: '',
            donorName: '',
            customDonorText: '',
            description: '',
            weightLbs: 0,
            quantity: 1,
            expirationDate: defaultExpiration.toISOString().split('T')[0],
        };
    };

    const handleAddItem = () => {
        setItems(prevItems => [...prevItems, getNewItem()]);
    };

    useEffect(() => {
        if (items.length === 0) {
            handleAddItem();
        }
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    const handleUpdateItem = useCallback((id: string, field: keyof InventoryItem, value: any) => {
        setItems(prevItems =>
            prevItems.map(item =>
                item.id === id ? { ...item, [field]: value } : item
            )
        );
    }, []);

    const handleDeleteItem = (id: string) => {
        setItems(prevItems => prevItems.filter(item => item.id !== id));
    };

    useEffect(() => {
        const newSummary = items.reduce(
            (acc, item) => {
                acc.totalItems += Number(item.quantity) || 0;
                acc.totalWeightLbs += (Number(item.weightLbs) || 0) * (Number(item.quantity) || 0);
                return acc;
            },
            { totalItems: 0, totalWeightLbs: 0 }
        );
        setSummary(newSummary);
    }, [items]);

    const handleOpenModal = (modal: 'camera' | 'voice', index: number) => {
        setActiveItemIndex(index);
        if (modal === 'camera') setIsCameraOpen(true);
        if (modal === 'voice') setIsVoiceOpen(true);
    };

    const handleVoiceSuccess = (result: VoiceAnalysisResult) => {
        if (activeItemIndex === null) return;
        const currentItem = items[activeItemIndex];
        if(!currentItem) return;

        handleUpdateItem(currentItem.id, 'description', result.itemName);
        handleUpdateItem(currentItem.id, 'weightLbs', result.estimatedWeightLbs);
        if(CATEGORIES.includes(result.category as Category)){
            handleUpdateItem(currentItem.id, 'category', result.category);
        } else {
            handleUpdateItem(currentItem.id, 'category', 'Other');
        }
    }

    const handleImageSuccess = (result: ImageAnalysisResult) => {
        if (activeItemIndex === null) return;
        const currentItem = items[activeItemIndex];
        if(!currentItem) return;

        handleUpdateItem(currentItem.id, 'description', result.description);
        handleUpdateItem(currentItem.id, 'weightLbs', result.weightLbs);
        if(CATEGORIES.includes(result.category as Category)){
            handleUpdateItem(currentItem.id, 'category', result.category);
        } else {
            handleUpdateItem(currentItem.id, 'category', 'Other');
        }
    }
    
    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setIsLoading(true);
        setStatusMessage(null);
        try {
            await submitInventoryToN8n(items, summary, formId);
            setStatusMessage({ type: 'success', text: 'Inventory submitted successfully! The page will reset.' });
            setTimeout(() => {
                setItems([getNewItem()]);
                setStatusMessage(null);
            }, 3000);
        } catch(err) {
            if(err instanceof Error) {
                setStatusMessage({ type: 'error', text: err.message });
            } else {
                setStatusMessage({ type: 'error', text: "An unknown error occurred." });
            }
        } finally {
            setIsLoading(false);
        }
    }

    const currentDate = new Date().toLocaleDateString('en-US', {
        weekday: 'long', year: 'numeric', month: 'long', day: 'numeric'
    });

    return (
        <div className="max-w-7xl mx-auto p-4 sm:p-6 lg:p-8 font-sans">
            <header className="text-center mb-10">
                <h1 className="text-4xl font-extrabold tracking-tight text-slate-100 sm:text-5xl">Soup Kitchen Inventory</h1>
                <p className="mt-3 text-lg text-slate-300 max-w-2xl mx-auto">Intelligently track and manage your food donations with ease.</p>
                <div className="mt-4 h-1 w-24 bg-amber-500 mx-auto rounded-full" />
            </header>

            <div className="text-center text-slate-400 mb-8 font-medium">
                {currentDate}
            </div>
            
            <form onSubmit={handleSubmit}>
                <div className="grid grid-cols-1 lg:grid-cols-3 lg:gap-8">
                    {/* Left Column: Items */}
                    <div className="lg:col-span-2 space-y-6">
                        {items.map((item, index) => (
                            <InventoryItemCard
                                key={item.id}
                                item={item}
                                itemIndex={index}
                                onUpdate={handleUpdateItem}
                                onDelete={handleDeleteItem}
                                onOpenCamera={() => handleOpenModal('camera', index)}
                                onOpenVoice={() => handleOpenModal('voice', index)}
                            />
                        ))}

                         <Button
                            type="button"
                            onClick={handleAddItem}
                            variant="secondary"
                            className="w-full my-6 text-base py-3 border-2 border-dashed border-slate-600 text-slate-400 hover:border-slate-500 hover:text-slate-300 hover:bg-slate-800"
                        >
                            <PlusIcon className="w-5 h-5"/> Add Another Item
                        </Button>
                    </div>

                    {/* Right Column: Summary & Submit */}
                    <div className="lg:col-span-1 mt-8 lg:mt-0">
                        <div className="sticky top-8 space-y-6">
                            <SummaryComponent summary={summary} />

                            <div className="text-center">
                                {statusMessage && (
                                    <div className={`p-3 rounded-md mb-4 text-sm font-medium ${statusMessage.type === 'success' ? 'bg-green-900/50 text-green-300' : 'bg-red-900/50 text-red-300'}`}>
                                        {statusMessage.text}
                                    </div>
                                )}
                                <div className="flex justify-center">
                                     <Button type="submit" variant="primary" disabled={isLoading || items.length === 0} className="w-full text-lg py-3 font-bold">
                                        {isLoading ? <Spinner /> : 'Submit All Items'}
                                    </Button>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </form>

            <CameraModal 
                isOpen={isCameraOpen} 
                onClose={() => setIsCameraOpen(false)}
                onCapture={processImageWithN8n}
                onSuccess={handleImageSuccess}
            />
            <VoiceModal
                isOpen={isVoiceOpen}
                onClose={() => setIsVoiceOpen(false)}
                onProcess={processVoiceWithN8n}
                onSuccess={handleVoiceSuccess}
            />
        </div>
    );
};

export default App;
