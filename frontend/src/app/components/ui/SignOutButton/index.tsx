'use client';

import { useRouter } from 'next/navigation';
import { supabase } from '@/app/lib/supabaseClient';
import { Button } from '../Button';
import { useAuth } from '@/contexts/AuthContext';

interface SignOutButtonProps {
  onSignIn?: () => Promise<void> | void;
}

export default function SignOutButton({ onSignIn }: SignOutButtonProps) {
  const router = useRouter();
  const { user } = useAuth();

  const handleSignOut = async () => {
    await supabase.auth.signOut();
    router.replace('/');
  };

  const handleSignIn = async () => {
    // Call the optional onSignIn callback before navigating
    if (onSignIn) {
      await onSignIn();
    }
    router.push('/signup');
  };

  const isAnonymous = user?.is_anonymous || false;

  return (
    <Button
      onClick={isAnonymous ? handleSignIn : handleSignOut}
      size="small"
      variant="outline"
    >
      {isAnonymous ? 'Anmelden' : 'Abmelden'}
    </Button>
  );
} 