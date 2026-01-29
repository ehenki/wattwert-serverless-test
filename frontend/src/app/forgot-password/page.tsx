'use client';

import { useState } from 'react';
import Link from 'next/link';
import { supabase } from '../lib/supabaseClient';
import { Input } from '../components/ui/Input';
import { Button } from '../components/ui/Button';

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState('');
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setMessage(null);
    setError(null);

    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/reset-password`,
    });

    if (error) {
      setError(error.message);
    } else {
      setMessage('Wir haben Ihnen eine E-Mail zum Zurücksetzen des Passworts gesendet.');
    }
  };
  return (
    <main style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '100vh', padding: 20 }}>
      <div style={{ width: '100%', maxWidth: 400, padding: 32, border: '1px solid var(--base-grey)', borderRadius: 12 }}>
        <h1 style={{ textAlign: 'center', marginBottom: 24, color: "var(--headlinecolor)" }}>Passwort vergessen</h1>
        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <Input
            label="E-Mail"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            style={{ color: 'var(--fontcolor)' }}
            required
          />
          {error && <p style={{ color: '#ff4d4d', fontSize: 14 }}>{error}</p>}
          {message && <p style={{fontSize: 14, color: "var(--fontcolor)" }}>{message}</p>}
          <Button type="submit" fullWidth>
            Link senden
          </Button>
        </form>
        <p style={{ marginTop: 24, textAlign: 'center', fontSize: 14, color: "var(--fontcolor)" }}>
          Zurück zur <Link href="/signup">Anmeldung</Link>
        </p>
      </div>
    </main>
  );
} 