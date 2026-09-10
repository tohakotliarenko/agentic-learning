import { beforeEach, describe, expect, it } from 'vitest';
import { UserService } from '../src/user-service.js';

describe('UserService', () => {
  let service: UserService;

  beforeEach(() => {
    service = new UserService();
  });

  it('creates and retrieves a user by email', () => {
    const user = service.createUser('Ada', 'ada@example.com');

    expect(user).toEqual({ name: 'Ada', email: 'ada@example.com' });
    expect(service.getUserByEmail('ada@example.com')).toEqual(user);
  });

  it('returns undefined for an unknown email', () => {
    expect(service.getUserByEmail('unknown@example.com')).toBeUndefined();
  });

  it.each([
    ['john@example.com', 'John@Example.com'],
    ['John@Example.com', 'john@example.com'],
  ])('finds %s using %s', (createdEmail, lookupEmail) => {
    const user = service.createUser('John', createdEmail);

    expect(service.getUserByEmail(lookupEmail)).toEqual(user);
    expect(user.email).toBe(createdEmail);
  });

  it('rejects duplicate emails without replacing the original user', () => {
    service.createUser('Ada', 'ada@example.com');

    expect(() => service.createUser('Other', 'ada@example.com')).toThrow(
      'A user with this email already exists',
    );
    expect(service.getUserByEmail('ada@example.com')?.name).toBe('Ada');
  });

  it('stores multiple users independently', () => {
    const ada = service.createUser('Ada', 'ada@example.com');
    const grace = service.createUser('Grace', 'grace@example.com');

    expect(service.getUserByEmail('ada@example.com')).toEqual(ada);
    expect(service.getUserByEmail('grace@example.com')).toEqual(grace);
  });

  it('rejects duplicate emails regardless of case without replacing the user', () => {
    const user = service.createUser('John', 'John@Example.com');

    expect(() => service.createUser('Other', 'john@example.com')).toThrow(
      'A user with this email already exists',
    );
    expect(service.getUserByEmail('JOHN@EXAMPLE.COM')).toEqual(user);
  });

  it('deletes by email regardless of case and allows reusing the email', () => {
    service.createUser('John', 'John@Example.com');
    const other = service.createUser('Other', 'other@example.com');

    expect(service.deleteUser('JOHN@example.COM')).toBe(true);
    expect(service.getUserByEmail('John@Example.com')).toBeUndefined();
    expect(service.deleteUser('john@example.com')).toBe(false);
    expect(service.getUserByEmail('other@example.com')).toEqual(other);

    const replacement = service.createUser('New John', 'john@example.com');
    expect(service.getUserByEmail('John@Example.com')).toEqual(replacement);
  });

  it('keeps storage separate for each service instance', () => {
    service.createUser('Ada', 'ada@example.com');

    expect(new UserService().getUserByEmail('ada@example.com')).toBeUndefined();
  });

  it('deletes a user and leaves other users unchanged', () => {
    service.createUser('Ada', 'ada@example.com');
    const grace = service.createUser('Grace', 'grace@example.com');

    expect(service.deleteUser('ada@example.com')).toBe(true);
    expect(service.getUserByEmail('ada@example.com')).toBeUndefined();
    expect(service.getUserByEmail('grace@example.com')).toEqual(grace);
  });

  it('returns false when deleting an unknown user', () => {
    expect(service.deleteUser('unknown@example.com')).toBe(false);
  });

  it('returns false when deleting the same user again', () => {
    service.createUser('Ada', 'ada@example.com');
    service.deleteUser('ada@example.com');

    expect(service.deleteUser('ada@example.com')).toBe(false);
  });

  it('allows creating a user with a deleted email', () => {
    service.createUser('Ada', 'ada@example.com');
    service.deleteUser('ada@example.com');

    const replacement = service.createUser('Other', 'ada@example.com');

    expect(service.getUserByEmail('ada@example.com')).toEqual(replacement);
  });
});
