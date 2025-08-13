import React, { useState, useRef, useEffect } from 'react';
import { ImageAnalysisResult } from '../types';

interface CameraModalProps {
  isOpen: boolean;
  onClose: () => void;
  onCapture: (imageBlob: Blob) => Promise<ImageAnalysisResult>;
  onSuccess: (result: ImageAnalysisResult) => void;
}

export const CameraModal: React.FC<CameraModalProps> = ({ 
  isOpen, 
  onClose, 
  onCapture, 
  onSuccess 
}) => {
  const [step, setStep] = useState<'camera' | 'preview' | 'processing'>('camera');
  const [stream, setStream] = useState<MediaStream | null>(null);
  const [photoBlob, setPhotoBlob] = useState<Blob | null>(null);
  const [photoURL, setPhotoURL] = useState<string>('');
  const [error, setError] = useState<string>('');
  
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  // Start camera when modal opens
  useEffect(() => {
    if (isOpen && step === 'camera') {
      startCamera();
    }
    return () => {
      stopCamera();
      // Clean up photo URL
      if (photoURL) {
        URL.revokeObjectURL(photoURL);
      }
    };
  }, [isOpen, step]);

  const startCamera = async () => {
    try {
      setError('');
      const mediaStream = await navigator.mediaDevices.getUserMedia({
        video: { 
          facingMode: 'environment', 
          width: { ideal: 1280, max: 1920 }, 
          height: { ideal: 720, max: 1080 }
        }
      });
      setStream(mediaStream);
      if (videoRef.current) {
        videoRef.current.srcObject = mediaStream;
      }
    } catch (err) {
      setError('Camera access denied. Please check permissions.');
      console.error('Camera error:', err);
    }
  };

  const stopCamera = () => {
    if (stream) {
      stream.getTracks().forEach(track => track.stop());
      setStream(null);
    }
  };

  const takePhoto = () => {
    if (!videoRef.current || !canvasRef.current) return;
    
    const video = videoRef.current;
    const canvas = canvasRef.current;
    
    // Set canvas dimensions
    const width = video.videoWidth || 640;
    const height = video.videoHeight || 480;
    
    canvas.width = width;
    canvas.height = height;
    
    const ctx = canvas.getContext('2d');
    if (!ctx) {
      setError('Canvas context not available.');
      return;
    }
    
    try {
      // Clear canvas and draw video frame
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
      
      // Convert canvas to blob (binary image data)
      canvas.toBlob((blob) => {
        if (!blob) {
          setError('Failed to create image. Please try again.');
          return;
        }
        
        // Create URL for preview
        const url = URL.createObjectURL(blob);
        
        console.log('Captured image blob:', {
          size: blob.size,
          type: blob.type,
          dimensions: `${canvas.width}x${canvas.height}`
        });
        
        setPhotoBlob(blob);
        setPhotoURL(url);
        setStep('preview');
        stopCamera();
        
      }, 'image/png', 0.95); // PNG for maximum compatibility
      
    } catch (err) {
      console.error('Error capturing photo:', err);
      setError('Failed to capture photo. Please try again.');
    }
  };

  const retakePhoto = () => {
    if (photoURL) {
      URL.revokeObjectURL(photoURL);
    }
    setPhotoBlob(null);
    setPhotoURL('');
    setStep('camera');
  };

  // In CameraModal.tsx - Replace the processPhoto function

  const processPhoto = async () => {
    if (!photoBlob) return;
    
    setError('');
    
    try {
      console.log('Sending blob to API:', {
        size: photoBlob.size,
        type: photoBlob.type
      });
      
      // IMMEDIATELY close modal and start processing in background
      closeModal();
      
      // Call the async processing function (no await here - let it run in background)
      onCapture(photoBlob).then((result) => {
        onSuccess(result);
      }).catch((err) => {
        console.error('Background photo processing error:', err);
        // Could show a toast notification here instead of blocking modal
      });
      
    } catch (err) {
      console.error('Photo processing error:', err);
      setError(err instanceof Error ? err.message : 'Processing failed');
    }
  };

  const closeModal = () => {
    stopCamera();
    if (photoURL) {
      URL.revokeObjectURL(photoURL);
    }
    setStep('camera');
    setPhotoBlob(null);
    setPhotoURL('');
    setError('');
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div 
      className="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center z-50 p-4"
      onClick={closeModal}
    >
      <div 
        className="bg-gray-800 rounded-lg max-w-md w-full p-6"
        onClick={(e) => e.stopPropagation()}
      >
        <h2 className="text-white text-xl mb-4">Take Product Photo</h2>
        
        {error && (
          <div className="bg-red-600 text-white p-3 rounded mb-4">
            {error}
          </div>
        )}

        {/* Camera Step */}
        {step === 'camera' && (
          <div className="space-y-4">
            <div className="relative bg-black rounded-lg overflow-hidden">
              <video 
                ref={videoRef} 
                autoPlay 
                playsInline 
                className="w-full h-64 object-cover"
              />
              <div className="absolute inset-0 border-2 border-white border-dashed opacity-50 m-8"></div>
            </div>
            
            <div className="flex gap-3">
              <button
                type="button"
                onClick={takePhoto}
                disabled={!stream}
                className="flex-1 bg-blue-600 text-white py-3 rounded hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                📸 Take Photo
              </button>
              <button
                type="button"
                onClick={closeModal}
                className="flex-1 bg-gray-600 text-white py-3 rounded hover:bg-gray-700"
              >
                Cancel
              </button>
            </div>
          </div>
        )}

        {/* Preview Step */}
        {step === 'preview' && (
          <div className="space-y-4">
            <div className="bg-black rounded-lg overflow-hidden">
              {photoURL && <img src={photoURL} alt="Captured" className="w-full h-64 object-cover" />}
            </div>
            
            {/* Show image info for debugging */}
            {photoBlob && (
              <div className="text-xs text-gray-400">
                Format: {photoBlob.type} | Size: {(photoBlob.size / 1024).toFixed(1)}KB
              </div>
            )}
            
            <div className="flex gap-3">
              <button
                type="button"
                onClick={processPhoto}
                className="flex-1 bg-green-600 text-white py-3 rounded hover:bg-green-700"
              >
                ✨ Analyze Photo
              </button>
              <button
                type="button"
                onClick={retakePhoto}
                className="flex-1 bg-yellow-600 text-white py-3 rounded hover:bg-yellow-700"
              >
                🔄 Retake
              </button>
            </div>
          </div>
        )}

        {/* Processing Step */}
        {step === 'processing' && (
          <div className="text-center py-8">
            <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-white mb-4"></div>
            <p className="text-white">Analyzing your photo...</p>
          </div>
        )}

        <canvas ref={canvasRef} className="hidden" />
      </div>
    </div>
  );
};
