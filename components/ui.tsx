
import React from 'react';

// --- SVG Icons ---

export const CameraIcon = ({ className = 'w-5 h-5' }: { className?: string }) => (
  <svg className={className} xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
    <path strokeLinecap="round" strokeLinejoin="round" d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" />
    <path strokeLinecap="round" strokeLinejoin="round" d="M15 13a3 3 0 11-6 0 3 3 0 016 0z" />
  </svg>
);

export const MicIcon = ({ className = 'w-5 h-5' }: { className?: string }) => (
    <svg className={className} xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
        <path strokeLinecap="round" strokeLinejoin="round" d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z" />
    </svg>
);

export const PlusIcon = ({ className = 'w-5 h-5' }: { className?: string }) => (
    <svg className={className} xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
    </svg>
);


// --- UI Components ---

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'danger';
  children: React.ReactNode;
}

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ children, variant = 'primary', className = '', ...props }, ref) => {
    const baseClasses = 'inline-flex items-center justify-center gap-2 rounded-md px-4 py-2 text-sm font-semibold shadow-sm transition-colors duration-200 focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-offset-slate-900 disabled:opacity-60 disabled:cursor-not-allowed';
    
    const variantClasses = {
      primary: 'bg-amber-600 text-white hover:bg-amber-500 focus-visible:ring-amber-500',
      secondary: 'bg-slate-700 text-slate-200 ring-1 ring-inset ring-slate-600 hover:bg-slate-600 focus-visible:ring-slate-500',
      danger: 'bg-red-600 text-white hover:bg-red-700 focus-visible:ring-red-600',
    };

    return (
      <button ref={ref} className={`${baseClasses} ${variantClasses[variant]} ${className}`} {...props}>
        {children}
      </button>
    );
  }
);

interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label: string;
}

export const Input = React.forwardRef<HTMLInputElement, InputProps>(
  ({ label, id, ...props }, ref) => (
    <div>
      <label htmlFor={id} className="block text-sm font-medium leading-6 text-slate-300">{label}</label>
      <div className="mt-2">
        <input
          id={id}
          ref={ref}
          className="block w-full rounded-md border-0 py-2 px-3 bg-slate-800 text-slate-200 shadow-sm ring-1 ring-inset ring-slate-700 placeholder:text-slate-500 focus:ring-2 focus:ring-inset focus:ring-amber-500 sm:text-sm sm:leading-6 transition"
          {...props}
        />
      </div>
    </div>
  )
);

interface SelectProps extends React.SelectHTMLAttributes<HTMLSelectElement> {
  label: string;
  children: React.ReactNode;
}

export const Select = React.forwardRef<HTMLSelectElement, SelectProps>(
  ({ label, id, children, ...props }, ref) => (
    <div>
      <label htmlFor={id} className="block text-sm font-medium leading-6 text-slate-300">{label}</label>
      <div className="mt-2">
        <select
          id={id}
          ref={ref}
          className="block w-full rounded-md border-0 py-2 pl-3 pr-10 bg-slate-800 text-slate-200 shadow-sm ring-1 ring-inset ring-slate-700 focus:ring-2 focus:ring-inset focus:ring-amber-500 sm:text-sm sm:leading-6 transition"
          {...props}
        >
          {children}
        </select>
      </div>
    </div>
  )
);

interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  children: React.ReactNode;
}

export const Modal: React.FC<ModalProps> = ({ isOpen, onClose, title, children }) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70" onClick={onClose} role="dialog" aria-modal="true">
      <div className="bg-slate-800 rounded-xl shadow-2xl w-full max-w-md m-4 p-6 border border-slate-700 relative" onClick={(e) => e.stopPropagation()}>
        <div className="flex justify-between items-start mb-4">
          <h2 className="text-xl font-bold text-slate-100">{title}</h2>
          <button onClick={onClose} className="text-slate-400 hover:text-red-500 text-3xl font-light leading-none" aria-label="Close modal">&times;</button>
        </div>
        <div>{children}</div>
      </div>
    </div>
  );
};


export const Spinner = ({ className = 'w-6 h-6' }: { className?: string }) => (
    <svg className={`${className} animate-spin text-white`} xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
    </svg>
);