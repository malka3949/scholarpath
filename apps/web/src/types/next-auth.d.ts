import 'next-auth';
import 'next-auth/jwt';
import type { AuthUser } from './api';

declare module 'next-auth' {
  interface Session {
    accessToken: string;
    user: {
      id: string;
      email?: string | null;
      name?: string | null;
      role: AuthUser['role'];
      profile: AuthUser['profile'];
    };
  }

  interface User {
    accessToken?: string;
    role?: AuthUser['role'];
    profile?: AuthUser['profile'];
  }
}

declare module 'next-auth/jwt' {
  interface JWT {
    accessToken?: string;
    role?: AuthUser['role'];
    profile?: AuthUser['profile'];
  }
}
