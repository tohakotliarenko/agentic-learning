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

- `createUser(name, email)` stores and returns an immutable user. Duplicate emails throw an error.
- `getUserByEmail(email)` returns the user or `undefined` when no match exists.
- `deleteUser(email)` returns `true` when the user is deleted, or `false` when no match exists.

Email lookup, duplicate detection, and deletion are case-insensitive. Returned
users preserve the email spelling supplied at creation. Inputs are not trimmed
or validated. Each service instance has its own in-memory storage,
which is lost when the instance is discarded or the process exits.

Unit tests live in `tests/user-service.test.ts`.
