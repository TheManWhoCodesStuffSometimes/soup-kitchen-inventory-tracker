import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Modal, Button, Spinner, MicIcon, XIcon } from './ui';
import { VoiceAnalysisResult } from '../types';

// --- Type definitions for Web Speech API ---
interface SpeechRecognitionAlternative {
    transcript: string;
    confidence: number;
}

interface SpeechRecognitionResult {
    isFinal: boolean;
    readonly length: number;
    item(index: number): SpeechRecognitionAlternative;
    [index: number]: SpeechRecognitionAlternative;
}

interface SpeechRecognitionResultList {
    readonly length: number;
    item(index: number): SpeechRecognitionResult;
    [index: number]: SpeechRecognitionResult;
}

interface SpeechRecognitionEvent extends Event {
    resultIndex: number;
    results: SpeechRecognitionResultList;
}

interface SpeechRecognitionErrorEvent extends Event {
    error: string;
    message: string;
}

interface SpeechRecognition extends EventTarget {
    continuous: boolean;
    interimResults: boolean;
    lang: string;
    start(): void;
    stop(): void;
    onresult: (event: SpeechRecognitionEvent) => void;
    onstart: () => void;
    onend: () => void;
    onerror: (event: SpeechRecognitionErrorEvent) => void;
}

declare global {
    interface Window {
        SpeechRecognition: { new(): SpeechRecognition };
        webkitSpeechRecognition: { new(): SpeechRecognition };
    }
}

interface VoiceModalProps {
  isOpen: boolean;
  onClose: () => void;
  onProcess: (text: string) => Promise<VoiceAnalysisResult>;
  onSuccess: (result: VoiceAnalysisResult) => void;
}

export const VoiceModal: React.FC<VoiceModalProps> = ({ isOpen, onClose, onProcess, onSuccess }) => {
  const [isRecording, setIsRecording] = useState(false);
  const [transcript, setTranscript] = useState('');
  const [interimTranscript, setInterimTranscript] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [recordingTime, setRecordingTime] = useState(0);
  const recognitionRef = useRef<SpeechRecognition | null>(null);
  const recordingTimerRef = useRef<NodeJS.Timeout | null>(null);

  // Initialize speech recognition
  useEffect(() => {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) {
      setError("Speech recognition is not supported in this browser. Please try Chrome or Edge.");
      return;
    }
    
    const recognition: SpeechRecognition = new SpeechRecognition();
    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.lang = 'en-US';

    recognition.onresult = (event: SpeechRecognitionEvent) => {
      let finalTranscript = '';
      let interimText = '';
      
      for (let i = event.resultIndex; i < event.results.length; ++i) {
        const result = event.results[i];
        if (result.isFinal) {
          finalTranscript += result[0].transcript + ' ';
        } else {
          interimText += result[0].transcript;
        }
      }
      
      if (finalTranscript) {
        setTranscript(prev => prev + finalTranscript);
      }
      setInterimTranscript(interimText);
    };

    recognition.onstart = () => {
      setIsRecording(true);
      setRecordingTime(0);
      // Start recording timer
      recordingTimerRef.current = setInterval(() => {
        setRecordingTime(prev => prev + 1);
      }, 1000);
    };
    
    recognition.onend = () => {
      setIsRecording(false);
      setInterimTranscript('');
      if (recordingTimerRef.current) {
        clearInterval(recordingTimerRef.current);
        recordingTimerRef.current = null;
      }
    };
    
    recognition.onerror = (event: SpeechRecognitionErrorEvent) => {
        console.error('Speech recognition error', event.error);
        let errorMessage = 'Speech recognition error: ';
        
        switch (event.error) {
          case 'no-speech':
            errorMessage += 'No speech was detected. Please try again.';
            break;
          case 'audio-capture':
            errorMessage += 'No microphone was found. Please check your microphone.';
            break;
          case 'not-allowed':
            errorMessage += 'Microphone permission was denied. Please allow microphone access.';
            break;
          case 'network':
            errorMessage += 'Network error occurred. Please check your connection.';
            break;
          default:
            errorMessage += event.error;
        }
        
        setError(errorMessage);
        setIsRecording(false);
        if (recordingTimerRef.current) {
          clearInterval(recordingTimerRef.current);
          recordingTimerRef.current = null;
        }
    }

    recognitionRef.current = recognition;
    
    return () => {
      if (recordingTimerRef.current) {
        clearInterval(recordingTimerRef.current);
      }
    };
  }, []);

  const startRecording = () => {
    if (!recognitionRef.current) {
      setError('Speech recognition is not available in this browser.');
      return;
    }
    
    setTranscript('');
    setInterimTranscript('');
    setError(null);
    
    try {
      recognitionRef.current.start();
    } catch (err) {
      setError('Failed to start recording. Please try again.');
    }
  };

  const stopRecording = () => {
    if (recognitionRef.current && isRecording) {
      recognitionRef.current.stop();
    }
  };

  const toggleRecording = () => {
    if (isRecording) {
      stopRecording();
    } else {
      startRecording();
    }
  };
  
  // In VoiceModal.tsx - Replace the handleProcess function

    const handleProcess = async () => {
      const fullTranscript = transcript.trim();
      
      if (!fullTranscript) {
        setError("Please record a description first.");
        return;
      }
      
      setError(null);
      
      try {
        // IMMEDIATELY close modal and start processing in background
        handleClose();
        
        // Call the async processing function (no await here - let it run in background)
        onProcess(fullTranscript).then((result) => {
          onSuccess(result);
        }).catch((err) => {
          console.error('Background voice processing error:', err);
          // Could show a toast notification here instead of blocking modal
        });
        
      } catch (err) {
        if (err instanceof Error) {
          setError(err.message);
        } else {
          setError("An unknown error occurred during processing.");
        }
      }
    }

  const handleClose = () => {
    if (recognitionRef.current && isRecording) {
      recognitionRef.current.stop();
    }
    if (recordingTimerRef.current) {
      clearInterval(recordingTimerRef.current);
      recordingTimerRef.current = null;
    }
    setIsProcessing(false);
    setError(null);
    setTranscript('');
    setInterimTranscript('');
    setRecordingTime(0);
    onClose();
  }

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const displayTranscript = transcript + interimTranscript;

  return (
    <Modal isOpen={isOpen} onClose={handleClose} title="Voice Describe Product" size="lg">
      <div className="space-y-4">
        {/* Recording Status */}
        {isRecording && (
          <div className="bg-red-900/30 border border-red-600/30 rounded-lg p-3">
            <div className="flex items-center justify-center space-x-3">
              <div className="flex items-center space-x-2">
                <div className="w-3 h-3 bg-red-500 rounded-full animate-pulse"></div>
                <span className="text-red-300 font-semibold">Recording</span>
              </div>
              <span className="text-red-200 font-mono">{formatTime(recordingTime)}</span>
            </div>
          </div>
        )}

        {/* Transcript Display */}
        <div className="relative">
          <div className="w-full min-h-[120px] max-h-[200px] p-4 bg-slate-900 rounded-lg border border-slate-600 text-slate-200 overflow-y-auto">
            {displayTranscript || (
              <span className="text-slate-400 italic">
                Press 'Start Recording' and describe the product...
                <br />
                <span className="text-xs">
                  Example: "Campbell's tomato soup, ten point seven five ounce can"
                </span>
              </span>
            )}
            {isRecording && (
              <span className="inline-block w-2 h-5 bg-amber-400 animate-pulse ml-1 align-text-bottom"></span>
            )}
          </div>
          
          {transcript && !isRecording && (
            <button
              onClick={() => setTranscript('')}
              className="absolute top-2 right-2 text-slate-400 hover:text-red-400 transition-colors"
              title="Clear transcript"
            >
              <XIcon className="w-4 h-4" />
            </button>
          )}
        </div>

        {/* Manual Input Option */}
        {!isRecording && (
          <div>
            <label className="block text-sm font-medium text-slate-300 mb-2">
              Or type description manually:
            </label>
            <textarea
              value={transcript}
              onChange={(e) => setTranscript(e.target.value)}
              className="w-full p-3 bg-slate-800 text-slate-200 border border-slate-700 rounded-lg focus:ring-2 focus:ring-amber-500 focus:border-transparent"
              rows={3}
              placeholder="Type product description here..."
            />
          </div>
        )}

        {/* Processing State */}
        {isProcessing && (
          <div className="flex flex-col items-center justify-center space-y-2 py-4">
            <Spinner />
            <p className="text-slate-300 font-semibold">Analyzing description...</p>
          </div>
        )}

        {/* Error Display */}
        {error && !isProcessing && (
          <div className="bg-red-900/50 border border-red-600/50 rounded-lg p-3">
            <p className="text-red-300 text-sm font-medium">{error}</p>
          </div>
        )}

        {/* Action Buttons */}
        <div className="flex flex-col space-y-3">
          <div className="flex gap-3">
            <Button 
              onClick={toggleRecording} 
              disabled={isProcessing} 
              variant={isRecording ? "danger" : "secondary"} 
              className="flex-1"
            >
              <MicIcon />
              {isRecording ? 'Stop Recording' : 'Start Recording'}
            </Button>
            <Button 
              onClick={handleProcess} 
              disabled={isProcessing || !transcript.trim()} 
              className="flex-1"
            >
              Process Description
            </Button>
          </div>
          
          <Button 
            onClick={handleClose} 
            variant="secondary" 
            disabled={isProcessing}
            className="w-full"
          >
            <XIcon /> Cancel
          </Button>
        </div>

        {/* Tips */}
        {!isRecording && !transcript && (
          <div className="bg-slate-700/50 border border-slate-600 rounded-lg p-3">
            <p className="text-slate-400 text-xs">
              <strong>Tips:</strong> Speak clearly and include details like brand name, product type, and size. 
              For example: "Campbell's chicken noodle soup, ten point seven five ounce can"
            </p>
          </div>
        )}
      </div>
    </Modal>
  );
};
