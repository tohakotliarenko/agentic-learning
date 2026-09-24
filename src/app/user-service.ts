export interface User {
  readonly name: string;
  readonly email: string;
  readonly active: boolean;
}

export class UserService {
  private readonly users = new Map<string, User>();

  createUser(name: string, email: string): User {
    const emailKey = email.toLowerCase();
    if (this.users.has(emailKey)) {
      throw new Error('A user with this email already exists');
    }

    const user: User = Object.freeze({ name, email, active: true });
    this.users.set(emailKey, user);
    return user;
  }

  getUserByEmail(email: string): User | undefined {
    return this.users.get(email.toLowerCase());
  }

  deleteUser(email: string): boolean {
    return this.users.delete(email.toLowerCase());
  }

  deactivateUser(email: string): boolean {
    const emailKey = email.toLowerCase();
    const user = this.users.get(emailKey);
    if (!user) {
      return false;
    }

    if (user.active) {
      this.users.set(emailKey, Object.freeze({ ...user, active: false }));
    }
    return true;
  }
}
