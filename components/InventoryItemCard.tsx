import React from 'react';
import { InventoryItem } from '../types';
import { CATEGORIES, DONORS } from '../constants';
import { Button, Input, Select, CameraIcon, MicIcon, BarcodeIcon } from './ui';

interface InventoryItemCardProps {
  item: InventoryItem;
  itemIndex: number;
  onUpdate: (id: string, field: keyof InventoryItem, value: any) => void;
  onDelete: (id: string) => void;
  onOpenCamera: (itemIndex: number) => void;
  onOpenVoice: (itemIndex: number) => void;
  onOpenBarcode: (itemIndex: number) => void;
  isProcessing?: { [key: string]: boolean };
  isFieldEmpty?: (value: any) => boolean;
}

export const InventoryItemCard: React.FC<InventoryItemCardProps> = ({ 
  item, 
  itemIndex, 
  onUpdate, 
  onDelete, 
  onOpenCamera, 
  onOpenVoice, 
  onOpenBarcode,
  isProcessing = {},
  isFieldEmpty = () => false
}) => {
  
  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    onUpdate(item.id, name as keyof InventoryItem, value);
  };
  
  // WEIGHT INPUT FIX: Automatically round weight inputs to prevent validation errors
  const handleNumberChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    let parsedValue = parseFloat(value) || 0;
    
    // AUTOMATIC ROUNDING FIX: Round weight inputs to 2 decimal places
    // This prevents validation errors when users type very precise decimals
    if (name === 'weightLbs' && parsedValue > 0) {
      parsedValue = Math.round(parsedValue * 100) / 100;
      console.log(`📏 Manual weight rounded: ${value} → ${parsedValue}`);
    }
    
    onUpdate(item.id, name as keyof InventoryItem, parsedValue);
  };

  const totalItemWeight = (item.weightLbs * item.quantity).toFixed(2);
  const isItemProcessing = isProcessing[item.id];

  // Helper function to check if field is empty and add validation styling
  const getFieldClasses = (value: any, baseClasses: string = "") => {
    const isEmpty = isFieldEmpty(value);
    if (isEmpty) {
      return `${baseClasses} ring-2 ring-red-500 border-red-500`.trim();
    }
    return baseClasses;
  };

  // Check individual field states for debugging
  const isDescriptionEmpty = isFieldEmpty(item.description);
  const isCategoryEmpty = isFieldEmpty(item.category);
  const isDonorEmpty = isFieldEmpty(item.donorName);
  const isCustomDonorEmpty = item.donorName === 'custom' && isFieldEmpty(item.customDonorText);
  const isWeightEmpty = isFieldEmpty(item.weightLbs);
  const isExpirationEmpty = isFieldEmpty(item.expirationDate);

  return (
    <div className="bg-slate-800 p-4 sm:p-5 rounded-xl shadow-md border border-slate-700 relative transition-shadow hover:shadow-lg">
      <div className="flex justify-between items-center mb-4">
        <h3 className="text-base sm:text-lg font-bold text-slate-100">Item #{itemIndex + 1}</h3>
        <button
          type="button"
          onClick={() => onDelete(item.id)}
          className="absolute top-3 right-3 text-slate-500 hover:text-red-400 hover:bg-slate-700 rounded-full w-8 h-8 flex items-center justify-center transition-colors min-h-[44px] min-w-[44px] touch-manipulation"
          aria-label="Delete item"
        >
          <span className="text-2xl leading-none">&times;</span>
        </button>
      </div>

      {/* Smart Input Options - Mobile optimized */}
      <div className="bg-slate-900/50 p-3 sm:p-4 rounded-lg mb-4 sm:mb-5 border border-slate-700">
        <p className="text-xs sm:text-sm font-medium text-center text-slate-400 mb-3">Smart Input Options</p>
        <div className="space-y-2 sm:space-y-0 sm:grid sm:grid-cols-3 sm:gap-3">
           <Button 
             type="button"
             onClick={() => onOpenBarcode(itemIndex)} 
             variant="secondary" 
             disabled={isItemProcessing}
             className="w-full text-xs sm:text-sm min-h-[44px] touch-manipulation"
           >
             <BarcodeIcon className="w-4 h-4" /> Scan Barcode
           </Button>
           <Button 
             type="button"
             onClick={() => onOpenCamera(itemIndex)} 
             variant="secondary"
             disabled={isItemProcessing}
             className="w-full text-xs sm:text-sm min-h-[44px] touch-manipulation"
           >
             <CameraIcon className="w-4 h-4" /> Analyze Photo
           </Button>
           <Button 
             type="button"
             onClick={() => onOpenVoice(itemIndex)} 
             variant="secondary"
             disabled={isItemProcessing}
             className="w-full text-xs sm:text-sm min-h-[44px] touch-manipulation"
           >
             <MicIcon className="w-4 h-4" /> Voice Describe
           </Button>
        </div>
        
        {isItemProcessing && (
          <div className="mt-3 text-center">
            <div className="flex items-center justify-center space-x-2 text-amber-400 bg-amber-900/20 border border-amber-600/30 rounded-lg p-3">
              <div className="animate-spin rounded-full h-4 w-4 sm:h-5 sm:w-5 border-b-2 border-amber-400"></div>
              <span className="text-xs sm:text-sm font-medium">AI is analyzing in background...</span>
            </div>
            <p className="text-xs text-amber-300 mt-1">
              Continue with other items while this processes
            </p>
          </div>
        )}
      </div>

      {/* Form Fields - Mobile optimized grid */}
      <div className="space-y-4 sm:space-y-5">
        {/* Description - Full width */}
        <div>
          <Input
            label="Item Description"
            name="description"
            value={item.description}
            onChange={handleInputChange}
            placeholder="e.g., Campbell's Tomato Soup, 10.75 oz can"
            required
            className={getFieldClasses(
              item.description, 
              isItemProcessing ? "bg-slate-700 opacity-75" : ""
            )}
          />
        </div>

        {/* Category and Donor - Mobile: stack, SM+: side by side */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <Select 
            label="Category" 
            name="category" 
            value={item.category} 
            onChange={handleInputChange} 
            required
            className={getFieldClasses(
              item.category, 
              isItemProcessing ? "bg-slate-700 opacity-75" : ""
            )}
          >
            <option value="" disabled>Select Category</option>
            {CATEGORIES.map(cat => <option key={cat} value={cat}>{cat}</option>)}
          </Select>

          <Select 
            label="Donor Name" 
            name="donorName" 
            value={item.donorName} 
            onChange={handleInputChange} 
            required
            className={getFieldClasses(
              item.donorName, 
              isItemProcessing ? "bg-slate-700 opacity-75" : ""
            )}
          >
             <option value="" disabled>Select Donor</option>
             {DONORS.map(don => <option key={don} value={don}>{don === 'custom' ? "Custom (Enter manually)" : don}</option>)}
          </Select>
        </div>

        {/* Custom Donor - Full width if needed */}
        {item.donorName === 'custom' && (
          <div>
            <Input
              label="Custom Donor Name"
              name="customDonorText"
              value={item.customDonorText}
              onChange={handleInputChange}
              placeholder="Enter donor name manually"
              required
              className={getFieldClasses(
                item.customDonorText, 
                isItemProcessing ? "bg-slate-700 opacity-75" : ""
              )}
            />
          </div>
        )}
        
        {/* Weight and Quantity - Mobile: stack, SM+: side by side */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <Input
              label="Weight per Unit (lbs)"
              name="weightLbs"
              type="number"
              value={item.weightLbs > 0 ? item.weightLbs.toFixed(2) : ''} 
              onChange={handleNumberChange}
              step="0.01"
              min="0"
              placeholder="0.00"
              className={getFieldClasses(
                item.weightLbs, 
                isItemProcessing ? "bg-slate-700 opacity-75" : ""
              )}
            />
          </div>
          
          <div>
            <Input
              label="Quantity"
              name="quantity"
              type="number"
              value={item.quantity.toString()}
              onChange={handleNumberChange}
              min="1"
              step="1"
              required
              className={isItemProcessing ? "bg-slate-700 opacity-75" : ""}
            />
          </div>
        </div>

        {/* Expiration Date - Full width */}
        <div>
          <Input
            label="Expiration Date"
            name="expirationDate"
            type="date"
            value={item.expirationDate}
            onChange={handleInputChange}
            required
            className={getFieldClasses(
              item.expirationDate, 
              isItemProcessing ? "bg-slate-700 opacity-75" : ""
            )}
          />
        </div>

        {/* Total Weight Display - Mobile optimized */}
        <div className="bg-slate-700/70 p-3 rounded-lg text-center mt-4">
          <span className="font-semibold text-slate-100 text-sm sm:text-base">
            Item Total Weight: {totalItemWeight} lbs
          </span>
          <p className="text-slate-400 text-xs mt-0.5">
            ({item.weightLbs || 0} lbs × {item.quantity} units)
          </p>
        </div>
      </div>

      {/* Debug info - remove this after testing */}
      {process.env.NODE_ENV === 'development' && (
        <div className="mt-4 p-2 bg-slate-900 rounded text-xs text-slate-400">
          <div>Debug validation:</div>
          <div>Description empty: {isDescriptionEmpty ? 'YES' : 'NO'}</div>
          <div>Category empty: {isCategoryEmpty ? 'YES' : 'NO'}</div>
          <div>Donor empty: {isDonorEmpty ? 'YES' : 'NO'}</div>
          <div>Weight empty: {isWeightEmpty ? 'YES' : 'NO'}</div>
          <div>Expiration empty: {isExpirationEmpty ? 'YES' : 'NO'}</div>
        </div>
      )}
    </div>
  );
};
