import React, { useState, useRef, useEffect, useCallback } from 'react';
import { Modal, Button, Spinner, BarcodeIcon, CheckIcon, XIcon, CameraIcon } from './ui';

// Declare Quagga types for TypeScript
declare global {
  interface Window {
    Quagga: any;
  }
}

interface ProductInfo {
  name: string;
  brand?: string;
  category?: string;
  weight?: string;
  barcode: string;
}

interface BarcodeModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: (productInfo: ProductInfo) => void;
  onPhotoInstead: () => void;
}

export const BarcodeModal: React.FC<BarcodeModalProps> = ({ 
  isOpen, 
  onClose, 
  onSuccess, 
  onPhotoInstead 
}) => {
  const videoRef = useRef<HTMLDivElement>(null);
  const [isScanning, setIsScanning] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [detectedProduct, setDetectedProduct] = useState<ProductInfo | null>(null);
  const [isLookingUp, setIsLookingUp] = useState(false);
  const [lastScannedBarcode, setLastScannedBarcode] = useState<string>('');
  const [debugInfo, setDebugInfo] = useState<string[]>([]);

  // Parse product weight and convert to pounds
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

  // Auto-categorize products based on Open Food Facts categories
  const autoCategorize = (categories: string): string => {
    if (!categories) return 'Other';
    
    const cats = categories.toLowerCase();
    if (cats.includes('canned') || cats.includes('preserve')) return 'Canned Goods';
    if (cats.includes('dairy') || cats.includes('milk') || cats.includes('cheese')) return 'Dairy';
    if (cats.includes('meat') || cats.includes('poultry') || cats.includes('fish')) return 'Meat';
    if (cats.includes('bread') || cats.includes('bakery')) return 'Bakery';
    if (cats.includes('frozen')) return 'Frozen';
    if (cats.includes('beverage') || cats.includes('drink') || cats.includes('juice')) return 'Beverages';
    if (cats.includes('snack') || cats.includes('candy') || cats.includes('cookie')) return 'Snacks';
    if (cats.includes('produce') || cats.includes('fruit') || cats.includes('vegetable')) return 'Fresh Produce';
    if (cats.includes('rice') || cats.includes('pasta') || cats.includes('flour')) return 'Pantry Staples';
    return 'Other';
  };

  // Lookup barcode via Open Food Facts API
  const lookupBarcode = async (barcode: string) => {
    setIsLookingUp(true);
    setError(null);

    try {
      const response = await fetch(`https://world.openfoodfacts.org/api/v2/product/${barcode}.json`);
      const data = await response.json();

      if (data.status === 1 && data.product && data.product.product_name) {
        const productInfo: ProductInfo = {
          name: data.product.product_name,
          brand: data.product.brands || '',
          category: autoCategorize(data.product.categories || ''),
          weight: data.product.quantity || '',
          barcode
        };
        setDetectedProduct(productInfo);
      } else {
        setError(`Product not found in database. Barcode: ${barcode}`);
      }
    } catch (err) {
      setError('Failed to lookup product. Please try again or enter manually.');
    } finally {
      setIsLookingUp(false);
    }
  };

  // ULTRA SENSITIVE barcode detection - accepts almost everything!
  const handleBarcodeDetected = useCallback((result: any) => {
    if (!isScanning) return;

    const code = result.codeResult.code;
    const confidence = result.codeResult.confidence || 0;
    
    // Add debug info
    const debugMsg = `Detected: ${code} (conf: ${confidence.toFixed(1)}%)`;
    setDebugInfo(prev => [debugMsg, ...prev.slice(0, 4)]); // Keep last 5 entries
    
    console.log(debugMsg);

    // VERY RELAXED validation - accept almost any code that looks like it could be a barcode
    if (!code || code.length < 4) {
      console.log(`Rejected: too short (${code.length})`);
      return;
    }

    // Accept any confidence above 10% (very low!)
    if (confidence < 10) {
      console.log(`Rejected: confidence too low (${confidence}%)`);
      return;
    }

    // Accept immediately without stability checking!
    console.log(`ACCEPTING barcode immediately: ${code}`);
    stopScanner();
    setLastScannedBarcode(code);
    lookupBarcode(code);
  }, [isScanning]);

  const startScanner = useCallback(async () => {
    if (!window.Quagga) {
      // Load QuaggaJS dynamically
      const script = document.createElement('script');
      script.src = 'https://unpkg.com/quagga@0.12.1/dist/quagga.min.js';
      script.onload = () => initializeScanner();
      document.head.appendChild(script);
    } else {
      initializeScanner();
    }
  }, []);

  const initializeScanner = () => {
    if (!videoRef.current) return;

    setError(null);
    setDetectedProduct(null);
    setDebugInfo([]);
    setLastScannedBarcode('');

    window.Quagga.init({
      inputStream: {
        name: "Live",
        type: "LiveStream", 
        target: videoRef.current,
        constraints: {
          width: { min: 320, ideal: 640 }, // Lower resolution for faster processing
          height: { min: 240, ideal: 480 },
          facingMode: "environment"
        }
      },
      locator: {
        patchSize: "large", // Changed to large for better detection
        halfSample: false   // Don't downsample for better accuracy
      },
      numOfWorkers: 2, // Reduced workers
      frequency: 10,   // Higher frequency for more attempts
      decoder: {
        readers: [
          "ean_reader",
          "ean_8_reader", 
          "upc_reader",
          "upc_e_reader",
          "code_128_reader",
          "code_39_reader",      // Added more readers
          "codabar_reader",
          "i2of5_reader"         // Added interleaved 2 of 5
        ],
        multiple: false
      },
      locate: true,
      area: {
        top: "10%",    // Larger scanning area
        right: "10%", 
        left: "10%",
        bottom: "10%"
      }
    }, (err: any) => {
      if (err) {
        console.error('QuaggaJS initialization failed:', err);
        setError('Camera access failed. Please check permissions and try again.');
        return;
      }

      window.Quagga.start();
      setIsScanning(true);
      
      // Set up barcode detection handler
      window.Quagga.onDetected(handleBarcodeDetected);
    });
  };

  const stopScanner = () => {
    if (window.Quagga && isScanning) {
      window.Quagga.stop();
      window.Quagga.offDetected(handleBarcodeDetected);
    }
    setIsScanning(false);
  };

  useEffect(() => {
    if (isOpen && !detectedProduct && !isLookingUp) {
      startScanner();
    }
    
    return () => {
      stopScanner();
    };
  }, [isOpen, detectedProduct, isLookingUp, startScanner]);

  const handleClose = () => {
    stopScanner();
    setDetectedProduct(null);
    setError(null);
    setIsLookingUp(false);
    setDebugInfo([]);
    setLastScannedBarcode('');
    onClose();
  };

  const handleConfirmProduct = () => {
    if (detectedProduct) {
      onSuccess(detectedProduct);
      handleClose();
    }
  };

  const handleRescan = () => {
    setDetectedProduct(null);
    setError(null);
    setDebugInfo([]);
    startScanner();
  };

  const handlePhotoInstead = () => {
    handleClose();
    onPhotoInstead();
  };

  return (
    <Modal isOpen={isOpen} onClose={handleClose} title="Scan Product Barcode (Ultra Sensitive)" size="lg">
      <div className="space-y-4">
        {!detectedProduct && !error && !isLookingUp && (
          <>
            <div className="relative w-full aspect-video bg-slate-900 rounded-lg overflow-hidden border border-slate-600">
              <div ref={videoRef} className="w-full h-full" />
              
              {/* Scanning overlay */}
              <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                <div className="relative">
                  <div className="w-64 h-32 border-2 border-green-400 border-dashed rounded-lg bg-green-400/10">
                    {/* Animated scanning line */}
                    <div className="absolute top-1/2 left-4 right-4 h-0.5 bg-green-400 opacity-75 animate-pulse" />
                  </div>
                </div>
              </div>
              
              <div className="absolute bottom-4 left-4 right-4 text-center">
                <p className="text-green-400 text-sm font-medium bg-black/60 px-3 py-1 rounded-md">
                  {isScanning ? 'ULTRA SENSITIVE - Point at any barcode!' : 'Starting camera...'}
                </p>
              </div>
            </div>

            {/* Debug info panel */}
            {debugInfo.length > 0 && (
              <div className="bg-slate-700 p-3 rounded-lg">
                <h4 className="text-xs font-semibold text-slate-300 mb-2">Debug Info:</h4>
                <div className="space-y-1">
                  {debugInfo.map((info, index) => (
                    <div key={index} className="text-xs font-mono text-slate-400">
                      {info}
                    </div>
                  ))}
                </div>
              </div>
            )}
            
            <div className="flex gap-3">
              <Button onClick={handleClose} variant="secondary" className="flex-1">
                <XIcon /> Cancel
              </Button>
              <Button onClick={handlePhotoInstead} variant="secondary" className="flex-1">
                <CameraIcon /> Photo Instead
              </Button>
            </div>
          </>
        )}

        {isLookingUp && (
          <div className="flex flex-col items-center justify-center py-8 space-y-4">
            <Spinner className="w-8 h-8" />
            <p className="text-slate-300 font-semibold">Looking up product...</p>
            {lastScannedBarcode && (
              <p className="text-slate-400 text-sm font-mono">Barcode: {lastScannedBarcode}</p>
            )}
          </div>
        )}

        {detectedProduct && (
          <div className="space-y-4">
            <div className="bg-slate-700 p-4 rounded-lg border border-slate-600">
              <h3 className="text-lg font-semibold text-slate-100 mb-3 flex items-center">
                <BarcodeIcon className="w-5 h-5 mr-2 text-green-400" />
                Product Found!
              </h3>
              
              <div className="space-y-2 text-sm">
                <div>
                  <span className="font-medium text-slate-300">Name:</span>
                  <span className="ml-2 text-slate-100">{detectedProduct.name}</span>
                </div>
                
                {detectedProduct.brand && (
                  <div>
                    <span className="font-medium text-slate-300">Brand:</span>
                    <span className="ml-2 text-slate-100">{detectedProduct.brand}</span>
                  </div>
                )}
                
                {detectedProduct.weight && (
                  <div>
                    <span className="font-medium text-slate-300">Weight:</span>
                    <span className="ml-2 text-slate-100">{detectedProduct.weight}</span>
                  </div>
                )}
                
                <div>
                  <span className="font-medium text-slate-300">Category:</span>
                  <span className="ml-2 text-slate-100">{detectedProduct.category}</span>
                </div>
                
                <div>
                  <span className="font-medium text-slate-300">Barcode:</span>
                  <span className="ml-2 text-slate-100 font-mono">{detectedProduct.barcode}</span>
                </div>
              </div>
            </div>

            <div className="bg-amber-900/30 border border-amber-600/30 rounded-lg p-3">
              <p className="text-amber-200 text-sm font-medium text-center">
                Is this the correct product?
              </p>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <Button onClick={handleConfirmProduct} variant="primary" className="flex-1">
                <CheckIcon /> Yes, Correct
              </Button>
              <Button onClick={handleRescan} variant="secondary" className="flex-1">
                <BarcodeIcon /> No, Rescan
              </Button>
            </div>
            
            <div className="grid grid-cols-2 gap-3">
              <Button onClick={handlePhotoInstead} variant="secondary" className="flex-1">
                <CameraIcon /> Photo Instead
              </Button>
              <Button onClick={handleClose} variant="secondary" className="flex-1">
                <XIcon /> Cancel
              </Button>
            </div>
          </div>
        )}

        {error && !isLookingUp && (
          <div className="space-y-4">
            <div className="bg-red-900/50 border border-red-600/50 rounded-lg p-4">
              <p className="text-red-300 text-sm font-medium">{error}</p>
              {lastScannedBarcode && (
                <p className="text-red-200 text-xs font-mono mt-2">Last scanned: {lastScannedBarcode}</p>
              )}
            </div>
            
            <div className="grid grid-cols-2 gap-3">
              <Button onClick={handleRescan} variant="secondary" className="flex-1">
                <BarcodeIcon /> Try Again
              </Button>
              <Button onClick={handlePhotoInstead} variant="secondary" className="flex-1">
                <CameraIcon /> Photo Instead
              </Button>
            </div>
            
            <Button onClick={handleClose} variant="secondary" className="w-full">
              <XIcon /> Cancel & Enter Manually
            </Button>
          </div>
        )}

        {/* Testing instructions */}
        <div className="bg-blue-900/30 border border-blue-600/30 rounded-lg p-3">
          <p className="text-blue-200 text-xs text-center">
            <strong>Testing Mode:</strong> Ultra sensitive - should scan almost any barcode instantly!<br/>
            Try pointing at barcodes on products, books, or even barcodes on your screen.
          </p>
        </div>
      </div>
    </Modal>
  );
};
