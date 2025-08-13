import React, { useState, useEffect, useCallback } from 'react';
import { InventoryItem, Summary, VoiceAnalysisResult, ImageAnalysisResult, Category } from './types';
import { InventoryItemCard } from './components/InventoryItemCard';
import { Summary as SummaryComponent } from './components/Summary';
import { CameraModal } from './components/CameraModal';
import { VoiceModal } from './components/VoiceModal';
import { BarcodeModal } from './components/BarcodeModal';
import { Button, Spinner, PlusIcon } from './components/ui';
import { processVoiceWithN8n, processImageWithN8n, submitInventoryToN8n } from './services/apiService';
import { CATEGORIES, DONORS } from './constants';

// Product info type for barcode scanner
interface ProductInfo {
  name: string;
  brand?: string;
  category?: string;
  weight?: string;
  barcode: string;
}

function generateFormId() {
    return `SK${new Date().toISOString().replace(/[-:.]/g, '')}`;
}

const App: React.FC = () => {
    const [items, setItems] = useState<InventoryItem[]>([]);
    const [summary, setSummary] = useState<Summary>({ totalItems: 0, totalWeightLbs: 0 });
    const [formId] = useState(generateFormId());
    
    const [isCameraOpen, setIsCameraOpen] = useState(false);
    const [isVoiceOpen, setIsVoiceOpen] = useState(false);
    const [isBarcodeOpen, setIsBarcodeOpen] = useState(false);
    const [activeItemIndex, setActiveItemIndex] = useState<number | null>(null);

    const [isLoading, setIsLoading] = useState(false);
    const [statusMessage, setStatusMessage] = useState<{type: 'success' | 'error', text: string} | null>(null);
    const [processingItems, setProcessingItems] = useState<{[key: string]: boolean}>({});
    
    // Toast notification for background processing errors
    const [toastMessage, setToastMessage] = useState<{type: 'error' | 'success', text: string} | null>(null);

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
        // Clear processing state for deleted item
        setProcessingItems(prev => {
            const newState = { ...prev };
            delete newState[id];
            return newState;
        });
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

    const setItemProcessing = (itemId: string, isProcessing: boolean) => {
        setProcessingItems(prev => ({
            ...prev,
            [itemId]: isProcessing
        }));
    };

    // Parse product weight from string (from barcode scanner)
    const parseProductWeight = (quantityString: string): number => {
        if (!quantityString || typeof quantityString !== 'string') return 0;

        const quantity = quantityString.toLowerCase().trim();
        const match = quantity.match(/(\d+\.?\d*)\s*([a-z]+)/);
        if (!match) return 0;

        const value = parseFloat(match[1]);
        const unit = match[2];

        switch (unit) {
            case 'g':
            case 'gram':
            case 'grams':
                return value * 0.00220462;
            case 'kg':
            case 'kilogram':
            case 'kilograms':
                return value * 2.20462;
            case 'oz':
            case 'ounce':
            case 'ounces':
                return value * 0.0625;
            case 'lb':
            case 'lbs':
            case 'pound':
            case 'pounds':
                return value;
            case 'ml':
            case 'milliliter':
            case 'milliliters':
                return value * 0.00220462;
            case 'l':
            case 'liter':
            case 'liters':
                return value * 2.20462;
            case 'fl':
            case 'floz':
                return value * 0.0652;
            default:
                return 0;
        }
    };

    const handleOpenModal = (modal: 'camera' | 'voice' | 'barcode', index: number) => {
        setActiveItemIndex(index);
        if (modal === 'camera') setIsCameraOpen(true);
        if (modal === 'voice') setIsVoiceOpen(true);
        if (modal === 'barcode') setIsBarcodeOpen(true);
    };

    const handleBarcodeSuccess = (productInfo: ProductInfo) => {
        if (activeItemIndex === null) return;
        const currentItem = items[activeItemIndex];
        if (!currentItem) return;

        // Build description
        let description = productInfo.name;
        if (productInfo.brand) {
            description = `${productInfo.brand} - ${productInfo.name}`;
        }

        // Update item fields
        handleUpdateItem(currentItem.id, 'description', description);
        
        if (productInfo.category && CATEGORIES.includes(productInfo.category as Category)) {
            handleUpdateItem(currentItem.id, 'category', productInfo.category);
        } else {
            handleUpdateItem(currentItem.id, 'category', 'Other');
        }

        // Parse and set weight if available
        if (productInfo.weight) {
            const weight = parseProductWeight(productInfo.weight);
            if (weight > 0) {
                handleUpdateItem(currentItem.id, 'weightLbs', weight);
            }
        }
    };

    const handleVoiceSuccess = (result: VoiceAnalysisResult) => {
      if (activeItemIndex === null) return;
      const currentItem = items[activeItemIndex];
      if (!currentItem) return;
    
      // Always update description and weight
      handleUpdateItem(currentItem.id, 'description', result.itemName);
      handleUpdateItem(currentItem.id, 'weightLbs', result.estimatedWeightLbs);
      
      // Update category
      if (CATEGORIES.includes(result.category as Category)) {
        handleUpdateItem(currentItem.id, 'category', result.category);
      } else {
        handleUpdateItem(currentItem.id, 'category', 'Other');
      }
      
      // Handle quantity if provided and greater than 1
      if (result.quantity && result.quantity > 1) {
        handleUpdateItem(currentItem.id, 'quantity', result.quantity);
      }
      
      // Handle donor name if provided and valid
      if (result.donorName) {
        // Check if it's a valid donor (excluding 'custom')
        const validDonors = DONORS.filter(donor => donor !== 'custom');
        if (validDonors.includes(result.donorName as any)) {
          handleUpdateItem(currentItem.id, 'donorName', result.donorName);
        }
        // If it's not in our list but was detected, set to 'custom' and fill customDonorText
        else if (result.donorName.trim().length > 0) {
          handleUpdateItem(currentItem.id, 'donorName', 'custom');
          handleUpdateItem(currentItem.id, 'customDonorText', result.donorName);
        }
      }
    };

    const handleImageSuccess = (result: ImageAnalysisResult) => {
        if (activeItemIndex === null) return;
        const currentItem = items[activeItemIndex];
        if (!currentItem) return;

        handleUpdateItem(currentItem.id, 'description', result.description);
        handleUpdateItem(currentItem.id, 'weightLbs', result.weightLbs);
        if (CATEGORIES.includes(result.category as Category)) {
            handleUpdateItem(currentItem.id, 'category', result.category);
        } else {
            handleUpdateItem(currentItem.id, 'category', 'Other');
        }
    };

    // UPDATED: Background processing functions with toast error handling
    const handleVoiceProcess = async (text: string): Promise<VoiceAnalysisResult> => {
        if (activeItemIndex === null) throw new Error('No active item');
        const currentItem = items[activeItemIndex];
        if (!currentItem) throw new Error('Item not found');

        setItemProcessing(currentItem.id, true);
        
        try {
            const result = await processVoiceWithN8n(text);
            return result;
        } catch (error) {
            // Show toast error instead of modal error
            setToastMessage({ 
                type: 'error', 
                text: `Voice analysis failed: ${error instanceof Error ? error.message : 'Unknown error'}` 
            });
            setTimeout(() => setToastMessage(null), 8000);
            throw error;
        } finally {
            setItemProcessing(currentItem.id, false);
        }
    };

    const handleImageProcess = async (imageBlob: Blob): Promise<ImageAnalysisResult> => {
      if (activeItemIndex === null) throw new Error('No active item');
      const currentItem = items[activeItemIndex];
      if (!currentItem) throw new Error('Item not found');
    
      setItemProcessing(currentItem.id, true);
      
      try {
        const result = await processImageWithN8n(imageBlob);
        return result;
      } catch (error) {
        // Show toast error instead of modal error
        setToastMessage({ 
            type: 'error', 
            text: `Photo analysis failed: ${error instanceof Error ? error.message : 'Unknown error'}` 
        });
        setTimeout(() => setToastMessage(null), 8000);
        throw error;
      } finally {
        setItemProcessing(currentItem.id, false);
      }
    };

    // Handle camera to barcode fallback
    const handlePhotoInstead = () => {
        setIsBarcodeOpen(false);
        setIsCameraOpen(true);
    };
    
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
            {/* Toast notification for background processing errors */}
            {toastMessage && (
                <div className={`fixed top-4 right-4 z-50 p-4 rounded-lg shadow-lg border ${
                    toastMessage.type === 'error' 
                        ? 'bg-red-900/90 border-red-600 text-red-200' 
                        : 'bg-green-900/90 border-green-600 text-green-200'
                }`}>
                    <div className="flex items-center justify-between">
                        <span className="text-sm font-medium">{toastMessage.text}</span>
                        <button 
                            onClick={() => setToastMessage(null)}
                            className="ml-3 text-lg hover:opacity-70"
                        >
                            ×
                        </button>
                    </div>
                </div>
            )}

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
                                onOpenBarcode={() => handleOpenModal('barcode', index)}
                                isProcessing={processingItems}
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

            {/* Barcode Scanner Modal */}
            <BarcodeModal 
                isOpen={isBarcodeOpen} 
                onClose={() => setIsBarcodeOpen(false)}
                onSuccess={handleBarcodeSuccess}
                onPhotoInstead={handlePhotoInstead}
            />

            {/* Camera Modal */}
            <CameraModal 
                isOpen={isCameraOpen} 
                onClose={() => setIsCameraOpen(false)}
                onCapture={handleImageProcess}
                onSuccess={handleImageSuccess}
            />

            {/* Voice Modal */}
            <VoiceModal
                isOpen={isVoiceOpen}
                onClose={() => setIsVoiceOpen(false)}
                onProcess={handleVoiceProcess}
                onSuccess={handleVoiceSuccess}
            />
        </div>
    );
};

export default App;
