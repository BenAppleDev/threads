'use client';

import { useEffect, useMemo, useState } from 'react';
import { useParams } from 'next/navigation';
import {
  addDoc,
  collection,
  doc,
  getDoc,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  setDoc,
} from 'firebase/firestore';
import { Glyph } from '../../../../../components/Glyph';
import { ensureNymProfile, NymProfile } from '../../../../../lib/nym';
import { getFirebaseClients, requireAnonymousUser } from '../../../../../lib/firebaseClient';

interface Message {
  id: string;
  text: string;
  nymTag: string;
  glyphBits: string;
  createdAt?: { seconds: number; nanoseconds: number };
}

export default function RoomPage() {
  const params = useParams<{ instanceId: string; roomId: string }>();
  const instanceId = params.instanceId;
  const roomId = params.roomId;
  const { firestore } = useMemo(() => getFirebaseClients(), []);

  const [messages, setMessages] = useState<Message[]>([]);
  const [text, setText] = useState('');
  const [profile, setProfile] = useState<NymProfile | null>(null);
  const [status, setStatus] = useState('Joining room...');
  const [isMember, setIsMember] = useState(false);

  useEffect(() => {
    let unsub: (() => void) | undefined;
    requireAnonymousUser()
      .then((user) => ensureNymProfile(instanceId).then((p) => ({ user, profile: p })))
      .then(async ({ user, profile: p }) => {
        setProfile(p);
        const membershipRef = doc(firestore, 'instances', instanceId, 'rooms', roomId, 'members', user.uid);
        const membership = await getDoc(membershipRef);
        if (membership.exists()) {
          setIsMember(true);
        }
        const messagesQuery = query(
          collection(firestore, 'instances', instanceId, 'rooms', roomId, 'messages'),
          orderBy('createdAt', 'asc')
        );
        unsub = onSnapshot(
          messagesQuery,
          (snap) => {
            setMessages(
              snap.docs.map((d) => ({
                id: d.id,
                text: d.get('text') || '',
                nymTag: d.get('nymTag'),
                glyphBits: d.get('glyphBits'),
                createdAt: d.get('createdAt'),
              }))
            );
            setStatus('');
          },
          (err) => setStatus(`Error loading messages: ${err.message}`)
        );
      })
      .catch((err) => setStatus(`Auth error: ${err.message}`));

    return () => {
      if (unsub) unsub();
    };
  }, [firestore, instanceId, roomId]);

  const joinRoom = async () => {
    const user = await requireAnonymousUser();
    await setDoc(doc(firestore, 'instances', instanceId, 'rooms', roomId, 'members', user.uid), {
      role: 'member',
      lastReadAt: serverTimestamp(),
    }, { merge: true });
    setIsMember(true);
  };

  const sendMessage = async () => {
    if (!profile) return;
    const user = await requireAnonymousUser();
    await addDoc(collection(firestore, 'instances', instanceId, 'rooms', roomId, 'messages'), {
      authorUid: user.uid,
      nymTag: profile.nymTag,
      glyphBits: profile.glyphBits,
      text,
      createdAt: serverTimestamp(),
    });
    setText('');
  };

  return (
    <main style={{ marginTop: 24 }}>
      <div className="card">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <h2 style={{ marginBottom: 4 }}>Room {roomId}</h2>
            <div style={{ color: '#c7c7e8' }}>Instance: {instanceId}</div>
          </div>
          {profile && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <div>
                <div style={{ fontSize: 12, color: '#c7c7e8' }}>You are</div>
                <strong>{profile.nymTag}</strong>
              </div>
              <Glyph bits={profile.glyphBits} size={64} />
            </div>
          )}
        </div>

        {!isMember && (
          <div style={{ marginTop: 12 }}>
            <p style={{ color: '#c7c7e8' }}>Join to read and send messages.</p>
            <button onClick={joinRoom}>Join room</button>
          </div>
        )}

        <div style={{ marginTop: 16, display: 'flex', flexDirection: 'column', gap: 12 }}>
          <div
            style={{
              border: '1px solid rgba(255,255,255,0.08)',
              borderRadius: 12,
              padding: 12,
              maxHeight: 360,
              overflowY: 'auto',
              background: 'rgba(0,0,0,0.2)',
            }}
          >
            {status && <p style={{ color: '#c7c7e8' }}>{status}</p>}
            {messages.map((msg) => (
              <div
                key={msg.id}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 12,
                  marginBottom: 10,
                  paddingBottom: 10,
                  borderBottom: '1px solid rgba(255,255,255,0.04)',
                }}
              >
                <Glyph bits={msg.glyphBits} size={48} />
                <div>
                  <div style={{ fontWeight: 700 }}>{msg.nymTag}</div>
                  <div style={{ color: '#e9e9ff' }}>{msg.text}</div>
                </div>
              </div>
            ))}
          </div>

          <div style={{ display: 'flex', gap: 8 }}>
            <input
              className="input"
              placeholder="Send a cloaked message"
              value={text}
              onChange={(e) => setText(e.target.value)}
              disabled={!isMember}
            />
            <button onClick={sendMessage} disabled={!isMember || !text.trim()}>
              Send
            </button>
          </div>
        </div>
      </div>
    </main>
  );
}
