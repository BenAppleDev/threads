# Modernization v1: Firebase-first architecture

This document describes the parallel Firebase/GCS stack that lives alongside the legacy Rails app.

## Data model (Cloud Firestore)

```
instances/{instanceId}
  name, ownerUid, createdAt, roomsCount, settings { cloakMode: boolean }, theme { ... }
  rooms/{roomId}
    title, createdAt, locked, plannedLock, ownerUid, lastMessageAt, messagesCount, lastMessagePreview
    messages/{messageId}
      authorUid, nymTag, glyphBits, text, createdAt, deletedAt?, flags?
    members/{uid}
      role: "member"|"mod"|"admin", mutedUntil?, lastReadAt, nickname?
  users/{uid}
    nymTag, glyphBits, createdAt, roles, isBanned?
```

### Cloak mode
All messaging UI and writes must avoid real identity fields. Only `nymTag` and `glyphBits` identify a sender. Security rules reject forbidden keys such as `email`, `username`, or `realName` in message documents.

## Security rules

* Authentication is required for all reads and writes (anonymous auth allowed).
* Reading messages requires a membership document under `members/{uid}`.
* Writing a message requires membership, room unlocked (unless `mod/admin`), and the user must not be muted.
* Mods/admins can change other members or delete messages; users can create/update their own membership docs when joining.
* Storage uploads are limited to members at `instances/{instanceId}/rooms/{roomId}/attachments/{uid}/...` and reads are likewise restricted.

See [`firebase/firestore.rules`](../firebase/firestore.rules) and [`firebase/storage.rules`](../firebase/storage.rules) for the exact logic.

## Cloud Functions (TypeScript)

* **ensureNymProfile**: HTTPS callable that deterministically generates a `nymTag` and `glyphBits` (8x8 pattern) from `instanceId + uid + salt`. The salt is provided via `functions:config:set nym.salt="..."` or `NYM_SALT` in the environment. Creates `instances/{instanceId}/users/{uid}` if missing.
* **onMessageCreated**: Firestore trigger that updates room counters (`messagesCount`, `lastMessageAt`, `lastMessagePreview`).
* **moderationStub**: Callable placeholder that flags messages containing simple banned keywords.

Functions live in [`functions/src/index.ts`](../functions/src/index.ts) and compile to `functions/lib` via `npm run build`.

## Web client (Next.js)

Located at [`apps/web`](../apps/web):

* Anonymous sign-in via Firebase Auth.
* `ensureNymProfile` invoked on instance entry.
* Room list with creation + join (`/instances/[instanceId]/rooms`).
* Realtime message view with cloak chip, glyph renderer, and composer (`/instances/[instanceId]/rooms/[roomId]`).
* Styling uses simple Vaporwave/space gradients with minimal components.

## Local development

1. Install dependencies:
   ```bash
   cd firebase && npm install -g firebase-tools # if not already
   cd ../functions && npm install
   cd ../apps/web && npm install
   ```
2. From `firebase/`, start emulators:
   ```bash
   firebase emulators:start
   ```
3. In another terminal, run the web app:
   ```bash
   cd apps/web
   cp .env.example .env # update values if needed
   npm run dev
   ```
4. Navigate to `http://localhost:3000`. The default flow signs you in anonymously, ensures a nym profile, allows creating/joining rooms, and sending messages in real time.

### Seeding a demo instance

The script [`scripts/seed_demo.ts`](../scripts/seed_demo.ts) seeds a demo instance/room against the emulators using the Admin SDK.

Run with:
```bash
cd scripts
npm install
node seed_demo.ts
```

Ensure `FIREBASE_EMULATOR_HOST` variables are set (the script defaults to localhost ports used in `firebase.json`).

## Deployment notes

* No secrets are committed. Provide `NYM_SALT` via environment or `functions:config:set nym.salt="your-secret"` before deploying functions.
* Rails remains untouched; the Firebase stack lives in parallel directories.
