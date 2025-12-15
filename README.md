# Threads

## Description

**Threads** is a simple anonymous discussion tool.  

To discuss current or potential uses, see our new [Threads forum](https://github.com/berkmancenter/threads/discussions). 

## Dev environment

### Stack

* Ruby on Rails 5.2
* Ruby 2.4.1
* Puma
* Redis
* Postgresql 9.6.x

### Docker

* `cp .env.example .env`
* `docker-compose up`
* `docker-compose exec website sh`
* `bundle exec rake db:create`
* `bundle exec rake db:migrate`
* The application will be available at `http://localhost:3000`

### Tests

* `bundle exec rspec spec`

## License

MIT

## Modern Firebase v1

A parallel Firebase/GCS implementation lives in the `apps/web`, `firebase`, and `functions` directories. Rails remains unchanged.

### Local quickstart

1. Install dependencies:
   ```bash
   cd functions && npm install
   cd ../apps/web && npm install
   ```
2. In `firebase/`, start the Emulator Suite (auth, firestore, functions):
   ```bash
   firebase emulators:start
   ```
3. In another terminal run the Next.js client:
   ```bash
   cd apps/web
   cp .env.example .env
   npm run dev
   ```
4. Visit `http://localhost:3000`, sign in anonymously, create/join rooms, and chat in real time. The callable `ensureNymProfile` sets your deterministic nym identity; Firestore rules enforce cloak mode and membership.

See [`docs/modernization_v1.md`](docs/modernization_v1.md) for architecture details, rules, and seeding helpers.
