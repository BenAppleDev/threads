'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { requireAnonymousUser } from '../lib/firebaseClient';

export default function Home() {
  const [status, setStatus] = useState('');
  const router = useRouter();
  const defaultInstance = 'demo-instance';

  useEffect(() => {
    requireAnonymousUser()
      .then(() => setStatus('Signed in anonymously'))
      .catch((err) => setStatus(`Auth error: ${err.message}`));
  }, []);

  const goToRooms = () => router.push(`/instances/${defaultInstance}/rooms`);

  return (
    <main style={{ marginTop: 32 }}>
      <div className="card">
        <h2>Welcome to the Nymspace</h2>
        <p>Anonymous-first rooms with cloak mode enforced via Firebase.</p>
        <p style={{ color: '#c7c7e8' }}>{status || 'Preparing anonymous identity...'}</p>
        <button onClick={goToRooms}>Enter demo instance</button>
      </div>
    </main>
  );
}
