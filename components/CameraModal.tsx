import React, { useState, useRef, useEffect, useCallback } from 'react';
import { Modal, Button, Spinner, CameraIcon, XIcon } from './ui';
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
        video: { 
          facingMode: 'environment',
          width: { ideal: 1280 },
          height: { ideal: 1280 }
        }
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
  }, [isOpen, startCamera, stopCamera]);

  const handleCapture = () => {
    if (videoRef.current && canvasRef.current) {
      const video = videoRef.current;
      const canvas = canvasRef.current;
      
      // Create square canvas based on smaller dimension
      const size = Math.min(video.videoWidth, video.videoHeight);
      canvas.width = size;
      canvas.height = size;
      
      const context = canvas.getContext('2d');
      if (context) {
        // Calculate center crop for square image
        const startX = (video.videoWidth - size) / 2;
        const startY = (video.videoHeight - size) / 2;
        
        context.drawImage(video, startX, startY, size, size, 0, 0, size, size);
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
  };

  const handleClose = () => {
    stopCamera();
    setCapturedImage(null);
    setIsLoading(false);
    setError(null);
    onClose();
  };

  return (
    <Modal isOpen={isOpen} onClose={handleClose} title="Capture Product Photo" size="lg">
      <div className="space-y-4">
        {/* Camera/Image Display */}
        <div className="relative w-full aspect-square bg-slate-900 rounded-lg overflow-hidden border border-slate-600">
          {error && (
            <div className="absolute inset-0 flex items-center justify-center text-red-300 bg-red-900/50 p-4 text-center">
              <div className="text-center">
                <XIcon className="w-12 h-12 mx-auto mb-2" />
                <p className="font-medium">{error}</p>
              </div>
            </div>
          )}
          
          {/* Live video feed */}
          <video 
            ref={videoRef} 
            autoPlay 
            playsInline 
            className={`w-full h-full object-cover ${capturedImage ? 'hidden' : 'block'}`} 
          />
          
          {/* Captured image preview */}
          {capturedImage && (
            <img 
              src={capturedImage} 
              alt="Captured product" 
              className="w-full h-full object-cover" 
            />
          )}
          
          {/* Photo capture overlay - only show during live video */}
          {stream && !capturedImage && !error && (
            <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
              {/* Clean square capture frame */}
              <div className="relative">
                <div className="w-64 h-64 border-2 border-white/70 rounded-lg bg-white/5 backdrop-blur-sm">
                  {/* Corner brackets for photo frame effect */}
                  <div className="absolute top-0 left-0 w-8 h-8 border-t-4 border-l-4 border-amber-400 rounded-tl-md"></div>
                  <div className="absolute top-0 right-0 w-8 h-8 border-t-4 border-r-4 border-amber-400 rounded-tr-md"></div>
                  <div className="absolute bottom-0 left-0 w-8 h-8 border-b-4 border-l-4 border-amber-400 rounded-bl-md"></div>
                  <div className="absolute bottom-0 right-0 w-8 h-8 border-b-4 border-r-4 border-amber-400 rounded-br-md"></div>
                  
                  {/* Center target */}
                  <div className="absolute inset-0 flex items-center justify-center">
                    <div className="w-2 h-2 bg-amber-400 rounded-full opacity-60"></div>
                  </div>
                </div>
                
                {/* Instruction text */}
                <div className="absolute -bottom-12 left-0 right-0 text-center">
                  <p className="text-white text-sm font-medium bg-black/60 px-4 py-2 rounded-md">
                    Center the product in the frame
                  </p>
                </div>
              </div>
            </div>
          )}
          
          {/* Captured image overlay */}
          {capturedImage && (
            <div className="absolute top-4 left-4 bg-green-600 text-white px-3 py-1 rounded-md text-sm font-medium flex items-center space-x-2">
              <div className="w-2 h-2 bg-green-200 rounded-full"></div>
              <span>Photo Captured</span>
            </div>
          )}
        </div>

        {/* Processing State */}
        {isLoading && (
          <div className="flex flex-col items-center justify-center space-y-3 py-6">
            <Spinner className="w-8 h-8" />
            <p className="text-slate-300 font-semibold">Analyzing product image...</p>
            <p className="text-slate-400 text-sm">This may take a few moments</p>
          </div>
        )}

        {/* Error Display */}
        {error && !isLoading && (
          <div className="bg-red-900/50 border border-red-600/50 rounded-lg p-4">
            <p className="text-red-300 text-sm font-medium text-center">{error}</p>
          </div>
        )}
        
        {/* Action Buttons */}
        <div className="space-y-3">
          {!capturedImage && !isLoading && (
            <Button 
              onClick={handleCapture} 
              disabled={!stream || isLoading || !!error} 
              className="w-full text-lg py-3" 
              variant="primary"
            >
              <CameraIcon className="w-6 h-6" />
              Take Photo
            </Button>
          )}
          
          {capturedImage && !isLoading && (
            <div className="grid grid-cols-2 gap-3">
              <Button 
                onClick={handleRetake} 
                variant="secondary" 
                className="flex-1 py-3"
              >
                <CameraIcon className="w-5 h-5" />
                Retake
              </Button>
              <Button 
                onClick={handleProcessImage} 
                className="flex-1 py-3" 
                variant="primary"
              >
                Analyze Photo
              </Button>
            </div>
          )}
          
          <Button 
            onClick={handleClose} 
            variant="secondary" 
            disabled={isLoading}
            className="w-full"
          >
            <XIcon className="w-5 h-5" />
            Cancel
          </Button>
        </div>

        {/* Usage Tips */}
        {stream && !capturedImage && !error && (
          <div className="bg-slate-700/50 border border-slate-600 rounded-lg p-3">
            <p className="text-slate-400 text-xs text-center">
              <strong>💡 Tips:</strong> Ensure good lighting, center the product label, and avoid shadows for best AI analysis results.
            </p>
          </div>
        )}
      </div>
      
      <canvas ref={canvasRef} className="hidden" />
    </Modal>
  );
};
