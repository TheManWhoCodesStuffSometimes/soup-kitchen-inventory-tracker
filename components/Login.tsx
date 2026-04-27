import React, { useState } from 'react';
import { Button, Input, Spinner } from './ui';
import { login } from '../services/apiClient';

interface LoginProps {
  onLoggedIn: () => void;
}

export const Login: React.FC<LoginProps> = ({ onLoggedIn }) => {
  const [password, setPassword] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setIsSubmitting(true);
    try {
      await login(password);
      onLoggedIn();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Login failed');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-900 flex items-center justify-center p-4">
      <form
        onSubmit={handleSubmit}
        className="w-full max-w-sm bg-slate-800 rounded-2xl shadow-2xl p-8 border border-slate-700 space-y-5"
      >
        <div className="text-center">
          <h1 className="text-2xl font-bold text-slate-100">Soup Kitchen</h1>
          <p className="text-sm text-slate-400 mt-1">Inventory access</p>
          <div className="mt-3 h-1 w-12 bg-amber-500 mx-auto rounded-full" />
        </div>

        <Input
          label="Password"
          id="password"
          type="password"
          autoComplete="current-password"
          value={password}
          onChange={e => setPassword(e.target.value)}
          required
          autoFocus
        />

        {error && (
          <div className="text-sm text-red-300 bg-red-900/40 border border-red-700 rounded-md px-3 py-2">
            {error}
          </div>
        )}

        <Button
          type="submit"
          variant="primary"
          disabled={isSubmitting || !password}
          className="w-full text-base py-3 font-bold min-h-[48px]"
        >
          {isSubmitting ? <Spinner /> : 'Sign in'}
        </Button>
      </form>
    </div>
  );
};
