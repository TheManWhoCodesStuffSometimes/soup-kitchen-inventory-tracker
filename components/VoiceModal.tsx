
import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Modal, Button, Spinner, MicIcon } from './ui';
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
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const recognitionRef = useRef<SpeechRecognition | null>(null);

  useEffect(() => {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) {
      setError("Speech recognition is not supported in this browser.");
      return;
    }
    
    const recognition: SpeechRecognition = new SpeechRecognition();
    recognition.continuous = false;
    recognition.interimResults = true;
    recognition.lang = 'en-US';

    recognition.onresult = (event: SpeechRecognitionEvent) => {
      let finalTranscript = '';
      for (let i = event.resultIndex; i < event.results.length; ++i) {
        if (event.results[i].isFinal) {
          finalTranscript += event.results[i][0].transcript;
        }
      }
      setTranscript(prev => prev + finalTranscript);
    };

    recognition.onstart = () => setIsRecording(true);
    recognition.onend = () => setIsRecording(false);
    recognition.onerror = (event: SpeechRecognitionErrorEvent) => {
        console.error('Speech recognition error', event.error);
        setError(`Speech recognition error: ${event.error}`);
        setIsRecording(false);
    }

    recognitionRef.current = recognition;
  }, []);

  const toggleRecording = () => {
    if (!recognitionRef.current) return;
    if (isRecording) {
      recognitionRef.current.stop();
    } else {
      setTranscript('');
      setError(null);
      recognitionRef.current.start();
    }
  };
  
  const handleProcess = async () => {
      if (!transcript) {
          setError("Please record a description first.");
          return;
      }
      setIsLoading(true);
      setError(null);
      try {
          const result = await onProcess(transcript);
          onSuccess(result);
          handleClose();
      } catch (err) {
        if (err instanceof Error) setError(err.message);
        else setError("An unknown error occurred during processing.");
      } finally {
          setIsLoading(false);
      }
  }

  const handleClose = () => {
    if (recognitionRef.current && isRecording) {
      recognitionRef.current.stop();
    }
    setIsLoading(false);
    setError(null);
    setTranscript('');
    onClose();
  }

  return (
    <Modal isOpen={isOpen} onClose={handleClose} title="Describe Product by Voice">
      <div className="space-y-4">
        <div className="w-full p-4 min-h-[120px] bg-slate-900 rounded-lg border border-slate-600 text-slate-200">
          {transcript || <span className="text-slate-400">Press 'Start Recording' and describe the item...</span>}
        </div>
        
        {isRecording && (
          <div className="flex items-center justify-center space-x-2 text-red-500 animate-pulse">
            <MicIcon className="w-5 h-5" />
            <span className="font-semibold text-sm">Listening...</span>
          </div>
        )}

        {isLoading && (
            <div className="flex flex-col items-center justify-center space-y-2 py-4">
                <Spinner />
                <p className="text-slate-300 font-semibold">Analyzing description...</p>
            </div>
        )}
        
        {error && !isLoading && <p className="text-center text-red-300 bg-red-900/50 p-3 rounded-md text-sm">{error}</p>}

        <div className="flex flex-col sm:flex-row gap-4">
          <Button onClick={toggleRecording} disabled={isLoading} variant="secondary" className="w-full">
            <MicIcon />
            {isRecording ? 'Stop Recording' : 'Start Recording'}
          </Button>
          <Button onClick={handleProcess} disabled={isLoading || !transcript} className="w-full">
            Process Description
          </Button>
        </div>
      </div>
    </Modal>
  );
};