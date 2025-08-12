import React, { useState, useRef, useEffect } from 'react';
import { ImageAnalysisResult } from '../types';

interface CameraModalProps {
  isOpen: boolean;
  onClose: () => void;
  onCapture: (base64Image: string) => Promise<ImageAnalysisResult>;
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
  const [photo, setPhoto] = useState<string>('');
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
    
    // Wait for video to be ready
    if (video.videoWidth === 0 || video.videoHeight === 0) {
      setError('Video not ready. Please wait and try again.');
      return;
    }
    
    // Set canvas dimensions to match video
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    
    const ctx = canvas.getContext('2d');
    if (!ctx) {
      setError('Canvas context not available.');
      return;
    }
    
    try {
      // Clear canvas first
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      
      // Draw video frame to canvas
      ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
      
      // Try PNG first (more reliable than JPEG)
      let dataURL = canvas.toDataURL('image/png');
      
      // Validate the data URL
      if (!dataURL || dataURL === 'data:,' || dataURL.length < 100) {
        setError('Failed to capture image. Please try again.');
        return;
      }
      
      // Check if PNG is too large (> 2MB), then try JPEG
      if (dataURL.length > 2 * 1024 * 1024) {
        console.log('PNG too large, trying JPEG...');
        dataURL = canvas.toDataURL('image/jpeg', 0.9); // High quality JPEG
        
        // Validate JPEG
        if (!dataURL || dataURL === 'data:,' || dataURL.length < 100) {
          setError('Failed to compress image. Please try again.');
          return;
        }
      }
      
      console.log('Captured image:', {
        format: dataURL.startsWith('data:image/png') ? 'PNG' : 'JPEG',
        size: dataURL.length,
        dimensions: `${canvas.width}x${canvas.height}`
      });
      
      setPhoto(dataURL);
      setStep('preview');
      stopCamera();
      
    } catch (err) {
      console.error('Error capturing photo:', err);
      setError('Failed to capture photo. Please try again.');
    }
  };

  const retakePhoto = () => {
    setPhoto('');
    setStep('camera');
  };

  const processPhoto = async () => {
    if (!photo) return;
    
    setStep('processing');
    setError('');
    
    try {
      // Validate photo before sending
      if (!photo.startsWith('data:image/')) {
        throw new Error('Invalid image format');
      }
      
      // Extract just the base64 part for the API
      const base64Data = photo.split(',')[1];
      if (!base64Data || base64Data.length === 0) {
        throw new Error('No image data found');
      }
      
      // Test base64 validity
      try {
        atob(base64Data.substring(0, 100)); // Test decode first 100 chars
      } catch {
        throw new Error('Invalid base64 encoding');
      }
      
      console.log('Sending image to API:', {
        fullSize: photo.length,
        base64Size: base64Data.length,
        format: photo.split(';')[0].split(':')[1]
      });
      
      const result = await onCapture(photo); // Send full data URL
      onSuccess(result);
      closeModal();
    } catch (err) {
      console.error('Photo processing error:', err);
      setError(err instanceof Error ? err.message : 'Processing failed');
      setStep('preview');
    }
  };

  const closeModal = () => {
    stopCamera();
    setStep('camera');
    setPhoto('');
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
                onLoadedMetadata={() => {
                  // Ensure video is ready before allowing photo capture
                  if (videoRef.current && videoRef.current.videoWidth > 0) {
                    console.log('Video ready:', {
                      width: videoRef.current.videoWidth,
                      height: videoRef.current.videoHeight
                    });
                  }
                }}
              />
              <div className="absolute inset-0 border-2 border-white border-dashed opacity-50 m-8"></div>
            </div>
            
            <div className="flex gap-3">
              <button
                type="button"
                onClick={takePhoto}
                disabled={!stream || (videoRef.current?.videoWidth || 0) === 0}
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
              <img src={photo} alt="Captured" className="w-full h-64 object-cover" />
            </div>
            
            {/* Show image info for debugging */}
            <div className="text-xs text-gray-400">
              Format: {photo.startsWith('data:image/png') ? 'PNG' : 'JPEG'} | 
              Size: {(photo.length / 1024).toFixed(1)}KB
            </div>
            
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
