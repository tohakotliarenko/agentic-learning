export interface User {
  readonly name: string;
  readonly email: string;
}

export class UserService {
  private readonly users = new Map<string, User>();

  createUser(name: string, email: string): User {
    const emailKey = email.toLowerCase();
    if (this.users.has(emailKey)) {
      throw new Error('A user with this email already exists');
    }

    const user: User = Object.freeze({ name, email });
    this.users.set(emailKey, user);
    return user;
  }

  getUserByEmail(email: string): User | undefined {
    return this.users.get(email.toLowerCase());
  }

  deleteUser(email: string): boolean {
    return this.users.delete(email.toLowerCase());
  }
}
