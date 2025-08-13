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
  const [systemStatus, setSystemStatus] = useState<string>('Initializing...');
  const [cameraPermission, setCameraPermission] = useState<string>('checking');
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

  // Add debug message
  const addDebug = (message: string) => {
    const timestamp = new Date().toLocaleTimeString();
    const debugMsg = `${timestamp}: ${message}`;
    console.log(debugMsg);
    setDebugInfo(prev => [debugMsg, ...prev.slice(0, 9)]); // Keep last 10 entries
  };

  // Validate barcode format more strictly
  const isValidBarcodeFormat = (code: string): boolean => {
    // Remove any non-digit characters for validation
    const cleanCode = code.replace(/\D/g, '');
    
    // Check common barcode lengths
    const validLengths = [8, 12, 13, 14]; // EAN-8, UPC-A, EAN-13, etc.
    
    if (!validLengths.includes(cleanCode.length)) {
      return false;
    }
    
    // Basic check - should be mostly digits
    return cleanCode.length >= 8 && /^\d+$/.test(cleanCode);
  };

  // OPTIMIZED barcode detection with distance/focus guidance
  const handleBarcodeDetected = useCallback((result: any) => {
    // Prevent processing if we're already handling a detection
    if (isProcessingDetection) {
      return;
    }

    const code = result.codeResult.code;
    const confidence = result.codeResult.confidence || 0;
    const timestamp = Date.now();
    
    // Basic validation first
    if (!code || code.length < 7) {
      setScanningGuidance('Move closer to barcode');
      return;
    }

    // Format validation
    if (!isValidBarcodeFormat(code)) {
      addDebug(`Invalid format: "${code}"`);
      setScanningGuidance('Center barcode properly');
      return;
    }

    // Confidence-based guidance
    if (confidence < 15) {
      setScanningGuidance('Hold steady, focus...');
      addDebug(`Low confidence: ${code} (${confidence.toFixed(1)}%)`);
      return;
    } else if (confidence < 35) {
      setScanningGuidance('Getting better, hold steady');
      addDebug(`Medium confidence: ${code} (${confidence.toFixed(1)}%)`);
    } else {
      setScanningGuidance('Good! Hold position...');
      addDebug(`Good confidence: ${code} (${confidence.toFixed(1)}%)`);
    }

    // Add to recent detections with timestamp
    setRecentDetections(prev => {
      // Remove old detections (older than 2 seconds)
      const filtered = prev.filter(d => timestamp - d.timestamp < 2000);
      
      // Add new detection
      const updated = [...filtered, { code, confidence, timestamp }];
      
      // Check for stability - need 3 good readings of same code
      const sameCodeDetections = updated.filter(d => d.code === code);
      const goodConfidenceCount = sameCodeDetections.filter(d => d.confidence >= 35).length;
      
      if (goodConfidenceCount >= 2 && confidence >= 35) {
        addDebug(`✅ STABLE & CONFIDENT: "${code}" (${confidence.toFixed(1)}%)`);
        setScanningGuidance('Found! Processing...');
        
        // Set processing flag to prevent more detections
        setIsProcessingDetection(true);
        
        // Process the barcode after small delay
        setTimeout(() => {
          stopScanner();
          setLastScannedBarcode(code);
          lookupBarcode(code);
        }, 200);
        
        return []; // Clear detections
      } else {
        const progress = `${goodConfidenceCount}/2`;
        addDebug(`Tracking: "${code}" (${progress}) conf: ${confidence.toFixed(1)}%`);
        return updated;
      }
    });
  }, [isProcessingDetection]);

  // Check camera permissions
  const checkCameraPermission = async () => {
    try {
      addDebug('Checking camera permissions...');
      setCameraPermission('checking');
      
      const stream = await navigator.mediaDevices.getUserMedia({ video: true });
      addDebug('✅ Camera permission granted');
      setCameraPermission('granted');
      
      // Stop the test stream
      stream.getTracks().forEach(track => track.stop());
      return true;
    } catch (err) {
      addDebug(`❌ Camera permission failed: ${err}`);
      setCameraPermission('denied');
      setError(`Camera access denied: ${err}`);
      return false;
    }
  };

  const loadQuaggaJS = async (): Promise<boolean> => {
    return new Promise((resolve) => {
      if (window.Quagga) {
        addDebug('✅ QuaggaJS already loaded');
        resolve(true);
        return;
      }

      addDebug('Loading QuaggaJS from CDN...');
      const script = document.createElement('script');
      script.src = 'https://unpkg.com/quagga@0.12.1/dist/quagga.min.js';
      
      script.onload = () => {
        addDebug('✅ QuaggaJS loaded successfully');
        resolve(true);
      };
      
      script.onerror = () => {
        addDebug('❌ Failed to load QuaggaJS');
        setError('Failed to load barcode scanner library');
        resolve(false);
      };
      
      document.head.appendChild(script);
    });
  };

  const initializeScanner = async () => {
    if (!videoRef.current) {
      addDebug('❌ Video ref not available');
      setError('Video element not ready');
      return;
    }

    addDebug('Initializing scanner...');
    setSystemStatus('Initializing scanner...');
    setError(null);
    setDetectedProduct(null);
    setLastScannedBarcode('');
    setScanningGuidance('Position barcode in center');

    // Optimized config for better barcode detection
    const config = {
      inputStream: {
        name: "Live",
        type: "LiveStream", 
        target: videoRef.current,
        constraints: {
          width: { min: 640, ideal: 1280 }, // Higher resolution for better quality
          height: { min: 480, ideal: 720 },
          facingMode: "environment"
        }
      },
      locator: {
        patchSize: "medium", // Balance between speed and accuracy
        halfSample: false    // Don't downsample for better quality
      },
      numOfWorkers: 2,
      frequency: 8, // Moderate frequency for balance
      decoder: {
        readers: [
          "ean_reader",      // Most common product barcodes
          "ean_8_reader", 
          "upc_reader",
          "upc_e_reader",
          "code_128_reader"  // Common in logistics
        ],
        multiple: false
      },
      locate: true,
      area: {
        // Smaller, centered area for better focus - optimal scanning distance
        top: "25%",
        right: "25%", 
        left: "25%",
        bottom: "25%"
      }
    };

    addDebug('QuaggaJS config prepared (object contains DOM references)');

    window.Quagga.init(config, (err: any) => {
      if (err) {
        addDebug(`❌ QuaggaJS init failed: ${JSON.stringify(err)}`);
        setError(`Scanner initialization failed: ${err.name || err.message || 'Unknown error'}`);
        setSystemStatus('Failed to initialize');
        return;
      }

      addDebug('✅ QuaggaJS initialized successfully');
      
      try {
        window.Quagga.start();
        addDebug('✅ QuaggaJS started');
        
        // Set up event handlers
        window.Quagga.onDetected(handleBarcodeDetected);
        addDebug('✅ Detection handler attached');
        
        // Set scanning state AFTER everything is set up
        setIsScanning(true);
        setSystemStatus('Scanning...');

      } catch (startErr) {
        addDebug(`❌ QuaggaJS start failed: ${startErr}`);
        setError(`Scanner start failed: ${startErr}`);
        setSystemStatus('Failed to start');
      }
    });
  };

  const startScanner = useCallback(async () => {
    addDebug('=== STARTING SCANNER SEQUENCE ===');
    setSystemStatus('Checking camera...');
    
    // Step 1: Check camera permission
    const hasCamera = await checkCameraPermission();
    if (!hasCamera) return;
    
    // Step 2: Load QuaggaJS
    setSystemStatus('Loading scanner library...');
    const hasQuagga = await loadQuaggaJS();
    if (!hasQuagga) return;
    
    // Step 3: Wait a moment for everything to be ready
    setSystemStatus('Preparing scanner...');
    setTimeout(() => {
      initializeScanner();
    }, 500);
    
  }, []);

  const stopScanner = () => {
    addDebug('Stopping scanner...');
    
    if (window.Quagga && isScanning) {
      try {
        window.Quagga.stop();
        window.Quagga.offDetected(handleBarcodeDetected);
        addDebug('✅ Scanner stopped');
      } catch (err) {
        addDebug(`Error stopping scanner: ${err}`);
      }
    }
    setIsScanning(false);
    setSystemStatus('Stopped');
    setRecentDetections([]);
    setIsProcessingDetection(false);
    setScanningGuidance('Position barcode in center');
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
    setSystemStatus('Closed');
    setCameraPermission('checking');
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

  const handleRescan = () => {
    setDetectedProduct(null);
    setError(null);
    setRecentDetections([]);
    setIsProcessingDetection(false);
    setScanningGuidance('Position barcode in center');
    startScanner();
  };

  const handlePhotoInstead = () => {
    handleClose();
    onPhotoInstead();
  };

  // Test barcode manually
  const testBarcode = () => {
    const testCode = '012345678901'; // Test UPC
    addDebug(`🧪 MANUAL TEST: Testing with barcode ${testCode}`);
    lookupBarcode(testCode);
  };

  return (
    <Modal isOpen={isOpen} onClose={handleClose} title="Smart Barcode Scanner" size="lg">
      <div className="space-y-4">
        
        {/* System Status */}
        <div className="bg-slate-700 p-3 rounded-lg border border-slate-600">
          <div className="flex justify-between items-center mb-2">
            <h4 className="text-sm font-semibold text-slate-200">Scanner Status</h4>
            <span className={`px-2 py-1 rounded text-xs font-medium ${
              systemStatus === 'Scanning...' ? 'bg-green-900 text-green-200' :
              systemStatus.includes('Failed') ? 'bg-red-900 text-red-200' :
              'bg-amber-900 text-amber-200'
            }`}>
              {systemStatus}
            </span>
          </div>
          
          <div className="grid grid-cols-3 gap-2 text-xs">
            <div>Camera: <span className={`font-semibold ${
              cameraPermission === 'granted' ? 'text-green-400' :
              cameraPermission === 'denied' ? 'text-red-400' : 
              'text-amber-400'
            }`}>{cameraPermission}</span></div>
            <div>Library: <span className={`font-semibold ${
              window.Quagga ? 'text-green-400' : 'text-red-400'
            }`}>{window.Quagga ? 'ready' : 'loading'}</span></div>
            <div>Focus: <span className={`font-semibold ${
              isScanning ? 'text-green-400' : 'text-slate-400'
            }`}>{isScanning ? 'active' : 'inactive'}</span></div>
          </div>
        </div>

        {!detectedProduct && !isLookingUp && (
          <>
            <div className="relative w-full aspect-video bg-slate-900 rounded-lg overflow-hidden border border-slate-600">
              <div ref={videoRef} className="w-full h-full" />
              
              {/* Optimized scanning overlay - smaller, centered area */}
              <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                <div className="relative">
                  <div className="w-48 h-24 border-2 border-green-400 rounded-lg bg-green-400/10">
                    {/* Focus guides at corners */}
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
                  
                  {/* Distance guidance */}
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

            {/* Debug info panel - collapsible */}
            <details className="bg-slate-800 rounded-lg border border-slate-700">
              <summary className="p-3 cursor-pointer text-xs font-semibold text-slate-300 hover:text-slate-200">
                Debug Info {debugInfo.length > 0 && `(${debugInfo.length})`}
              </summary>
              <div className="px-3 pb-3 max-h-32 overflow-y-auto">
                <div className="space-y-1">
                  {debugInfo.length === 0 ? (
                    <div className="text-xs text-slate-500 italic">No debug info yet...</div>
                  ) : (
                    debugInfo.map((info, index) => (
                      <div key={index} className="text-xs font-mono text-slate-400 leading-tight">
                        {info}
                      </div>
                    ))
                  )}
                </div>
              </div>
            </details>
            
            <div className="grid grid-cols-2 gap-3">
              <Button onClick={testBarcode} variant="secondary" className="text-sm">
                🧪 Test API
              </Button>
              <Button onClick={handleRescan} variant="secondary" className="text-sm">
                🔄 Restart
              </Button>
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
      </div>
    </Modal>
  );
};
