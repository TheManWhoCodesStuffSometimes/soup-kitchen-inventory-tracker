
import React, { useState, useRef, useEffect, useCallback } from 'react';
import { Modal, Button, Spinner } from './ui';
import { ImageAnalysisResult } from '../types';

interface CameraModalProps {
  isOpen: boolean;
  onClose: () => void;
  onCapture: (base64Image: string) => Promise<ImageAnalysisResult>;
  onSuccess: (result: ImageAnalysisResult) => void;
}

export const CameraModal: React.FC<CameraModalProps> = ({ isOpen, onClose, onCapture, onSuccess }) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [stream, setStream] = useState<MediaStream | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [capturedImage, setCapturedImage] = useState<string | null>(null);

  const startCamera = useCallback(async () => {
    try {
      setError(null);
      setCapturedImage(null);
      const mediaStream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'environment' }
      });
      setStream(mediaStream);
      if (videoRef.current) {
        videoRef.current.srcObject = mediaStream;
      }
    } catch (err) {
      console.error("Error accessing camera:", err);
      setError("Could not access the camera. Please check browser permissions.");
    }
  }, []);

  const stopCamera = useCallback(() => {
    if (stream) {
      stream.getTracks().forEach(track => track.stop());
      setStream(null);
    }
  }, [stream]);

  useEffect(() => {
    if (isOpen) {
      startCamera();
    } else {
      stopCamera();
    }

    return () => {
      stopCamera();
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen]);

  const handleCapture = () => {
    if (videoRef.current && canvasRef.current) {
      const video = videoRef.current;
      const canvas = canvasRef.current;
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
      const context = canvas.getContext('2d');
      if (context) {
        context.drawImage(video, 0, 0, video.videoWidth, video.videoHeight);
        const dataUrl = canvas.toDataURL('image/jpeg', 0.9);
        setCapturedImage(dataUrl);
        stopCamera();
      }
    }
  };

  const handleProcessImage = async () => {
    if (!capturedImage) return;
    setIsLoading(true);
    setError(null);
    try {
      const result = await onCapture(capturedImage);
      onSuccess(result);
      handleClose();
    } catch (err) {
      if (err instanceof Error) setError(err.message);
      else setError("An unknown error occurred.");
    } finally {
      setIsLoading(false);
    }
  };
  
  const handleRetake = () => {
      setCapturedImage(null);
      startCamera();
  }

  const handleClose = () => {
    stopCamera();
    setCapturedImage(null);
    setIsLoading(false);
    setError(null);
    onClose();
  }

  return (
    <Modal isOpen={isOpen} onClose={handleClose} title="Scan Product Image">
      <div className="space-y-4">
        <div className="relative w-full aspect-video bg-slate-900 rounded-lg overflow-hidden border border-slate-600">
          {error && <div className="absolute inset-0 flex items-center justify-center text-red-300 bg-red-900/50 p-4 text-center">{error}</div>}
          <video ref={videoRef} autoPlay playsInline className={`w-full h-full object-cover ${capturedImage ? 'hidden' : 'block'}`} />
          {capturedImage && <img src={capturedImage} alt="Captured product" className="w-full h-full object-contain" />}
          {stream && !capturedImage && (
            <div className="absolute inset-0 flex items-center justify-center p-4 pointer-events-none">
              <div className="w-3/4 h-1/2 border-2 border-green-400 border-dashed rounded-lg opacity-75"></div>
            </div>
          )}
        </div>

        {isLoading && (
            <div className="flex flex-col items-center justify-center space-y-2 py-4">
                <Spinner />
                <p className="text-slate-300 font-semibold">Analyzing image...</p>
            </div>
        )}

        {error && !isLoading && <p className="text-center text-red-300 bg-red-900/50 p-3 rounded-md text-sm">{error}</p>}
        
        <div className="flex gap-4">
          {!capturedImage && (
            <Button onClick={handleCapture} disabled={!stream || isLoading} className="w-full" variant="secondary">
              Capture Image
            </Button>
          )}
          {capturedImage && !isLoading && (
            <>
              <Button onClick={handleRetake} variant="secondary" className="w-full">Retake</Button>
              <Button onClick={handleProcessImage} className="w-full">Process Image</Button>
            </>
          )}
        </div>
      </div>
      <canvas ref={canvasRef} className="hidden" />
    </Modal>
  );
};