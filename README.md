# Agent workflows learning project

A small TypeScript Node.js project with strict type checking, Vitest, and ESLint.
No AI functionality or external storage.

```sh
npm ci
npm test
npm run lint
npm run typecheck
```

`src/user-service.ts` exports `UserService`:

- `createUser(name, email)` stores and returns an immutable user with `active: true`. Duplicate emails throw an error, including for inactive users.
- `getUserByEmail(email)` returns the user (active or inactive) or `undefined` when no match exists.
- `deleteUser(email)` returns `true` when the user is deleted, or `false` when no match exists.
- `deactivateUser(email)` sets `active` to `false` without deleting the user. Returns `true` for any existing user, including one already inactive, or `false` for an unknown user.

Returned users are immutable snapshots. Retrieve the user again after deactivation
to see the updated state.

Email lookup, duplicate detection, deletion, and deactivation are case-insensitive. Returned
users preserve the email spelling supplied at creation. Inputs are not trimmed
or validated. Each service instance has its own in-memory storage,
which is lost when the instance is discarded or the process exits.

Unit tests live in `tests/user-service.test.ts`.
