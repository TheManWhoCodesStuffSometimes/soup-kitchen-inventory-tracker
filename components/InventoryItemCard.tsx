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
  
  const handleNumberChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    onUpdate(item.id, name as keyof InventoryItem, parseFloat(value) || 0);
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
    <div className="bg-slate-800 p-5 rounded-xl shadow-md border border-slate-700 relative transition-shadow hover:shadow-lg">
      <div className="flex justify-between items-center mb-4">
        <h3 className="text-lg font-bold text-slate-100">Item #{itemIndex + 1}</h3>
        <button
          type="button"
          onClick={() => onDelete(item.id)}
          className="absolute top-3 right-3 text-slate-500 hover:text-red-400 hover:bg-slate-700 rounded-full w-8 h-8 flex items-center justify-center transition-colors"
          aria-label="Delete item"
        >
          <span className="text-2xl leading-none">&times;</span>
        </button>
      </div>

      <div className="bg-slate-900/50 p-4 rounded-lg mb-5 border border-slate-700">
        <p className="text-sm font-medium text-center text-slate-400 mb-3">Smart Input Options</p>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
           <Button 
             type="button"
             onClick={() => onOpenBarcode(itemIndex)} 
             variant="secondary" 
             disabled={isItemProcessing}
             className="text-sm"
           >
             <BarcodeIcon /> Scan Barcode
           </Button>
           <Button 
             type="button"
             onClick={() => onOpenCamera(itemIndex)} 
             variant="secondary"
             disabled={isItemProcessing}
             className="text-sm"
           >
             <CameraIcon /> Analyze Photo
           </Button>
           <Button 
             type="button"
             onClick={() => onOpenVoice(itemIndex)} 
             variant="secondary"
             disabled={isItemProcessing}
             className="text-sm"
           >
             <MicIcon /> Voice Describe
           </Button>
        </div>
        
        {isItemProcessing && (
          <div className="mt-3 text-center">
            <div className="flex items-center justify-center space-x-2 text-amber-400 bg-amber-900/20 border border-amber-600/30 rounded-lg p-3">
              <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-amber-400"></div>
              <span className="text-sm font-medium">AI is analyzing in background...</span>
            </div>
            <p className="text-xs text-amber-300 mt-1">
              Continue with other items while this processes
            </p>
          </div>
        )}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-x-4 gap-y-5">
        <div className="md:col-span-2">
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

        {item.donorName === 'custom' && (
            <div className="md:col-span-2">
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
        
        <div>
          <Input
            label="Weight per Unit (lbs)"
            name="weightLbs"
            type="number"
            value={item.weightLbs > 0 ? item.weightLbs.toString() : ''}
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

        <div className="md:col-span-2">
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

        <div className="md:col-span-2 bg-slate-700/70 p-3 rounded-lg text-center mt-2">
            <span className="font-semibold text-slate-100">Item Total Weight: {totalItemWeight} lbs</span>
            <p className="text-slate-400 text-xs mt-0.5">({item.weightLbs || 0} lbs &times; {item.quantity} units)</p>
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
