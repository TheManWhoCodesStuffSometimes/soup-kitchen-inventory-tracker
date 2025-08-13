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
  const [recentDetections, setRecentDetections] = useState<{code: string, confidence: number, timestamp: number}[]>([]);
  const [isProcessingDetection, setIsProcessingDetection] = useState(false);
  const [scanningGuidance, setScanningGuidance] = useState<string>('Position barcode in center');

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
    // Prevent multiple simultaneous lookups
    if (isLookingUp) {
      return;
    }
    
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
      setIsProcessingDetection(false); // Reset processing flag here
    }
  };

  // Validate barcode format
  const isValidBarcodeFormat = (code: string): boolean => {
    const cleanCode = code.replace(/\D/g, '');
    const validLengths = [8, 12, 13, 14];
    return validLengths.includes(cleanCode.length) && /^\d+$/.test(cleanCode);
  };

  // Barcode detection - NO CONFIDENCE CHECK, just consistency
  const handleBarcodeDetected = useCallback((result: any) => {
    if (isProcessingDetection) {
      return;
    }

    const code = result.codeResult.code;
    const timestamp = Date.now();
    
    // Very basic validation - just check we have a code
    if (!code || code.length < 6) {
      setScanningGuidance('Move closer to barcode');
      return;
    }

    setScanningGuidance('Reading barcode...');

    // Add to recent detections for consistency checking
    setRecentDetections(prev => {
      // Remove old detections (older than 2 seconds)
      const filtered = prev.filter(d => timestamp - d.timestamp < 2000);
      
      // Add new detection (no confidence needed)
      const updated = [...filtered, { code, confidence: 100, timestamp }];
      
      // Check for 3 consistent readings of the same code
      const sameCodeDetections = updated.filter(d => d.code === code);
      
      if (sameCodeDetections.length >= 3) {
        setScanningGuidance('Found! Processing...');
        setIsProcessingDetection(true);
        
        setTimeout(() => {
          stopScanner();
          lookupBarcode(code);
        }, 100);
        
        return []; // Clear detections
      } else {
        setScanningGuidance(`Reading... (${sameCodeDetections.length}/3)`);
        return updated;
      }
    });
    
  }, [isProcessingDetection]);

  // Check camera permissions
  const checkCameraPermission = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: true });
      stream.getTracks().forEach(track => track.stop());
      return true;
    } catch (err) {
      setError(`Camera access denied: ${err}`);
      return false;
    }
  };

  // Load QuaggaJS library
  const loadQuaggaJS = async (): Promise<boolean> => {
    return new Promise((resolve) => {
      if (window.Quagga) {
        resolve(true);
        return;
      }

      const script = document.createElement('script');
      script.src = 'https://unpkg.com/quagga@0.12.1/dist/quagga.min.js';
      
      script.onload = () => resolve(true);
      script.onerror = () => {
        setError('Failed to load barcode scanner library');
        resolve(false);
      };
      
      document.head.appendChild(script);
    });
  };

  // Initialize the scanner
  const initializeScanner = async () => {
    if (!videoRef.current) {
      setError('Video element not ready');
      return;
    }

    setError(null);
    setDetectedProduct(null);
    setScanningGuidance('Position barcode in center');

    const config = {
      inputStream: {
        name: "Live",
        type: "LiveStream", 
        target: videoRef.current,
        constraints: {
          width: { min: 640, ideal: 1280 },
          height: { min: 480, ideal: 720 },
          facingMode: "environment"
        }
      },
      locator: {
        patchSize: "medium",
        halfSample: false
      },
      numOfWorkers: 2,
      frequency: 15, // Much higher frequency for faster detection
      decoder: {
        readers: [
          "ean_reader",
          "ean_8_reader", 
          "upc_reader",
          "upc_e_reader",
          "code_128_reader"
        ],
        multiple: false
      },
      locate: true,
      area: {
        // Larger scanning area for easier detection
        top: "15%",
        right: "15%", 
        left: "15%",
        bottom: "15%"
      }
    };

    window.Quagga.init(config, (err: any) => {
      if (err) {
        setError(`Scanner initialization failed: ${err.name || err.message || 'Unknown error'}`);
        return;
      }

      try {
        window.Quagga.start();
        window.Quagga.onDetected(handleBarcodeDetected);
        setIsScanning(true);
      } catch (startErr) {
        setError(`Scanner start failed: ${startErr}`);
      }
    });
  };

  // Start the scanner
  const startScanner = useCallback(async () => {
    const hasCamera = await checkCameraPermission();
    if (!hasCamera) return;
    
    const hasQuagga = await loadQuaggaJS();
    if (!hasQuagga) return;
    
    setTimeout(() => {
      initializeScanner();
    }, 500);
  }, []);

  // Stop the scanner and clean up
  const stopScanner = () => {
    if (window.Quagga && isScanning) {
      try {
        window.Quagga.stop();
        window.Quagga.offDetected(handleBarcodeDetected);
      } catch (err) {
        console.error('Error stopping scanner:', err);
      }
    }
    setIsScanning(false);
    setRecentDetections([]);
    setIsProcessingDetection(false);
    setScanningGuidance('Position barcode in center');
  };

  // Clean restart of scanner
  const handleRescan = () => {
    setDetectedProduct(null);
    setError(null);
    setRecentDetections([]);
    setIsProcessingDetection(false);
    setScanningGuidance('Position barcode in center');
    
    // Give time for cleanup before restarting
    setTimeout(() => {
      startScanner();
    }, 100);
  };

  useEffect(() => {
    // Only start scanner if modal is open AND we don't have a product AND not currently looking up
    if (isOpen && !detectedProduct && !isLookingUp && !isProcessingDetection) {
      startScanner();
    }
    
    return () => {
      stopScanner();
    };
  }, [isOpen, startScanner]); // Removed detectedProduct and isLookingUp from dependencies

  const handleClose = () => {
    stopScanner();
    setDetectedProduct(null);
    setError(null);
    setIsLookingUp(false);
    setRecentDetections([]);
    setIsProcessingDetection(false);
    setScanningGuidance('Position barcode in center');
    onClose();
  };

  const handleConfirmProduct = () => {
    if (detectedProduct) {
      onSuccess(detectedProduct);
      handleClose();
    }
  };

  const handlePhotoInstead = () => {
    handleClose();
    onPhotoInstead();
  };

  return (
    <Modal isOpen={isOpen} onClose={handleClose} title="Scan Product Barcode" size="lg">
      <div className="space-y-4">
        {!detectedProduct && !error && !isLookingUp && (
          <>
            <div className="relative w-full aspect-video bg-slate-900 rounded-lg overflow-hidden border border-slate-600">
              <div ref={videoRef} className="w-full h-full" />
              
              {/* Scanning overlay */}
              <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                <div className="relative">
                  <div className="w-48 h-24 border-2 border-green-400 rounded-lg bg-green-400/10">
                    {/* Corner guides */}
                    <div className="absolute top-0 left-0 w-4 h-4 border-t-2 border-l-2 border-green-400"></div>
                    <div className="absolute top-0 right-0 w-4 h-4 border-t-2 border-r-2 border-green-400"></div>
                    <div className="absolute bottom-0 left-0 w-4 h-4 border-b-2 border-l-2 border-green-400"></div>
                    <div className="absolute bottom-0 right-0 w-4 h-4 border-b-2 border-r-2 border-green-400"></div>
                    
                    {/* Center crosshair */}
                    <div className="absolute inset-0 flex items-center justify-center">
                      <div className="w-8 h-0.5 bg-green-400 opacity-60"></div>
                      <div className="absolute w-0.5 h-8 bg-green-400 opacity-60"></div>
                    </div>
                  </div>
                  
                  {/* Guidance text */}
                  <div className="absolute -bottom-8 left-1/2 transform -translate-x-1/2 whitespace-nowrap">
                    <div className="bg-black/70 text-green-400 px-2 py-1 rounded text-xs font-medium">
                      {scanningGuidance}
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Scanning tips */}
            <div className="bg-blue-900/30 border border-blue-600/30 rounded-lg p-3">
              <h4 className="text-xs font-semibold text-blue-200 mb-1">Scanning Tips:</h4>
              <ul className="text-xs text-blue-200 space-y-0.5">
                <li>• Hold 4-6 inches from camera</li>
                <li>• Keep barcode flat and centered</li>
                <li>• Ensure good lighting, avoid glare</li>
                <li>• Hold steady when guidance says "Good!"</li>
              </ul>
            </div>
            
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
      </div>
    </Modal>
  );
};
