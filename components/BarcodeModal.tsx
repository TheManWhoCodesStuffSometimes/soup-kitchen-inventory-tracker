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
  
  // CRITICAL: These flags prevent the infinite loading loop that keeps happening
  // DO NOT REMOVE OR MODIFY WITHOUT UNDERSTANDING THE RACE CONDITIONS
  const [isLookingUp, setIsLookingUp] = useState(false);
  const [hasLookedUp, setHasLookedUp] = useState(false); // NEW: Prevents re-lookup of same barcode
  const [currentLookupBarcode, setCurrentLookupBarcode] = useState<string | null>(null); // NEW: Track what we're looking up
  
  const [recentDetections, setRecentDetections] = useState<{code: string, confidence: number, timestamp: number}[]>([]);
  const [isProcessingDetection, setIsProcessingDetection] = useState(false);
  const [scanningGuidance, setScanningGuidance] = useState<string>('Position barcode in center');
  const [modalState, setModalState] = useState<'scanning' | 'looking-up' | 'product-found' | 'error'>('scanning');

  // Parse product weight and convert to pounds (rounded to 2 decimal places)
  // AUTOMATIC ROUNDING FIX: Always rounds to 2 decimal places to prevent validation errors
  const parseProductWeight = (quantityString: string): number => {
    if (!quantityString || typeof quantityString !== 'string') return 0;

    const quantity = quantityString.toLowerCase().trim();
    const match = quantity.match(/(\d+\.?\d*)\s*([a-z]+)/);
    if (!match) return 0;

    const value = parseFloat(match[1]);
    const unit = match[2];

    let weightInPounds = 0;
    
    switch (unit) {
      case 'g':
      case 'gram':
      case 'grams':
        weightInPounds = value * 0.00220462;
        break;
      case 'kg':
      case 'kilogram': 
      case 'kilograms':
        weightInPounds = value * 2.20462;
        break;
      case 'oz':
      case 'ounce':
      case 'ounces':
        weightInPounds = value * 0.0625;
        break;
      case 'lb':
      case 'lbs':
      case 'pound':
      case 'pounds':
        weightInPounds = value;
        break;
      case 'ml':
      case 'milliliter':
      case 'milliliters':
        weightInPounds = value * 0.00220462;
        break;
      case 'l':
      case 'liter':
      case 'liters':
        weightInPounds = value * 2.20462;
        break;
      case 'fl':
      case 'floz':
        weightInPounds = value * 0.0652;
        break;
      default:
        return 0;
    }

    // CRITICAL ROUNDING FIX: Always round to 2 decimal places
    // This prevents validation errors from overly precise decimals like 0.1366844
    // Math.round(x * 100) / 100 ensures exactly 2 decimal places
    const roundedWeight = Math.round(weightInPounds * 100) / 100;
    
    console.log(`📏 Weight conversion: ${quantityString} → ${weightInPounds} → ${roundedWeight} lbs`);
    
    return roundedWeight;
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

  // CRITICAL FUNCTION: This is where the infinite loop bug keeps happening!
  // The issue was that multiple calls could happen simultaneously and state checks weren't comprehensive
  // DO NOT MODIFY without understanding these race conditions:
  const lookupBarcode = async (barcode: string) => {
    console.log('🔍 lookupBarcode called with:', barcode);
    console.log('🔍 Current state - isLookingUp:', isLookingUp, 'hasLookedUp:', hasLookedUp, 'modalState:', modalState, 'currentLookupBarcode:', currentLookupBarcode);
    
    // COMPREHENSIVE PREVENTION: Check ALL conditions that should prevent lookup
    // This prevents the infinite loop by being very explicit about when NOT to run
    if (
      isLookingUp ||                           // Already looking up something
      hasLookedUp ||                           // Already completed a lookup in this session
      modalState === 'looking-up' ||           // UI is in lookup state
      modalState === 'product-found' ||        // Already found a product
      modalState === 'error' ||               // In error state
      currentLookupBarcode === barcode ||      // Already looking up this exact barcode
      currentLookupBarcode !== null            // Looking up any barcode
    ) {
      console.log('🚫 Lookup prevented - conditions not met');
      return;
    }
    
    console.log('✅ Starting lookup for barcode:', barcode);
    
    // SET ALL FLAGS IMMEDIATELY to prevent race conditions
    setIsLookingUp(true);
    setHasLookedUp(true);  // Mark as "has attempted lookup" immediately
    setCurrentLookupBarcode(barcode);
    setModalState('looking-up');
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
        console.log('✅ Product found:', productInfo);
        setDetectedProduct(productInfo);
        setModalState('product-found');
      } else {
        console.log('❌ Product not found in database');
        setError(`Product not found in database. Barcode: ${barcode}`);
        setModalState('error');
      }
    } catch (err) {
      console.error('💥 Lookup error:', err);
      setError('Failed to lookup product. Please try again or enter manually.');
      setModalState('error');
    } finally {
      // IMPORTANT: Only clear isLookingUp and currentLookupBarcode, but keep hasLookedUp=true
      // This prevents multiple lookups while allowing the user to restart if needed
      setIsLookingUp(false);
      setCurrentLookupBarcode(null);
      setIsProcessingDetection(false);
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
    // CRITICAL: Only process if we're in scanning mode and haven't looked up yet
    // This prevents detection from continuing after we've already found something
    if (modalState !== 'scanning' || isProcessingDetection || isLookingUp || hasLookedUp) {
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
      
      // Add new detection
      const updated = [...filtered, { code, confidence: 100, timestamp }];
      
      // Check for 3 consistent readings of the same code
      const sameCodeDetections = updated.filter(d => d.code === code);
      
      if (sameCodeDetections.length >= 3 && !hasLookedUp) { // ADDED: Check hasLookedUp here too
        console.log('🎯 Barcode detection complete:', code);
        setScanningGuidance('Found! Processing...');
        setIsProcessingDetection(true);
        
        // Stop scanner and lookup with delay
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
    
  }, [modalState, isProcessingDetection, isLookingUp, hasLookedUp]); // ADDED hasLookedUp dependency

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
    if (!videoRef.current || modalState !== 'scanning') {
      return;
    }

    setError(null);
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
      frequency: 15,
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
    if (modalState !== 'scanning') return;
    
    const hasCamera = await checkCameraPermission();
    if (!hasCamera) return;
    
    const hasQuagga = await loadQuaggaJS();
    if (!hasQuagga) return;
    
    setTimeout(() => {
      initializeScanner();
    }, 500);
  }, [modalState]);

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

  // CRITICAL FUNCTION: This is the "clean restart" that resets ALL the flags
  // This is what allows the user to try scanning again after an error or success
  const handleRescan = () => {
    console.log('🔄 FULL RESCAN - Resetting all flags');
    stopScanner();
    
    // RESET ALL STATE - This is crucial for preventing the loop
    setDetectedProduct(null);
    setError(null);
    setRecentDetections([]);
    setIsProcessingDetection(false);
    setIsLookingUp(false);
    setHasLookedUp(false);           // CRITICAL: Reset this flag
    setCurrentLookupBarcode(null);   // CRITICAL: Reset this flag
    setModalState('scanning');
    setScanningGuidance('Position barcode in center');
    
    // Give time for cleanup before restarting
    setTimeout(() => {
      startScanner();
    }, 100);
  };

  // Initialize modal when opened
  useEffect(() => {
    if (isOpen && modalState === 'scanning') {
      startScanner();
    }
    
    return () => {
      stopScanner();
    };
  }, [isOpen, startScanner]);

  // CRITICAL: Reset modal state when closed/opened - this prevents state leakage between sessions
  useEffect(() => {
    if (isOpen) {
      console.log('🔄 Modal opened - resetting all state');
      setModalState('scanning');
      setDetectedProduct(null);
      setError(null);
      setIsLookingUp(false);
      setHasLookedUp(false);           // RESET: Prevents previous session from affecting new one
      setCurrentLookupBarcode(null);   // RESET: Clear any previous lookup tracking
      setRecentDetections([]);
      setIsProcessingDetection(false);
      setScanningGuidance('Position barcode in center');
    }
  }, [isOpen]);

  const handleClose = () => {
    stopScanner();
    
    // FULL RESET on close - prevents any state from leaking to next session
    setDetectedProduct(null);
    setError(null);
    setIsLookingUp(false);
    setHasLookedUp(false);
    setCurrentLookupBarcode(null);
    setRecentDetections([]);
    setIsProcessingDetection(false);
    setModalState('scanning');
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
        {modalState === 'scanning' && (
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

        {modalState === 'looking-up' && (
          <div className="flex flex-col items-center justify-center py-8 space-y-4">
            <Spinner className="w-8 h-8" />
            <p className="text-slate-300 font-semibold">Looking up product...</p>
          </div>
        )}

        {modalState === 'product-found' && detectedProduct && (
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

        {modalState === 'error' && error && (
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
