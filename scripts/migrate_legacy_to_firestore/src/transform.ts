import crypto from 'crypto';
import {
  InstanceRow,
  LegacyData,
  MessageRow,
  RoomRow,
  RoomUserRow,
  UserRow,
} from './postgres';
import { Config } from './config';

export interface FirestoreDoc {
  path: string;
  data: Record<string, unknown>;
}

function hashString(input: string): string {
  return crypto.createHash('sha256').update(input).digest('hex');
}

function glyphFromHash(hash: string): string {
  const bytes = Buffer.from(hash.slice(0, 16), 'hex');
  return Array.from(bytes)
    .map((b) => b.toString(2).padStart(8, '0'))
    .join('');
}

function adjective(hash: string) {
  const words = ['aurora', 'nebula', 'stardust', 'eclipse', 'quantum', 'plasma', 'luminous', 'orbit'];
  const idx = parseInt(hash.slice(0, 2), 16) % words.length;
  return words[idx];
}

function numberTag(hash: string) {
  return (parseInt(hash.slice(2, 6), 16) % 900 + 100).toString();
}

function toDate(value: string | null): Date | null {
  if (!value) return null;
  return new Date(value);
}

function buildLegacyUid(userId: number) {
  return `legacy:${userId}`;
}

function buildRoomId(roomId: number) {
  return `legacy:${roomId}`;
}

function buildMessageId(messageId: number) {
  return `legacy:${messageId}`;
}

function buildNym(instanceId: string, legacyUserId: number, salt: string) {
  const uid = buildLegacyUid(legacyUserId);
  const hash = hashString(`${instanceId}:${uid}:${salt}`);
  const nymTag = `nym:${adjective(hash)}-${numberTag(hash)}`;
  const glyphBits = glyphFromHash(hash);
  return { uid, nymTag, glyphBits };
}

interface LookupMaps {
  userById: Map<number, UserRow>;
  roomById: Map<number, RoomRow>;
  instanceById: Map<number, InstanceRow>;
  moderatorsByInstance: Map<number, Set<number>>;
  adminUsers: Set<number>;
  mutedByRoom: Map<number, Set<number>>;
  nicknameByRoomUser: Map<string, string>;
}

function buildLookups(data: LegacyData): LookupMaps {
  const userById = new Map<number, UserRow>();
  data.users.forEach((u) => userById.set(u.id, u));

  const roomById = new Map<number, RoomRow>();
  data.rooms.forEach((r) => roomById.set(r.id, r));

  const instanceById = new Map<number, InstanceRow>();
  data.instances.forEach((i) => instanceById.set(i.id, i));

  const moderatorsByInstance = new Map<number, Set<number>>();
  data.moderators.forEach((m) => {
    if (m.instance_id == null) return;
    if (!moderatorsByInstance.has(m.instance_id)) {
      moderatorsByInstance.set(m.instance_id, new Set());
    }
    moderatorsByInstance.get(m.instance_id)!.add(m.user_id);
  });

  const adminUsers = new Set<number>();
  data.roles.forEach((r) => {
    if (r.role_name === 'admin') {
      adminUsers.add(r.user_id);
    }
  });

  const mutedByRoom = new Map<number, Set<number>>();
  data.muted.forEach((m) => {
    if (!mutedByRoom.has(m.room_id)) {
      mutedByRoom.set(m.room_id, new Set());
    }
    mutedByRoom.get(m.room_id)!.add(m.user_id);
  });

  const nicknameByRoomUser = new Map<string, string>();
  data.nicknames.forEach((n) => {
    if (n.nickname) {
      nicknameByRoomUser.set(`${n.room_id}:${n.user_id}`, n.nickname);
    }
  });

  return { userById, roomById, instanceById, moderatorsByInstance, adminUsers, mutedByRoom, nicknameByRoomUser };
}

function transformInstances(data: LegacyData): FirestoreDoc[] {
  return data.instances.map((instance) => {
    const instanceId = String(instance.id);
    return {
      path: `instances/${instanceId}`,
      data: {
        name: instance.title,
        ownerUid: buildLegacyUid(instance.owner_id),
        createdAt: toDate(instance.created_at),
        roomsCount: instance.rooms_count ?? 0,
        settings: { cloakMode: true },
      },
    };
  });
}

function transformUsers(data: LegacyData, cfg: Config, lookups: LookupMaps): FirestoreDoc[] {
  const docs: FirestoreDoc[] = [];
  const instanceUserSet = new Map<string, Set<number>>();

  const ensureSet = (instanceId: number) => {
    if (!instanceUserSet.has(String(instanceId))) {
      instanceUserSet.set(String(instanceId), new Set());
    }
    return instanceUserSet.get(String(instanceId))!;
  };

  data.instances.forEach((i) => ensureSet(i.id).add(i.owner_id));
  data.rooms.forEach((r) => {
    if (r.instance_id != null) {
      ensureSet(r.instance_id).add(r.owner_id);
    }
  });
  data.roomUsers.forEach((ru) => {
    const room = lookups.roomById.get(ru.room_id);
    if (room?.instance_id != null) {
      ensureSet(room.instance_id).add(ru.user_id);
    }
  });
  data.messages.forEach((m) => {
    const room = lookups.roomById.get(m.room_id);
    if (room?.instance_id != null) {
      ensureSet(room.instance_id).add(m.user_id);
    }
  });

  instanceUserSet.forEach((userIds, instanceId) => {
    userIds.forEach((userId) => {
      const profile = buildNym(instanceId, userId, cfg.nymSalt);
      const user = lookups.userById.get(userId);
      docs.push({
        path: `instances/${instanceId}/users/${profile.uid}`,
        data: {
          nymTag: profile.nymTag,
          glyphBits: profile.glyphBits,
          createdAt: user ? toDate(user.created_at) : null,
          legacyUserId: userId,
          legacyUsername: user?.username,
          legacyEmail: user?.email,
        },
      });
    });
  });

  return docs;
}

function deriveRole(
  instanceId: number,
  userId: number,
  lookups: LookupMaps,
  instanceOwnerId: number | null
): 'admin' | 'mod' | 'member' {
  if (instanceOwnerId === userId || lookups.adminUsers.has(userId)) {
    return 'admin';
  }
  const mods = lookups.moderatorsByInstance.get(instanceId);
  if (mods?.has(userId)) {
    return 'mod';
  }
  return 'member';
}

function transformRooms(data: LegacyData): FirestoreDoc[] {
  const docs: FirestoreDoc[] = [];
  data.rooms.forEach((room) => {
    if (room.instance_id == null) return;
    const instanceId = String(room.instance_id);
    const roomId = buildRoomId(room.id);
    docs.push({
      path: `instances/${instanceId}/rooms/${roomId}`,
      data: {
        title: room.title,
        createdAt: toDate(room.created_at),
        locked: room.locked,
        plannedLock: toDate(room.planned_lock),
        ownerUid: buildLegacyUid(room.owner_id),
        messagesCount: room.messages_count ?? 0,
      },
    });
  });
  return docs;
}

function transformMemberships(data: LegacyData, lookups: LookupMaps): FirestoreDoc[] {
  const docs: FirestoreDoc[] = [];
  data.roomUsers.forEach((ru) => {
    const room = lookups.roomById.get(ru.room_id);
    if (!room || room.instance_id == null) return;
    const instanceId = String(room.instance_id);
    const role = deriveRole(room.instance_id, ru.user_id, lookups, lookups.instanceById.get(room.instance_id)?.owner_id ?? null);
    const isMuted = lookups.mutedByRoom.get(ru.room_id)?.has(ru.user_id);
    const nickname = lookups.nicknameByRoomUser.get(`${ru.room_id}:${ru.user_id}`);
    docs.push({
      path: `instances/${instanceId}/rooms/legacy:${ru.room_id}/members/${buildLegacyUid(ru.user_id)}`,
      data: {
        role,
        lastReadAt: toDate(ru.updated_at),
        nickname: nickname || undefined,
        mutedUntil: isMuted ? new Date('9999-12-31T00:00:00Z') : null,
      },
    });
  });
  return docs;
}

function transformMessages(data: LegacyData, cfg: Config, lookups: LookupMaps): FirestoreDoc[] {
  const docs: FirestoreDoc[] = [];
  data.messages.forEach((message) => {
    const room = lookups.roomById.get(message.room_id);
    if (!room || room.instance_id == null) return;
    const instanceId = String(room.instance_id);
    const { uid, nymTag, glyphBits } = buildNym(instanceId, message.user_id, cfg.nymSalt);
    const messageId = buildMessageId(message.id);
    docs.push({
      path: `instances/${instanceId}/rooms/${buildRoomId(room.id)}/messages/${messageId}`,
      data: {
        authorUid: uid,
        nymTag,
        glyphBits,
        text: message.content,
        createdAt: toDate(message.created_at),
      },
    });
  });
  return docs;
}

function computeRoomMessageStats(messages: MessageRow[]): Map<number, { lastMessageAt: Date | null; lastMessagePreview: string }>
{
  const stats = new Map<number, { lastMessageAt: Date | null; lastMessagePreview: string }>();
  messages.forEach((m) => {
    const ts = toDate(m.created_at);
    const preview = (m.content || '').slice(0, 140);
    const current = stats.get(m.room_id);
    if (!current || (ts && current.lastMessageAt && ts.getTime() > current.lastMessageAt.getTime())) {
      stats.set(m.room_id, { lastMessageAt: ts, lastMessagePreview: preview });
    } else if (!current) {
      stats.set(m.room_id, { lastMessageAt: ts, lastMessagePreview: preview });
    }
  });
  return stats;
}

export function transformAll(data: LegacyData, cfg: Config): FirestoreDoc[] {
  const lookups = buildLookups(data);
  const docs: FirestoreDoc[] = [];
  const stats = computeRoomMessageStats(data.messages);

  docs.push(...transformInstances(data));
  docs.push(...transformRooms(data).map((doc) => {
    const roomId = doc.path.split('/')[3];
    const roomNumericId = Number(roomId.replace('legacy:', ''));
    const stat = stats.get(roomNumericId);
    return {
      ...doc,
      data: {
        ...doc.data,
        lastMessageAt: stat?.lastMessageAt ?? null,
        lastMessagePreview: stat?.lastMessagePreview ?? '',
      },
    };
  }));
  docs.push(...transformUsers(data, cfg, lookups));
  docs.push(...transformMemberships(data, lookups));
  docs.push(...transformMessages(data, cfg, lookups));

  return docs;
}
