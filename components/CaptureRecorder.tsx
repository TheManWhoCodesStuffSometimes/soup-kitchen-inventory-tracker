import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Button, Spinner } from './ui';
import { DONORS } from '../constants';
import {
  createSession,
  finalizeSession,
  uploadPhoto,
  createItem,
  type SessionRow,
} from '../services/apiClient';

interface CaptureRecorderProps {
  onExit: () => void;
}

interface PendingPhoto {
  id: string;            // local id (random)
  thumbnail: string;     // object URL for preview
  url: string | null;    // blob URL once uploaded
  uploading: boolean;
  error: string | null;
}

const DONOR_OPTIONS = DONORS.filter(d => d !== 'custom');

export const CaptureRecorder: React.FC<CaptureRecorderProps> = ({ onExit }) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const streamRef = useRef<MediaStream | null>(null);

  const [session, setSession] = useState<SessionRow | null>(null);
  const [sessionError, setSessionError] = useState<string | null>(null);
  const [cameraError, setCameraError] = useState<string | null>(null);

  const [donorName, setDonorName] = useState<string>('');
  const [customDonor, setCustomDonor] = useState<string>('');
  const [donorPickerOpen, setDonorPickerOpen] = useState<boolean>(true);

  const [pendingPhotos, setPendingPhotos] = useState<PendingPhoto[]>([]);
  const [savingItem, setSavingItem] = useState(false);
  const [itemsRecorded, setItemsRecorded] = useState(0);
  const [endingSession, setEndingSession] = useState(false);
  const [toast, setToast] = useState<string | null>(null);

  // --- Session lifecycle ---
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const s = await createSession();
        if (!cancelled) setSession(s);
      } catch (err) {
        if (!cancelled) setSessionError(err instanceof Error ? err.message : 'Failed to start session');
      }
    })();
    return () => { cancelled = true; };
  }, []);

  // --- Camera lifecycle ---
  const startCamera = useCallback(async () => {
    setCameraError(null);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: { ideal: 'environment' },
          width: { ideal: 1920, max: 1920 },
          height: { ideal: 1080, max: 1080 },
        },
        audio: false,
      });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play().catch(() => { /* autoplay may need a tap */ });
      }
    } catch (err) {
      setCameraError(err instanceof Error ? err.message : 'Camera unavailable');
    }
  }, []);

  useEffect(() => {
    if (session && !donorPickerOpen) {
      startCamera();
    }
    return () => {
      streamRef.current?.getTracks().forEach(t => t.stop());
      streamRef.current = null;
    };
  }, [session, donorPickerOpen, startCamera]);

  // Cleanup pending thumbnail URLs on unmount
  useEffect(() => {
    return () => {
      setPendingPhotos(prev => {
        prev.forEach(p => URL.revokeObjectURL(p.thumbnail));
        return prev;
      });
    };
  }, []);

  // --- Photo capture ---
  const handleShutter = useCallback(async () => {
    if (!session) return;
    if (!videoRef.current || !canvasRef.current) return;

    const video = videoRef.current;
    const canvas = canvasRef.current;
    const w = video.videoWidth || 1280;
    const h = video.videoHeight || 720;
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.drawImage(video, 0, 0, w, h);

    canvas.toBlob(async (blob) => {
      if (!blob) return;
      const localId = Math.random().toString(36).slice(2, 10);
      const thumbnail = URL.createObjectURL(blob);
      setPendingPhotos(prev => [...prev, { id: localId, thumbnail, url: null, uploading: true, error: null }]);
      try {
        const url = await uploadPhoto(blob, session.id);
        setPendingPhotos(prev => prev.map(p => p.id === localId ? { ...p, url, uploading: false } : p));
      } catch (err) {
        setPendingPhotos(prev => prev.map(p => p.id === localId ? { ...p, uploading: false, error: err instanceof Error ? err.message : 'upload failed' } : p));
      }
    }, 'image/jpeg', 0.9);
  }, [session]);

  // --- Next item ---
  const canSaveItem = pendingPhotos.length > 0
    && pendingPhotos.every(p => !p.uploading)
    && pendingPhotos.some(p => p.url);

  const effectiveDonor = donorName === 'custom' ? '' : donorName;
  const effectiveCustom = donorName === 'custom' ? customDonor : '';

  const handleNextItem = useCallback(async () => {
    if (!session || !canSaveItem) return;
    if (!effectiveDonor && !effectiveCustom) {
      setToast('Pick a donor before saving an item');
      setTimeout(() => setToast(null), 3000);
      return;
    }
    setSavingItem(true);
    try {
      const urls = pendingPhotos.filter(p => !!p.url).map(p => p.url as string);
      await createItem({
        sessionId: session.id,
        donorName: effectiveDonor || (effectiveCustom ? 'custom' : undefined),
        donorCustom: effectiveCustom || undefined,
        photoUrls: urls,
      });
      pendingPhotos.forEach(p => URL.revokeObjectURL(p.thumbnail));
      setPendingPhotos([]);
      setItemsRecorded(n => n + 1);
      setToast('Item saved, processing in background');
      setTimeout(() => setToast(null), 2000);
    } catch (err) {
      setToast(err instanceof Error ? err.message : 'Save failed');
      setTimeout(() => setToast(null), 4000);
    } finally {
      setSavingItem(false);
    }
  }, [session, pendingPhotos, canSaveItem, effectiveDonor, effectiveCustom]);

  // --- Discard current item's photos ---
  const handleDiscard = useCallback(() => {
    pendingPhotos.forEach(p => URL.revokeObjectURL(p.thumbnail));
    setPendingPhotos([]);
  }, [pendingPhotos]);

  const handleRemovePhoto = useCallback((id: string) => {
    setPendingPhotos(prev => {
      const target = prev.find(p => p.id === id);
      if (target) URL.revokeObjectURL(target.thumbnail);
      return prev.filter(p => p.id !== id);
    });
  }, []);

  // --- End session ---
  const handleEndSession = useCallback(async () => {
    if (!session) return;
    if (pendingPhotos.length > 0) {
      const ok = window.confirm('You have unsaved photos. Discard them and end session?');
      if (!ok) return;
    }
    setEndingSession(true);
    try {
      await finalizeSession(session.id);
      streamRef.current?.getTracks().forEach(t => t.stop());
      onExit();
    } catch (err) {
      setToast(err instanceof Error ? err.message : 'Could not end session');
      setTimeout(() => setToast(null), 4000);
      setEndingSession(false);
    }
  }, [session, pendingPhotos, onExit]);

  // --- Donor picker ---
  if (sessionError) {
    return (
      <div className="min-h-screen bg-slate-900 flex flex-col items-center justify-center p-6 text-center">
        <p className="text-red-300 mb-4">{sessionError}</p>
        <Button onClick={onExit} variant="secondary">Back</Button>
      </div>
    );
  }

  if (!session) {
    return (
      <div className="min-h-screen bg-slate-900 flex items-center justify-center">
        <Spinner className="w-8 h-8" />
      </div>
    );
  }

  if (donorPickerOpen) {
    return (
      <div className="min-h-screen bg-slate-900 flex flex-col p-4">
        <div className="flex items-center justify-between mb-6">
          <Button onClick={onExit} variant="secondary">← Back</Button>
          <h2 className="text-lg font-bold text-slate-100">Pick donor</h2>
          <div className="w-16" />
        </div>
        <p className="text-sm text-slate-400 text-center mb-4">
          You can change this anytime during capture.
        </p>
        <div className="grid grid-cols-2 gap-3 max-w-md mx-auto w-full">
          {DONOR_OPTIONS.map(d => (
            <button
              key={d}
              onClick={() => { setDonorName(d); setCustomDonor(''); setDonorPickerOpen(false); }}
              className={`min-h-[64px] rounded-lg border-2 px-3 py-2 text-sm font-semibold touch-manipulation transition ${
                donorName === d
                  ? 'border-amber-500 bg-amber-900/30 text-amber-200'
                  : 'border-slate-700 bg-slate-800 text-slate-200 hover:border-slate-500'
              }`}
            >
              {d}
            </button>
          ))}
          <button
            onClick={() => { setDonorName('custom'); setDonorPickerOpen(false); }}
            className="min-h-[64px] rounded-lg border-2 border-dashed border-slate-600 bg-slate-800 text-slate-300 px-3 py-2 text-sm font-semibold touch-manipulation hover:border-amber-500 col-span-2"
          >
            Custom donor
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-black flex flex-col">
      <canvas ref={canvasRef} className="hidden" />

      {/* Top bar */}
      <div className="bg-slate-900/95 border-b border-slate-700 px-3 py-2 flex items-center gap-2 text-sm">
        <button
          onClick={() => setDonorPickerOpen(true)}
          className="flex-1 min-h-[44px] px-3 rounded-md bg-slate-800 border border-slate-700 text-left text-slate-200 truncate touch-manipulation"
        >
          <span className="text-xs text-slate-400 block leading-tight">Donor</span>
          <span className="font-semibold">
            {donorName === 'custom' ? (customDonor || 'Custom (tap to set)') : (donorName || 'Tap to pick')}
          </span>
        </button>
        <div className="text-right text-xs text-slate-400 px-2">
          <div>Items</div>
          <div className="text-base font-bold text-amber-400 leading-tight">{itemsRecorded}</div>
        </div>
        <Button
          onClick={handleEndSession}
          variant="danger"
          disabled={endingSession}
          className="min-h-[44px] text-xs px-2"
        >
          {endingSession ? <Spinner className="w-4 h-4" /> : 'End'}
        </Button>
      </div>

      {/* Custom donor inline editor */}
      {donorName === 'custom' && !customDonor && (
        <div className="bg-slate-800 px-3 py-2 border-b border-slate-700 flex gap-2">
          <input
            type="text"
            placeholder="Enter donor name"
            value={customDonor}
            onChange={e => setCustomDonor(e.target.value)}
            className="flex-1 px-3 py-2 rounded-md bg-slate-900 border border-slate-700 text-slate-200 text-sm"
            autoFocus
          />
        </div>
      )}

      {/* Camera viewport */}
      <div className="relative flex-1 bg-black overflow-hidden">
        {cameraError ? (
          <div className="absolute inset-0 flex items-center justify-center text-center p-6">
            <div>
              <p className="text-red-300 mb-3">{cameraError}</p>
              <Button onClick={startCamera} variant="secondary">Retry camera</Button>
            </div>
          </div>
        ) : (
          <video
            ref={videoRef}
            autoPlay
            playsInline
            muted
            className="absolute inset-0 w-full h-full object-cover"
          />
        )}
        {toast && (
          <div className="absolute top-3 left-1/2 -translate-x-1/2 bg-slate-900/90 text-slate-100 text-sm px-4 py-2 rounded-md border border-slate-700">
            {toast}
          </div>
        )}
      </div>

      {/* Photo strip */}
      {pendingPhotos.length > 0 && (
        <div className="bg-slate-900/95 border-t border-slate-700 px-3 py-2">
          <div className="flex gap-2 overflow-x-auto pb-1">
            {pendingPhotos.map((p, i) => (
              <div key={p.id} className="relative flex-shrink-0">
                <img src={p.thumbnail} alt={`photo ${i + 1}`} className="w-16 h-16 rounded object-cover border border-slate-600" />
                {p.uploading && (
                  <div className="absolute inset-0 bg-black/60 flex items-center justify-center rounded">
                    <Spinner className="w-4 h-4" />
                  </div>
                )}
                {p.error && (
                  <div className="absolute inset-0 bg-red-900/80 flex items-center justify-center rounded text-[10px] text-red-100 text-center px-1">
                    fail
                  </div>
                )}
                <button
                  onClick={() => handleRemovePhoto(p.id)}
                  className="absolute -top-1 -right-1 w-5 h-5 rounded-full bg-red-600 text-white text-xs leading-none flex items-center justify-center"
                  aria-label="remove photo"
                >
                  ×
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Action bar */}
      <div className="bg-slate-900 border-t border-slate-700 px-3 py-3 flex items-center gap-3">
        <button
          onClick={handleDiscard}
          disabled={pendingPhotos.length === 0}
          className="min-h-[56px] px-4 rounded-lg bg-slate-800 border border-slate-700 text-slate-200 text-xs font-semibold disabled:opacity-40 touch-manipulation"
        >
          Discard
        </button>

        <button
          onClick={handleShutter}
          disabled={!!cameraError}
          className="flex-1 min-h-[64px] rounded-full bg-white border-4 border-slate-300 text-slate-900 text-xl font-bold disabled:opacity-40 touch-manipulation flex items-center justify-center"
          aria-label="capture photo"
        >
          <span className="block w-12 h-12 rounded-full bg-amber-500" />
        </button>

        <button
          onClick={handleNextItem}
          disabled={!canSaveItem || savingItem}
          className="min-h-[56px] px-4 rounded-lg bg-amber-600 text-white text-sm font-bold disabled:opacity-40 touch-manipulation"
        >
          {savingItem ? <Spinner className="w-4 h-4" /> : 'Next item →'}
        </button>
      </div>
    </div>
  );
};
