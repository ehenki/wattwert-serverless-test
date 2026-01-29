'use client'

import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useState } from 'react';
import { supabase } from '../lib/supabaseClient';
import { Button } from '../components/ui/Button';
import { Input } from '../components/ui/Input';
import { useAuth } from '@/contexts/AuthContext';
import styles from './styles.module.css';
import MapBackground from "../components/ui/MapBackground";

export default function RegisterPage() {
  const router = useRouter();
  const { session } = useAuth();
  const [formData, setFormData] = useState({
    email: '',
    password: '',
    confirmPassword: '',
  });
  const [errors, setErrors] = useState<{
    email?: string;
    password?: string;
    confirmPassword?: string;
  }>({});
  const [message, setMessage] = useState<string | null>(null);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]: value,
    }));
  };

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrors({});
    setMessage(null);

    if (formData.password !== formData.confirmPassword) {
      setErrors({ confirmPassword: 'Passwörter stimmen nicht überein.' });
      return;
    }

    // Get current session (might be anonymous)
    const { data: { session: currentSession } } = await supabase.auth.getSession();

    if (currentSession?.user?.is_anonymous) {
      // User is signed in anonymously, link to email/password account
      try {
        // Try to sign up first (creates the account if it doesn't exist)
        const { data: signUpData, error: signUpError } = await supabase.auth.signUp({
          email: formData.email,
          password: formData.password,
        });

        let shouldSignIn = false;

        if (signUpError) {
          // If user already exists, we will try to sign them in to link the account
          if (signUpError.message.includes('already registered')) {
            shouldSignIn = true;
          } else {
            // Handle actual signup errors
            if (signUpError.message.toLowerCase().includes('email')) {
              setErrors({ email: signUpError.message });
            } else {
              setErrors({ password: signUpError.message });
            }
            return;
          }
        } else {
          // SignUp was successful (no error)
          
          // CRITICAL FIX: Check if email confirmation is pending
          if (signUpData.user && !signUpData.session) {
            setMessage('Bitte bestätigen Sie Ihre E-Mail. Wir haben Ihnen einen Link gesendet.');
            return; // Stop here, do not attempt to sign in
          }

          // If we have a session here, the user was created and auto-confirmed (or confirm disabled)
          // We can proceed.
        }

        // Only attempt sign in if explicitly needed (e.g. user already existed)
        // or if we passed the check above and somehow need to re-auth (though usually signUp returns session)
        if (shouldSignIn) {
          const { error: signInError } = await supabase.auth.signInWithPassword({
            email: formData.email,
            password: formData.password,
          });

          if (signInError) {
            // Special handling: If existing user is not confirmed yet
            if (signInError.message.toLowerCase().includes('confirmed')) {
               setMessage('Bitte bestätigen Sie Ihre E-Mail. Wir haben Ihnen einen Link gesendet.');
               return;
            }

            if (signInError.message.toLowerCase().includes('email')) {
              setErrors({ email: signInError.message });
            } else {
              setErrors({ password: signInError.message });
            }
            return;
          }
        }

        // Successfully linked anonymous account to email/password
        console.log('Anonymous account linked to email/password account');

        // Get the current authenticated session
        const { data: { session: currentSession } } = await supabase.auth.getSession();
        console.log('Current authenticated session:', currentSession);
        console.log('Current user ID:', currentSession?.user?.id);

        // Import and upload transferred data
        {/*
        const exportedDataString = localStorage.getItem('anonymousExportedData');
        if (exportedDataString && currentSession?.user?.id) {
          try {
            console.log('📥 Importing exported data for registration...');
            const exportedData = JSON.parse(exportedDataString);
            console.log('Parsed exported data:', exportedData);
            await importAndUploadData(exportedData, currentSession.user.id);
            localStorage.removeItem('anonymousExportedData'); // Clean up
            console.log('✅ Anonymous data imported and uploaded successfully for registration');
          } catch (error) {
            console.error('❌ Error importing anonymous data for registration:', error);
          }
        }
        */}

        // Redirect to tool page - it will handle role check and address submission
        router.push('/tool');
      } catch (error) {
        setMessage('Fehler beim Verknüpfen des Kontos');
      }
    } else {
      // Regular registration for new users
      const { data, error } = await supabase.auth.signUp({
        email: formData.email,
        password: formData.password,
        options: {
          emailRedirectTo: `${window.location.origin.replace(/\/$/, '')}/signup`,
        }
      });

      if (error) {
        // Simple field targeting based on message content
        if (error.message.toLowerCase().includes('email')) {
          setErrors({ email: error.message });
        } else {
          setErrors({ password: error.message });
        }
        return;
      }

      // If no session returned, user must confirm their email first
      if (!data.session) {
        setMessage('Bitte bestätigen Sie Ihre E-Mail. Wir haben Ihnen einen Link gesendet.');
        return;
      }

      // Email is already confirmed, redirect
      router.push('/tool');
    }
  };

  return (
    <main className={styles.container}>
      <MapBackground />
      {message && (
        <div style={{
          position: 'fixed',
          top: '50%',
          left: '50%',
          transform: 'translate(-50%, -50%)',
          backgroundColor: '#ddddee',
          padding: '30px',
          borderRadius: '12px',
          boxShadow: '0 8px 24px rgba(0,0,0,0.2)',
          zIndex: 1000,
          maxWidth: '500px',
          textAlign: 'center'
        }}>
          <div style={{
            fontSize: '48px',
            marginBottom: '15px'
          }}>
            ✉️
          </div>
          <h2 style={{
            color: 'var(--fontcolor)',
            marginBottom: '15px',
            fontSize: '20px',
            fontWeight: '600'
          }}>
            E-Mail bestätigen
          </h2>
          <p style={{
            color: 'var(--fontcolor)',
            marginBottom: '20px',
            lineHeight: '1.6',
            fontSize: '16px'
          }}>
            {message}
          </p>
          <button
            onClick={() => router.push('/signup')}
            style={{
              backgroundColor: 'var(--base-col2)',
              color: 'white',
              border: 'none',
              padding: '12px 24px',
              borderRadius: '6px',
              fontSize: '16px',
              fontWeight: '500',
              cursor: 'pointer'
            }}
          >
            Zur Anmeldung
          </button>
        </div>
      )}
      {message && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          backgroundColor: 'rgba(0, 0, 0, 0.5)',
          zIndex: 999
        }} />
      )}
      <div className={styles.formContainer}>
        <h1 className={styles.title}>Registrierung</h1>
        <p className={styles.description}>Registriere Dich, um für 30 Tage die automatische Aufmaßerstellung <b>kostenlos</b> zu nutzen.</p>
        <form onSubmit={handleRegister} className={styles.form}>
          <Input
            label="E-Mail"
            type="email"
            name="email"
            placeholder="ihre@email.de"
            value={formData.email}
            onChange={handleChange}
            error={errors.email}
            required
          />
          <Input
            label="Passwort"
            type="password"
            name="password"
            placeholder="••••••••"
            value={formData.password}
            onChange={handleChange}
            error={errors.password}
            required
          />
          <Input
            label="Passwort bestätigen"
            type="password"
            name="confirmPassword"
            placeholder="••••••••"
            value={formData.confirmPassword}
            onChange={handleChange}
            error={errors.confirmPassword}
            required
          />
          <Button type="submit" fullWidth>
            Registrieren
          </Button>
        </form>
        <p className={styles.registerText}>
          Bereits registriert?{' '}
          <Link href="/signup" className={styles.link}>
            Jetzt anmelden
          </Link>
        </p>
      </div>
    </main>
  );
} 