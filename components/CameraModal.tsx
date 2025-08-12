import React from 'react';

export const CameraModal: React.FC<any> = ({ isOpen, onClose }) => {
  if (!isOpen) return null;
  
  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center">
      <div className="bg-white p-4 rounded">
        <p>Test modal works!</p>
        <button onClick={onClose}>Close</button>
      </div>
    </div>
  );
};
