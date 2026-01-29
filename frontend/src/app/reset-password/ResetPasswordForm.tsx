'use client';

import { useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { supabase } from '../lib/supabaseClient';
import { Input } from '../components/ui/Input';
import { Button } from '../components/ui/Button';

export default function ResetPasswordForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [loading, setLoading] = useState(true);
  const [newPassword, setNewPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  // On mount: if we have recovery params, set the session
  useEffect(() => {
    const type = searchParams.get('type');
    const access_token = searchParams.get('access_token');
    const refresh_token = searchParams.get('refresh_token');

    const handleRecovery = async () => {
      if (type === 'recovery' && access_token && refresh_token) {
        await supabase.auth.setSession({ access_token, refresh_token });
      }
      setLoading(false);
    };

    handleRecovery();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (newPassword.length < 6) {
      setError('Passwort muss mindestens 6 Zeichen lang sein.');
      return;
    }

    const { error } = await supabase.auth.updateUser({ password: newPassword });
    if (error) {
      setError(error.message);
    } else {
      setSuccess('Passwort aktualisiert. Sie werden zur Anmeldung weitergeleitet.');
      setTimeout(() => router.replace('/signup'), 2500);
    }
  };

  if (loading) return null;

  return (
    <main style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '100vh', padding: 20 }}>
      <div style={{ width: '100%', maxWidth: 400, padding: 32, border: '1px solid var(--base-grey)', borderRadius: 12 }}>
        <h1 style={{ textAlign: 'center', marginBottom: 24 }}>Neues Passwort festlegen</h1>
        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <Input
            label="Neues Passwort"
            type="password"
            value={newPassword}
            onChange={(e) => setNewPassword(e.target.value)}
            required
          />
          {error && <p style={{ color: '#ff4d4d', fontSize: 14 }}>{error}</p>}
          {success && <p style={{ color: 'var(--base-col2)', fontSize: 14 }}>{success}</p>}
          <Button type="submit" fullWidth>
            Passwort aktualisieren
          </Button>
        </form>
      </div>
    </main>
  );
}
