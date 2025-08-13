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

  // ULTRA SENSITIVE barcode detection
  const handleBarcodeDetected = useCallback((result: any) => {
    if (!isScanning) {
      addDebug('Detection while not scanning - ignored');
      return;
    }

    const code = result.codeResult.code;
    const confidence = result.codeResult.confidence || 0;
    
    addDebug(`RAW DETECTION: "${code}" (confidence: ${confidence.toFixed(1)}%)`);

    // Accept ANYTHING that looks remotely like a barcode
    if (!code) {
      addDebug('Rejected: No code');
      return;
    }

    if (code.length < 3) {
      addDebug(`Rejected: Too short (${code.length} chars)`);
      return;
    }

    // Accept ANY confidence level for testing!
    addDebug(`✅ ACCEPTING: "${code}" (conf: ${confidence.toFixed(1)}%)`);
    
    stopScanner();
    setLastScannedBarcode(code);
    lookupBarcode(code);
  }, [isScanning]);

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

    const config = {
      inputStream: {
        name: "Live",
        type: "LiveStream", 
        target: videoRef.current,
        constraints: {
          width: { min: 320, ideal: 640 },
          height: { min: 240, ideal: 480 },
          facingMode: "environment"
        }
      },
      locator: {
        patchSize: "large",
        halfSample: false
      },
      numOfWorkers: 1, // Start with just 1 worker
      frequency: 5,    // Start slower to see if it helps
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
        top: "20%",
        right: "20%", 
        left: "20%",
        bottom: "20%"
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
        setIsScanning(true);
        setSystemStatus('Scanning...');
        
        // Set up event handlers
        window.Quagga.onDetected(handleBarcodeDetected);
        addDebug('✅ Detection handler attached');

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
    <Modal isOpen={isOpen} onClose={handleClose} title="Barcode Scanner Debug Mode" size="lg">
      <div className="space-y-4">
        
        {/* System Status */}
        <div className="bg-slate-700 p-3 rounded-lg border border-slate-600">
          <div className="flex justify-between items-center mb-2">
            <h4 className="text-sm font-semibold text-slate-200">System Status</h4>
            <span className={`px-2 py-1 rounded text-xs font-medium ${
              systemStatus === 'Scanning...' ? 'bg-green-900 text-green-200' :
              systemStatus.includes('Failed') ? 'bg-red-900 text-red-200' :
              'bg-amber-900 text-amber-200'
            }`}>
              {systemStatus}
            </span>
          </div>
          
          <div className="grid grid-cols-2 gap-2 text-xs">
            <div>Camera: <span className={`font-semibold ${
              cameraPermission === 'granted' ? 'text-green-400' :
              cameraPermission === 'denied' ? 'text-red-400' : 
              'text-amber-400'
            }`}>{cameraPermission}</span></div>
            <div>QuaggaJS: <span className={`font-semibold ${
              window.Quagga ? 'text-green-400' : 'text-red-400'
            }`}>{window.Quagga ? 'loaded' : 'not loaded'}</span></div>
            <div>Scanning: <span className={`font-semibold ${
              isScanning ? 'text-green-400' : 'text-slate-400'
            }`}>{isScanning ? 'active' : 'inactive'}</span></div>
          </div>
        </div>

        {!detectedProduct && !isLookingUp && (
          <>
            <div className="relative w-full aspect-video bg-slate-900 rounded-lg overflow-hidden border border-slate-600">
              <div ref={videoRef} className="w-full h-full" />
              
              {/* Scanning overlay */}
              <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                <div className="relative">
                  <div className="w-48 h-24 border-2 border-green-400 border-dashed rounded-lg bg-green-400/10">
                    <div className="absolute top-1/2 left-2 right-2 h-0.5 bg-green-400 opacity-75 animate-pulse" />
                  </div>
                </div>
              </div>
              
              <div className="absolute bottom-4 left-4 right-4 text-center">
                <p className="text-green-400 text-sm font-medium bg-black/60 px-3 py-1 rounded-md">
                  {systemStatus}
                </p>
              </div>
            </div>

            {/* Debug info panel */}
            <div className="bg-slate-800 p-3 rounded-lg border border-slate-700 max-h-48 overflow-y-auto">
              <div className="flex justify-between items-center mb-2">
                <h4 className="text-xs font-semibold text-slate-300">Debug Log</h4>
                <button 
                  onClick={() => setDebugInfo([])}
                  className="text-xs text-slate-500 hover:text-slate-300"
                >
                  Clear
                </button>
              </div>
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
            
            <div className="grid grid-cols-2 gap-3">
              <Button onClick={testBarcode} variant="secondary" className="text-sm">
                🧪 Test Lookup
              </Button>
              <Button onClick={handleRescan} variant="secondary" className="text-sm">
                🔄 Restart Scanner
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
