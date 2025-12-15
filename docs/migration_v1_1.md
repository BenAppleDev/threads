# Firebase v1.1 migration (Rails/Postgres ➜ Firestore)

This guide describes how to migrate the legacy Rails/Postgres data into the Firebase v1 architecture without changing the legacy app.

## What moves (and what does not)

- **Migrated**: instances, rooms, messages, memberships, and deterministic anonymous user profiles (nymTag + glyphBits) created from legacy user IDs.
- **Not migrated**: Firebase Auth identities or passwords. Legacy users become Firestore users with IDs like `legacy:{legacyUserId}`.
- **Attachments/avatars**: not yet copied. The CLI can export references, but files are left for a later v1.2 pass.

## Prerequisites

- Legacy stack running (Postgres reachable). Example: `docker-compose up -d postgres redis website`.
- Firebase Emulator Suite running for Firestore (preferred for dry runs). Example: `firebase emulators:start`.
- Node 18+ available locally.
- No production credentials required for emulator runs.

Environment variables for the migration CLI live in `scripts/migrate_legacy_to_firestore/.env` (see `.env.example`). Key values:

- `PGHOST`, `PGPORT`, `PGUSER`, `PGPASSWORD`, `PGDATABASE` — Postgres connection.
- `MIGRATION_NYM_SALT` — must match the Cloud Functions salt so nym generation stays deterministic.
- `GOOGLE_APPLICATION_CREDENTIALS` — only required for `--target=prod` runs.

## Commands

All commands are executed from `scripts/migrate_legacy_to_firestore`.

```bash
cd scripts/migrate_legacy_to_firestore
npm install
```

### Export (Postgres ➜ JSONL)

```bash
npm run export -- --output=./out
```

- Reads legacy tables and writes JSONL files (`instances.jsonl`, `rooms.jsonl`, `users.jsonl`, `memberships.jsonl`, `messages.jsonl`) that already match the Firestore v1 model.
- Document IDs are deterministic (`legacy:{id}`) to make the export idempotent.

### Import (JSONL ➜ Firestore)

```bash
npm run import -- --target=emulator --output=./out
# or with a dry run
npm run import -- --target=emulator --output=./out -- --dry-run
```

- Defaults to the emulator; pass `--target=prod` only when authenticated with production credentials.
- Uses batch writes with `{ merge: true }` so re-running the import overwrites safely.
- `--dry-run` logs intended writes without touching Firestore.

### Validate (counts)

```bash
npm run validate -- --target=emulator
```

- Compares Postgres counts (rooms, memberships, messages) to Firestore collection group counts.
- Prints a diff summary to highlight mismatches.

## Data mapping

- **Instances**: `instances/{instanceId}` where `instanceId` is the legacy numeric ID as a string. `settings.cloakMode` is forced to `true`.
- **Users**: `instances/{instanceId}/users/legacy:{legacyUserId}` with deterministic `nymTag` and `glyphBits` using the shared salt. Legacy username/email are stored only for admin reference.
- **Rooms**: `instances/{instanceId}/rooms/legacy:{roomId}` with lock fields, owner UID, message counters, and last message preview/time derived from messages.
- **Memberships**: `instances/{instanceId}/rooms/{roomId}/members/legacy:{userId}`. Role resolution:
  - `admin` if the user is the instance owner or has the legacy `admin` role.
  - `mod` if the user appears in `moderatorships` for the instance.
  - `member` otherwise.
  - `mutedUntil` is set to a far-future timestamp when present in `muted_room_users`.
  - Nicknames from `room_user_nicknames` are preserved.
- **Messages**: `instances/{instanceId}/rooms/{roomId}/messages/legacy:{messageId}` with cloak-safe fields only (`authorUid`, `nymTag`, `glyphBits`, `text`, `createdAt`).

## Production run guidance

1. **Backup first**: snapshot the production database and Firestore.
2. **Dry-run**: run `export` and `import --dry-run` against an emulator or staging project.
3. **Test**: open the Next.js client against the emulator to verify migrated rooms/messages render correctly.
4. **Prod import**: set `--target=prod` with `GOOGLE_APPLICATION_CREDENTIALS` pointing at a service account that can write to Firestore. Re-run `import` until validation diffs are zero.

## Attachment follow-up

Legacy uploads (CarrierWave) are not copied in v1.1. If needed later, extend the CLI to copy files into `instances/{instanceId}/rooms/{roomId}/attachments/{uid}/{file}` in Cloud Storage and update message docs with references.
