import NextAuth from 'next-auth';
import {DrizzleAdapter} from '@auth/drizzle-adapter';
import GoogleProvider from 'next-auth/providers/google';
import GitHubProvider from 'next-auth/providers/github';
import {db} from '@/drizzle';
import {usersTable, accountsTable, sessionsTable} from '@/drizzle/db/schema';
import {
  transferCartOnLogin,
  transferFavoritesOnLogin,
} from '@/actions/lib/merge-on-login';
import {CART_SESSION_COOKIE} from '@/utils/cookies';
import {cookies} from 'next/headers';

export const {handlers, auth, signIn, signOut} = NextAuth({
  adapter: DrizzleAdapter(db, {
    usersTable,
    accountsTable,
    sessionsTable,
  }),
  session: {
    strategy: 'database',
    maxAge: 2 * 24 * 60 * 60,
    updateAge: 24 * 60 * 60,
  },
  providers: [
    GoogleProvider({
      clientId: process.env.GOOGLE_CLIENT_ID!,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
    }),
    GitHubProvider({
      clientId: process.env.GITHUB_ID!,
      clientSecret: process.env.GITHUB_SECRET!,
    }),
  ],
  callbacks: {
    signIn: async ({user}) => {
      if (user?.id) {
        try {
          await Promise.all([
            transferCartOnLogin(user.id),
            transferFavoritesOnLogin(user.id),
          ]);
          const cookieStore = await cookies();
          cookieStore.delete(CART_SESSION_COOKIE);
        } catch (error) {
          console.error(
            'Error transferring cart and favorites on login:',
            error
          );
        }
      }
      return true;
    },
    session: async ({session, user}) => {
      if (session.user) {
        session.user.id = user.id;
        session.user.role = user.role;
      }
      return session;
    },
  },
  pages: {
    signIn: '/log-in',
  },
});
