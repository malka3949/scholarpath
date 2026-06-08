import type { NextAuthOptions } from 'next-auth';
import CredentialsProvider from 'next-auth/providers/credentials';
import GoogleProvider from 'next-auth/providers/google';
import {
  googleAuthRequest,
  loginRequest,
  type AuthUser,
} from './api';

export const authOptions: NextAuthOptions = {
  session: { strategy: 'jwt' },
  pages: {
    signIn: '/login',
  },
  providers: [
    CredentialsProvider({
      name: 'credentials',
      credentials: {
        email: { label: 'Email', type: 'email' },
        password: { label: 'Password', type: 'password' },
      },
      async authorize(credentials) {
        if (!credentials?.email || !credentials?.password) return null;
        try {
          const result = await loginRequest(
            credentials.email,
            credentials.password,
          );
          return {
            id: result.user.id,
            email: result.user.email,
            name: result.user.name,
            accessToken: result.accessToken,
            role: result.user.role,
            profile: result.user.profile,
          };
        } catch {
          return null;
        }
      },
    }),
    ...(process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET
      ? [
          GoogleProvider({
            clientId: process.env.GOOGLE_CLIENT_ID,
            clientSecret: process.env.GOOGLE_CLIENT_SECRET,
          }),
        ]
      : []),
  ],
  callbacks: {
    async signIn({ user, account, profile }) {
      if (account?.provider === 'google' && profile?.email) {
        try {
          const result = await googleAuthRequest({
            googleId: account.providerAccountId,
            email: profile.email,
            name: profile.name ?? undefined,
          });
          user.accessToken = result.accessToken;
          user.role = result.user.role;
          user.profile = result.user.profile;
          user.id = result.user.id;
          return true;
        } catch {
          return false;
        }
      }
      return true;
    },
    async jwt({ token, user, account }) {
      if (user) {
        token.accessToken = (user as { accessToken?: string }).accessToken;
        token.role = (user as { role?: AuthUser['role'] }).role;
        token.profile = (user as { profile?: AuthUser['profile'] }).profile;
        token.sub = user.id;
      }
      if (account?.provider === 'google' && user) {
        token.accessToken = (user as { accessToken?: string }).accessToken;
      }
      return token;
    },
    async session({ session, token }) {
      if (session.user) {
        session.user.id = token.sub ?? '';
        session.user.role = token.role as AuthUser['role'];
        session.user.profile = token.profile as AuthUser['profile'];
      }
      session.accessToken = token.accessToken as string;
      return session;
    },
  },
  secret: process.env.NEXTAUTH_SECRET,
};
