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

export default function SignupPage() {
  const router = useRouter();
  const { session } = useAuth();
  const [formData, setFormData] = useState({
    email: '',
    password: '',
  });
  const [errors, setErrors] = useState<{ email?: string; password?: string }>({});
  const [generalError, setGeneralError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]: value,
    }));
  };

  const handleSignup = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrors({});
    setGeneralError(null);
    setIsLoading(true);

    const { email, password } = formData;

    // Get current session (might be anonymous)
    const { data: { session: currentSession } } = await supabase.auth.getSession();

    if (currentSession?.user?.is_anonymous) {
      // User is signed in anonymously, link to email/password account
      try {
        // Try to sign up first (creates the account if it doesn't exist)
        const { data: signUpData, error: signUpError } = await supabase.auth.signUp({
          email,
          password,
        });

        if (signUpError && !signUpError.message.includes('already registered')) {
          if (signUpError.message.toLowerCase().includes('email')) {
            setErrors({ email: signUpError.message });
          } else if (signUpError.message.toLowerCase().includes('password')) {
            setErrors({ password: signUpError.message });
          } else {
            setGeneralError(signUpError.message);
          }
          setIsLoading(false);
          return;
        }

        // Now sign in with the email/password
        const { error: signInError } = await supabase.auth.signInWithPassword({
          email,
          password,
        });

        if (signInError) {
          if (signInError.message.toLowerCase().includes('email')) {
            setErrors({ email: signInError.message });
          } else if (signInError.message.toLowerCase().includes('password')) {
            setErrors({ password: signInError.message });
          } else {
            setGeneralError(signInError.message);
          }
          setIsLoading(false);
          return;
        }

        // Successfully linked anonymous account to email/password
        // The session should now be authenticated with the same data
        console.log('Anonymous account linked to email/password account');

        // Get the current authenticated session
        const { data: { session: currentSession } } = await supabase.auth.getSession();
        console.log('Current authenticated session:', currentSession);
        console.log('Current user ID:', currentSession?.user?.id);

        // Import and upload transferred data
        {/*
        console.log('🔍 Checking for exported data in signup page...');

        const exportedDataString = localStorage.getItem('anonymousExportedData');
        console.log('Exported data in localStorage:', exportedDataString ? 'Found' : 'Not found');

        if (exportedDataString && currentSession?.user?.id) {
          try {
            console.log('📥 Importing exported data...');
            const exportedData = JSON.parse(exportedDataString);
            console.log('Parsed exported data:', exportedData);
            await importAndUploadData(exportedData, currentSession.user.id);
            localStorage.removeItem('anonymousExportedData'); // Clean up
            console.log('✅ Anonymous data imported and uploaded successfully');
          } catch (error) {
            console.error('❌ Error importing anonymous data:', error);
          }
        } else {
          console.log('⚠️ No exported data found or no current session user ID');
        }
        */}

        // Redirect to tool page - it will handle role check and address submission
        router.push('/tool');
      } catch (error) {
        setGeneralError('Fehler beim Verknüpfen des Kontos');
        setIsLoading(false);
      }
    } else {
      // Regular sign in for existing users
      const { data, error } = await supabase.auth.signInWithPassword({ email, password });

      if (error) {
        // Very simple field targeting – Supabase mostly returns generic error.
        if (error.message.toLowerCase().includes('email')) {
          setErrors({ email: error.message });
        } else if (error.message.toLowerCase().includes('password')) {
          setErrors({ password: error.message });
        } else {
          setGeneralError(error.message);
        }
        setIsLoading(false);
        return;
      }

      // Import and upload transferred data if this was an anonymous -> authenticated transition
      {/*
      const previousUserId = localStorage.getItem('previousUserId');
      if (previousUserId && previousUserId.includes('@') === false) {
        // This was an anonymous -> authenticated transition, import data
        console.log(`Detected anonymous -> authenticated transition, importing data from ${previousUserId}`);

        // Get the current authenticated session
        const { data: { session: currentAuthSession } } = await supabase.auth.getSession();

        if (currentAuthSession?.user?.id) {
          const exportedDataString = localStorage.getItem('anonymousExportedData');
          if (exportedDataString) {
            try {
              console.log('📥 Importing exported data for existing user...');
              const exportedData = JSON.parse(exportedDataString);
              console.log('Parsed exported data:', exportedData);
              await importAndUploadData(exportedData, currentAuthSession.user.id);
              localStorage.removeItem('anonymousExportedData'); // Clean up
              console.log('✅ Anonymous data imported and uploaded successfully for existing user');
            } catch (error) {
              console.error('❌ Error importing anonymous data for existing user:', error);
            }
          }
        }
        
      }
        */}

      // Redirect to tool page - it will handle role check and address submission
      router.push('/tool');
    }
  };

  return (
    <main className={styles.container}>
      <MapBackground />
      <div className={styles.formContainer}>
        <h1 className={styles.title}>Anmeldung</h1>
        <form onSubmit={handleSignup} className={styles.form}>
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
          {generalError && <p className={styles.generalError}>{generalError}</p>}
          <Button type="submit" fullWidth>
            Anmelden
          </Button>
        </form>
        <p className={styles.registerText}>
          Passwort vergessen?{' '}
          <Link href="/forgot-password" className={styles.link}>
            Zurücksetzen
          </Link>
        </p>
        <p className={styles.registerText}>
          Noch kein Konto?{' '}
          <Link href="/register" className={styles.link}>
            Jetzt registrieren
          </Link>
        </p>
      </div>

      {isLoading && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          width: '100%',
          height: '100%',
          backgroundColor: 'rgba(255, 255, 255, 0.9)',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'center',
          alignItems: 'center',
          zIndex: 9999,
        }}>
          <div className={styles.spinner}></div>
          <p style={{ marginTop: '20px', color: '#333', fontSize: '1.1em' }}>
            Anmeldung läuft...
          </p>
        </div>
      )}
    </main>
  );
}
