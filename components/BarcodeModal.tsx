import React, { useState, useRef, useEffect, useCallback } from 'react';
import { Modal, Button, Spinner, BarcodeIcon, CheckIcon, XIcon, CameraIcon } from './ui';

// TS global for Quagga
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

  // UI state
  const [isScanning, setIsScanning] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [detectedProduct, setDetectedProduct] = useState<ProductInfo | null>(null);
  const [isLookingUp, setIsLookingUp] = useState(false);
  const [lastScannedBarcode, setLastScannedBarcode] = useState<string>('');
  const [debugInfo, setDebugInfo] = useState<string[]>([]);
  const [systemStatus, setSystemStatus] = useState<string>('Initializing...');
  const [cameraPermission, setCameraPermission] = useState<'checking'|'granted'|'denied'>('checking');

  // --- Refs to avoid handler identity churn & race conditions ---
  const isProcessingRef = useRef(false);
  const recentDetectionsRef = useRef<string[]>([]);
  const streamRef = useRef<MediaStream | null>(null);
  const quaggaLoadedRef = useRef(false);
  const mountedRef = useRef(false);

  // ---------- helpers ----------
  const addDebug = (message: string) => {
    const timestamp = new Date().toLocaleTimeString();
    const msg = `${timestamp}: ${message}`;
    console.log(msg);
    setDebugInfo(prev => [msg, ...prev.slice(0, 49)]); // keep 50
  };

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

  const lookupBarcode = async (barcode: string) => {
    setIsLookingUp(true);
    setError(null);
    try {
      const res = await fetch(`https://world.openfoodfacts.org/api/v2/product/${barcode}.json`);
      const data = await res.json();
      if (data.status === 1 && data.product && data.product.product_name) {
        setDetectedProduct({
          name: data.product.product_name,
          brand: data.product.brands || '',
          category: autoCategorize(data.product.categories || ''),
          weight: data.product.quantity || '',
          barcode
        });
      } else {
        setError(`Product not found in database. Barcode: ${barcode}`);
      }
    } catch {
      setError('Failed to lookup product. Please try again or enter manually.');
    } finally {
      setIsLookingUp(false);
    }
  };

  // ---------- camera / quagga ----------
  const checkCameraPermission = async () => {
    try {
      addDebug('Checking camera permissions…');
      setCameraPermission('checking');
      const test = await navigator.mediaDevices.getUserMedia({ video: true });
      test.getTracks().forEach(t => t.stop());
      setCameraPermission('granted');
      addDebug('✅ Camera permission granted');
      return true;
    } catch (err) {
      addDebug(`❌ Camera permission failed: ${err}`);
      setCameraPermission('denied');
      setError('Camera access denied.');
      return false;
    }
  };

  // Try to pick the rear camera + solid defaults (720p/30fps)
  const getBestConstraints = async (): Promise<MediaTrackConstraints> => {
    const base: MediaTrackConstraints = {
      width: { ideal: 1280, min: 640 },
      height: { ideal: 720, min: 360 },
      frameRate: { ideal: 30, min: 15 },
      aspectRatio: { ideal: 16 / 9 },
      focusMode: 'continuous' as any // supported in some browsers
    };

    try {
      const devices = await navigator.mediaDevices.enumerateDevices();
      const videoInputs = devices.filter(d => d.kind === 'videoinput');
      const rear = videoInputs.find(d =>
        /back|rear|environment/i.test(d.label)
      );
      if (rear?.deviceId) {
        return { ...base, deviceId: { exact: rear.deviceId } };
      }
    } catch { /* fall back */ }

    return { ...base, facingMode: { ideal: 'environment' } };
  };

  const applyTrackTuning = async (stream: MediaStream) => {
    const track = stream.getVideoTracks()[0];
    if (!track) return;

    const caps = (track.getCapabilities?.() || {}) as any;
    const settings = track.getSettings?.() || {};

    // modest zoom helps scanners a lot on modern phones
    if (caps.zoom && settings.zoom === undefined) {
      try {
        const target = Math.min(caps.zoom.max, Math.max(caps.zoom.min, 2));
        await track.applyConstraints({ advanced: [{ zoom: target }] as any });
        addDebug(`🔍 Applied zoom: ${target}`);
      } catch {/* ignore */}
    }

    // optional torch if available (useful in dim light)
    if (caps.torch) {
      try {
        await track.applyConstraints({ advanced: [{ torch: false }] as any }); // start off
        addDebug('💡 Torch available (off)');
      } catch {/* ignore */}
    }
  };

  const loadQuagga = async (): Promise<boolean> => {
    if (quaggaLoadedRef.current && window.Quagga) return true;

    return new Promise(resolve => {
      addDebug('Loading Quagga2 from CDN…');
      const s = document.createElement('script');
      s.src = 'https://unpkg.com/@ericblade/quagga2@2.0.3/dist/quagga.min.js';
      s.async = true;
      s.onload = () => {
        quaggaLoadedRef.current = true;
        addDebug('✅ Quagga2 loaded');
        resolve(true);
      };
      s.onerror = () => {
        setError('Failed to load barcode scanner library.');
        addDebug('❌ Failed to load Quagga2');
        resolve(false);
      };
      document.head.appendChild(s);
    });
  };

  // stable detection handler (no deps)
  const onDetected = useCallback((result: any) => {
    const code = result?.codeResult?.code;
    const conf = result?.codeResult?.confidence ?? 0;

    if (!code) {
      addDebug('Rejected: No code');
      return;
    }
    if (code.length < 6) {
      addDebug(`Rejected: Too short (${code.length})`);
      return;
    }
    if (conf < 40) {
      addDebug(`Rejected: Low confidence (${conf.toFixed(1)}%)`);
      return;
    }

    if (isProcessingRef.current) {
      // already handling a detection
      return;
    }

    // stability: need 2 same codes among last 3
    const updated = [code, ...recentDetectionsRef.current].slice(0, 3);
    recentDetectionsRef.current = updated;
    const count = updated.filter(c => c === code).length;

    addDebug(`Detection: "${code}" (conf ${conf.toFixed(1)}%) [${count}/2]`);

    if (count >= 2) {
      addDebug(`✅ STABLE DETECTION: "${code}"`);
      isProcessingRef.current = true;

      // stop scanner after a tiny delay to flush frames
      setTimeout(async () => {
        try {
          if (window.Quagga) window.Quagga.stop();
        } catch {}
        setIsScanning(false);
        setLastScannedBarcode(code);
        await lookupBarcode(code);
      }, 80);
    }
  }, []); // stable

  const onProcessed = useCallback((res: any) => {
    // optional: hook for draw/debug; we just log occasional status
    if (!res) return;
    // Throttle logs
    if (Math.random() < 0.02) addDebug('…processing frames');
  }, []);

  const initializeScanner = async () => {
    if (!videoRef.current) {
      setError('Video element not ready');
      addDebug('❌ Video ref not available');
      return;
    }

    setError(null);
    setDetectedProduct(null);
    setLastScannedBarcode('');
    recentDetectionsRef.current = [];
    isProcessingRef.current = false;

    addDebug('Initializing scanner…');
    setSystemStatus('Initializing scanner…');

    // Build constraints and pre-open a stream so we can tune focus/zoom
    const constraints = await getBestConstraints();
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: constraints, audio: false });
      streamRef.current = stream;
      await applyTrackTuning(stream);
    } catch (err) {
      setError('Unable to start camera with required settings.');
      addDebug(`❌ getUserMedia failed: ${err}`);
      return;
    }

    // Quagga config
    const config = {
      inputStream: {
        name: 'Live',
        type: 'LiveStream',
        target: videoRef.current,
        constraints, // pass same tuned constraints
        area: { // focus center box
          top: '20%',
          right: '20%',
          left: '20%',
          bottom: '20%'
        }
      },
      locator: {
        patchSize: 'medium', // good balance; try "large" for worse cams, "x-large" for tiny codes
        halfSample: true
      },
      numOfWorkers: Math.max(1, (navigator as any).hardwareConcurrency ? ((navigator as any).hardwareConcurrency - 1) : 1),
      frequency: 10, // process 10x/second
      decoder: {
        readers: [
          'ean_reader',      // EAN-13
          'ean_8_reader',    // EAN-8
          'upc_reader',      // UPC-A
          'upc_e_reader',    // UPC-E
          'code_128_reader'  // backup for logistics labels
        ],
        multiple: false
      },
      locate: true
    };

    // init
    window.Quagga.init(config, (err: any) => {
      if (err) {
        addDebug(`❌ Quagga init failed: ${err?.message || err}`);
        setError(`Scanner initialization failed.`);
        setSystemStatus('Failed to initialize');
        return;
      }
      try {
        window.Quagga.onDetected(onDetected);
        window.Quagga.onProcessed(onProcessed);
        window.Quagga.start();
        setIsScanning(true);
        setSystemStatus('Scanning…');
        addDebug('✅ Quagga started & handlers attached');
      } catch (startErr) {
        addDebug(`❌ Quagga start failed: ${startErr}`);
        setError('Scanner start failed.');
        setSystemStatus('Failed to start');
      }
    });
  };

  const startScanner = useCallback(async () => {
    addDebug('=== START SCANNER SEQUENCE ===');
    setSystemStatus('Checking camera…');
    const ok = await checkCameraPermission();
    if (!ok) return;

    setSystemStatus('Loading scanner library…');
    const loaded = await loadQuagga();
    if (!loaded) return;

    setSystemStatus('Preparing scanner…');
    setTimeout(() => {
      if (mountedRef.current) initializeScanner();
    }, 200);
  }, [initializeScanner]);

  const stopScanner = useCallback(() => {
    addDebug('Stopping scanner…');
    try {
      if (window.Quagga) {
        window.Quagga.offDetected(onDetected);
        window.Quagga.offProcessed(onProcessed);
        window.Quagga.stop();
      }
    } catch {}
    setIsScanning(false);
    setSystemStatus('Stopped');
    // stop any manual stream we opened
    try {
      streamRef.current?.getTracks().forEach(t => t.stop());
    } catch {}
    streamRef.current = null;
    recentDetectionsRef.current = [];
    isProcessingRef.current = false;
  }, [onDetected, onProcessed]);

  // ---------- lifecycle ----------
  useEffect(() => {
    mountedRef.current = true;
    if (isOpen && !detectedProduct && !isLookingUp) {
      startScanner();
    }
    return () => {
      mountedRef.current = false;
      stopScanner();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen]);

  // ---------- UI handlers ----------
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
    recentDetectionsRef.current = [];
    isProcessingRef.current = false;
    startScanner();
  };

  const handlePhotoInstead = () => {
    handleClose();
    onPhotoInstead();
  };

  const testBarcode = () => {
    const testCode = '012345678901';
    addDebug(`🧪 MANUAL TEST: ${testCode}`);
    lookupBarcode(testCode);
  };

  // ---------- render ----------
  return (
    <Modal isOpen={isOpen} onClose={handleClose} title="Barcode Scanner Debug Mode" size="lg">
      <div className="space-y-4">
        {/* System Status */}
        <div className="bg-slate-700 p-3 rounded-lg border border-slate-600">
          <div className="flex justify-between items-center mb-2">
            <h4 className="text-sm font-semibold text-slate-200">System Status</h4>
            <span className={`px-2 py-1 rounded text-xs font-medium ${
              systemStatus.includes('Scanning') ? 'bg-green-900 text-green-200' :
              systemStatus.includes('Failed') ? 'bg-red-900 text-red-200' :
              'bg-amber-900 text-amber-200'
            }`}>
              {systemStatus}
            </span>
          </div>
          <div className="grid grid-cols-2 gap-2 text-xs">
            <div>Camera: <span className={`font-semibold ${
              cameraPermission === 'granted' ? 'text-green-400' :
              cameraPermission === 'denied' ? 'text-red-400' : 'text-amber-400'
            }`}>{cameraPermission}</span></div>
            <div>Quagga: <span className={`font-semibold ${
              (window as any).Quagga ? 'text-green-400' : 'text-red-400'
            }`}>{(window as any).Quagga ? 'loaded' : 'not loaded'}</span></div>
            <div>Processing: <span className="font-semibold text-slate-400">
              {isProcessingRef.current ? 'active' : 'inactive'}
            </span></div>
          </div>
        </div>

        {!detectedProduct && !isLookingUp && (
          <>
            <div className="relative w-full aspect-video bg-slate-900 rounded-lg overflow-hidden border border-slate-600">
              <div ref={videoRef} className="w-full h-full" />
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

            {/* Debug */}
            <div className="bg-slate-800 p-3 rounded-lg border border-slate-700 max-h-48 overflow-y-auto">
              <div className="flex justify-between items-center mb-2">
                <h4 className="text-xs font-semibold text-slate-300">Debug Log</h4>
                <button onClick={() => setDebugInfo([])} className="text-xs text-slate-500 hover:text-slate-300">
                  Clear
                </button>
              </div>
              <div className="space-y-1">
                {debugInfo.length === 0 ? (
                  <div className="text-xs text-slate-500 italic">No debug info yet…</div>
                ) : (
                  debugInfo.map((info, i) => (
                    <div key={i} className="text-xs font-mono text-slate-400 leading-tight">{info}</div>
                  ))
                )}
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <Button onClick={testBarcode} variant="secondary" className="text-sm">🧪 Test Lookup</Button>
              <Button onClick={handleRescan} variant="secondary" className="text-sm">🔄 Restart Scanner</Button>
            </div>

            <div className="flex gap-3">
              <Button onClick={handleClose} variant="secondary" className="flex-1"><XIcon /> Cancel</Button>
              <Button onClick={handlePhotoInstead} variant="secondary" className="flex-1"><CameraIcon /> Photo Instead</Button>
            </div>
          </>
        )}

        {isLookingUp && (
          <div className="flex flex-col items-center justify-center py-8 space-y-4">
            <Spinner className="w-8 h-8" />
            <p className="text-slate-300 font-semibold">Looking up product…</p>
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
                <div><span className="font-medium text-slate-300">Name:</span>
                  <span className="ml-2 text-slate-100">{detectedProduct.name}</span></div>
                {detectedProduct.brand && <div><span className="font-medium text-slate-300">Brand:</span>
                  <span className="ml-2 text-slate-100">{detectedProduct.brand}</span></div>}
                {detectedProduct.weight && <div><span className="font-medium text-slate-300">Weight:</span>
                  <span className="ml-2 text-slate-100">{detectedProduct.weight}</span></div>}
                <div><span className="font-medium text-slate-300">Category:</span>
                  <span className="ml-2 text-slate-100">{detectedProduct.category}</span></div>
                <div><span className="font-medium text-slate-300">Barcode:</span>
                  <span className="ml-2 text-slate-100 font-mono">{detectedProduct.barcode}</span></div>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <Button onClick={handleConfirmProduct} variant="primary" className="flex-1"><CheckIcon /> Yes, Correct</Button>
              <Button onClick={handleRescan} variant="secondary" className="flex-1"><BarcodeIcon /> No, Rescan</Button>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <Button onClick={handlePhotoInstead} variant="secondary" className="flex-1"><CameraIcon /> Photo Instead</Button>
              <Button onClick={handleClose} variant="secondary" className="flex-1"><XIcon /> Cancel</Button>
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
              <Button onClick={handleRescan} variant="secondary" className="flex-1"><BarcodeIcon /> Try Again</Button>
              <Button onClick={handlePhotoInstead} variant="secondary" className="flex-1"><CameraIcon /> Photo Instead</Button>
            </div>
            <Button onClick={handleClose} variant="secondary" className="w-full"><XIcon /> Cancel & Enter Manually</Button>
          </div>
        )}
      </div>
    </Modal>
  );
};
