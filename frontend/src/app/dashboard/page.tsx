'use client';

import SignOutButton from '../components/ui/SignOutButton';

export default function DashboardPage() {
  return (
    <main style={{ padding: '20px' }}>
      <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
        <SignOutButton />
      </div>
      <h1>Dashboard (protected)</h1>
    </main>
  );
}
