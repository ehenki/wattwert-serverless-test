'use client'

import { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { supabase } from '@/app/lib/supabaseClient';
import type { Session, User } from '@supabase/supabase-js';

interface AuthContextType {
  session: Session | null;
  user: User | null;
  loading: boolean;
  isSessionUpgrade: boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const [isSessionUpgrade, setIsSessionUpgrade] = useState(false);
  const [previousUserId, setPreviousUserId] = useState<string | null>(null);

  useEffect(() => {
    const initializeAuth = async () => {
      // Get current session
      const { data: { session } } = await supabase.auth.getSession();

      if (session) {
        setPreviousUserId(session.user.id);
        setSession(session);
      } else {
        // Create anonymous session for first-time visitors
        try {
          const { data, error } = await supabase.auth.signInAnonymously();
          if (error) {
            console.error('Error creating anonymous session:', error);
          } else {
            console.log('Anonymous session created:', data.session?.user.id);
            if (data.session) {
              setPreviousUserId(data.session.user.id);
            }
            setSession(data.session);
          }
        } catch (error) {
          console.error('Error in anonymous sign-in:', error);
        }
      }
      setLoading(false);
    };

    initializeAuth();

    // Listen for auth changes
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event, newSession) => {
      console.log('Auth state change:', event, {
        previousUserId: previousUserId,
        newUserId: newSession?.user?.id,
        wasAnonymous: previousUserId && !previousUserId.includes('@'), // Simple check for anonymous ID
        isNowAuthenticated: newSession?.user && !newSession.user.is_anonymous,
        event: event
      });

      // Detect session upgrade (anonymous -> authenticated)
      if (previousUserId && newSession?.user?.id && event === 'SIGNED_IN') {
        const wasAnonymous = !previousUserId.includes('@'); // Anonymous IDs are UUIDs, not emails
        const isNowAuthenticated = !newSession.user.is_anonymous;

        if (wasAnonymous && isNowAuthenticated) {
          console.log('Session upgrade detected: Anonymous -> Authenticated');
          setIsSessionUpgrade(true);

          // Reset the upgrade flag after a short delay to allow components to handle the upgrade
          setTimeout(() => {
            setIsSessionUpgrade(false);
          }, 100);
        }
      }

      // Update previous user ID for next comparison
      if (newSession?.user?.id) {
        setPreviousUserId(newSession.user.id);
      }
      setSession(newSession);
    });

    return () => {
      subscription.unsubscribe();
    };
  }, []);

  const value: AuthContextType = {
    session,
    user: session?.user ?? null,
    loading,
    isSessionUpgrade,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}; 