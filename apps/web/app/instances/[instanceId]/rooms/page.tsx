'use client';

import { useEffect, useMemo, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import {
  addDoc,
  collection,
  doc,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  setDoc,
} from 'firebase/firestore';
import { ensureNymProfile } from '../../../../lib/nym';
import { getFirebaseClients, requireAnonymousUser } from '../../../../lib/firebaseClient';

export default function RoomsPage() {
  const params = useParams<{ instanceId: string }>();
  const instanceId = params.instanceId;
  const router = useRouter();
  const [rooms, setRooms] = useState<Array<{ id: string; title: string; messagesCount?: number }>>([]);
  const [title, setTitle] = useState('');
  const [status, setStatus] = useState('Loading rooms...');

  const { firestore } = useMemo(() => getFirebaseClients(), []);

  useEffect(() => {
    let unsub: (() => void) | undefined;
    requireAnonymousUser()
      .then((user) => ensureNymProfile(instanceId).then(() => user))
      .then((user) => {
        const roomsQuery = query(
          collection(firestore, 'instances', instanceId, 'rooms'),
          orderBy('createdAt', 'asc')
        );
        unsub = onSnapshot(
          roomsQuery,
          (snap) => {
            const data = snap.docs.map((d) => ({ id: d.id, title: d.get('title') || 'Untitled', messagesCount: d.get('messagesCount') }));
            setRooms(data);
            setStatus(data.length ? '' : 'No rooms yet. Create one!');
          },
          (err) => setStatus(`Error loading rooms: ${err.message}`)
        );
      })
      .catch((err) => setStatus(`Auth error: ${err.message}`));

    return () => {
      if (unsub) unsub();
    };
  }, [firestore, instanceId]);

  const createRoom = async () => {
    const user = await requireAnonymousUser();
    const roomRef = await addDoc(collection(firestore, 'instances', instanceId, 'rooms'), {
      title: title || 'New room',
      createdAt: serverTimestamp(),
      locked: false,
      ownerUid: user.uid,
      messagesCount: 0,
      lastMessageAt: null,
      lastMessagePreview: '',
    });
    await setDoc(doc(firestore, 'instances', instanceId, 'rooms', roomRef.id, 'members', user.uid), {
      role: 'admin',
      lastReadAt: serverTimestamp(),
    });
    setTitle('');
    router.push(`/instances/${instanceId}/rooms/${roomRef.id}`);
  };

  const joinRoom = async (roomId: string) => {
    const user = await requireAnonymousUser();
    const membershipRef = doc(firestore, 'instances', instanceId, 'rooms', roomId, 'members', user.uid);
    await setDoc(membershipRef, {
      role: 'member',
      lastReadAt: serverTimestamp(),
    }, { merge: true });
    router.push(`/instances/${instanceId}/rooms/${roomId}`);
  };

  return (
    <main style={{ marginTop: 24 }}>
      <div className="card">
        <h2>Rooms in instance {instanceId}</h2>
        <div style={{ display: 'flex', gap: 8, margin: '12px 0' }}>
          <input
            className="input"
            value={title}
            placeholder="Create a new room"
            onChange={(e) => setTitle(e.target.value)}
          />
          <button onClick={createRoom}>Create</button>
        </div>
        {status && <p style={{ color: '#c7c7e8' }}>{status}</p>}
        <ul style={{ listStyle: 'none', padding: 0 }}>
          {rooms.map((room) => (
            <li key={room.id} className="card" style={{ marginBottom: 8 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div>
                  <strong>{room.title}</strong>
                  <div style={{ color: '#c7c7e8', fontSize: 12 }}>
                    {room.messagesCount ?? 0} messages
                  </div>
                </div>
                <button onClick={() => joinRoom(room.id)}>Enter</button>
              </div>
            </li>
          ))}
        </ul>
      </div>
    </main>
  );
}
