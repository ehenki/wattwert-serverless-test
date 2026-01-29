'use client';

import Image from 'next/image';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/app/components/ui/Button';
import { createUserOverview } from '@/app/components/database/uploadUserData';
import styles from './styles.module.css';

export default function RoleSelectionPage() {
  const router = useRouter();
  const { session } = useAuth();
  const [isLoading, setIsLoading] = useState(false);

  const handleRoleSelection = async (role: 'geruestbauer' | 'maler' | 'stuckateur' | 'fassadenbau' | 'andere') => {
    if (!session?.user) return;
    
    setIsLoading(true);
    
    try {
      const result = await createUserOverview(session.user.id, session.user.email || '', role);
      
      if (result.success) {
        router.push('/tool');
      } else {
        console.error('Error creating user profile:', result.error);
        alert('Fehler beim Erstellen des Profils. Bitte versuchen Sie es erneut.');
      }
    } catch (error) {
      console.error('Error in role selection:', error);
      alert('Ein unerwarteter Fehler ist aufgetreten.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <main className={styles.container}>
      <div className={styles.content}>
        <h1 className={styles.title}>Wählen Sie Ihre Rolle</h1>
        <p className={styles.subtitle}>Bitte wählen Sie Ihren Tätigkeitsbereich aus, um fortzufahren.</p>
        
        <div className={styles.buttonGroup}>
          <Button 
            onClick={() => handleRoleSelection('geruestbauer')}
            disabled={isLoading}
            fullWidth
            className={styles.roleButton} // Add className for styling
          >
            <Image src="/scaffolding.png" alt="Gerüstbau Icon" width={24} height={24} />
            <span>Gerüstbau</span>
          </Button>
          
          <Button 
            onClick={() => handleRoleSelection('maler')}
            disabled={isLoading}
            fullWidth
            className={styles.roleButton} // Add className for styling
          >
            <Image src="/paint_roll.png" alt="Maler Icon" width={24} height={24} />
            <span>Maler</span>
          </Button>

          <Button 
            onClick={() => handleRoleSelection('stuckateur')}
            disabled={isLoading}
            fullWidth
            className={styles.roleButton} // Add className for styling
          >
            <Image src="/plastering.png" alt="Stuckateur Icon" width={24} height={24} />
            <span>Stuckateur</span>
          </Button>

          <Button 
            onClick={() => handleRoleSelection('andere')}
            disabled={isLoading}
            fullWidth
            className={styles.roleButton} // Add className for styling
          >
            <Image src="/other.png" alt="Andere Icon" width={24} height={24} />
            <span>Andere</span>
          </Button>

        </div>
      </div>
    </main>
  );
}

