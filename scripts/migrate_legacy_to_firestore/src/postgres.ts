import { Pool } from 'pg';
import { Config } from './config';

export interface InstanceRow {
  id: number;
  title: string;
  owner_id: number;
  created_at: string;
  rooms_count: number | null;
}

export interface RoomRow {
  id: number;
  instance_id: number | null;
  owner_id: number;
  title: string;
  created_at: string;
  locked: boolean;
  planned_lock: string | null;
  messages_count: number | null;
}

export interface UserRow {
  id: number;
  username: string;
  email: string;
  created_at: string;
}

export interface MessageRow {
  id: number;
  room_id: number;
  user_id: number;
  content: string;
  created_at: string;
}

export interface RoomUserRow {
  room_id: number;
  user_id: number;
  last_read_message_id: number | null;
  created_at: string;
  updated_at: string;
}

export interface ModeratorRow {
  instance_id: number | null;
  user_id: number;
}

export interface RoleUserRow {
  role_id: number;
  user_id: number;
  role_name: string;
}

export interface MutedRow {
  room_id: number;
  user_id: number;
}

export interface NicknameRow {
  room_id: number;
  user_id: number;
  nickname: string | null;
}

export interface LegacyData {
  instances: InstanceRow[];
  rooms: RoomRow[];
  users: UserRow[];
  messages: MessageRow[];
  roomUsers: RoomUserRow[];
  moderators: ModeratorRow[];
  roles: RoleUserRow[];
  muted: MutedRow[];
  nicknames: NicknameRow[];
}

export async function connect(config: Config): Promise<Pool> {
  const pool = new Pool({
    host: config.pg.host,
    port: config.pg.port,
    user: config.pg.user,
    password: config.pg.password,
    database: config.pg.database,
  });
  return pool;
}

async function fetchRows<T>(pool: Pool, query: string): Promise<T[]> {
  const { rows } = await pool.query<T>(query);
  return rows;
}

export async function loadLegacyData(pool: Pool): Promise<LegacyData> {
  const [instances, rooms, users, messages, roomUsers, moderators, roles, muted, nicknames] = await Promise.all([
    fetchRows<InstanceRow>(pool, 'select id, title, owner_id, created_at, rooms_count from instances'),
    fetchRows<RoomRow>(
      pool,
      'select id, instance_id, owner_id, title, created_at, locked, planned_lock, messages_count from rooms'
    ),
    fetchRows<UserRow>(pool, 'select id, username, email, created_at from users'),
    fetchRows<MessageRow>(pool, 'select id, room_id, user_id, content, created_at from messages'),
    fetchRows<RoomUserRow>(
      pool,
      'select room_id, user_id, last_read_message_id, created_at, updated_at from room_users'
    ),
    fetchRows<ModeratorRow>(pool, 'select instance_id, user_id from moderatorships'),
    fetchRows<RoleUserRow>(
      pool,
      "select roles_users.role_id, roles_users.user_id, roles.name as role_name from roles_users join roles on roles.id = roles_users.role_id"
    ),
    fetchRows<MutedRow>(pool, 'select room_id, user_id from muted_room_users'),
    fetchRows<NicknameRow>(pool, 'select room_id, user_id, nickname from room_user_nicknames'),
  ]);

  return { instances, rooms, users, messages, roomUsers, moderators, roles, muted, nicknames };
}

export async function loadCounts(pool: Pool): Promise<{ rooms: number; messages: number; memberships: number }> {
  const [rooms, messages, memberships] = await Promise.all([
    pool.query<{ count: string }>('select count(*)::int as count from rooms'),
    pool.query<{ count: string }>('select count(*)::int as count from messages'),
    pool.query<{ count: string }>('select count(*)::int as count from room_users'),
  ]);

  return {
    rooms: Number(rooms.rows[0].count),
    messages: Number(messages.rows[0].count),
    memberships: Number(memberships.rows[0].count),
  };
}
