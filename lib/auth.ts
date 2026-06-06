import { NextAuthOptions } from "next-auth";
import GoogleProvider from "next-auth/providers/google";
import pool from "./db";

export const authOptions: NextAuthOptions = {
  providers: [
    GoogleProvider({
      clientId: process.env.GOOGLE_CLIENT_ID || "",
      clientSecret: process.env.GOOGLE_CLIENT_SECRET || "",
    }),
  ],
  callbacks: {
    async signIn({ user, account }) {
      if (account?.provider === "google" && user.email) {
        const client = await pool.connect();
        try {
          const res = await client.query("SELECT id, status FROM users WHERE email = $1", [user.email]);
          if (res.rows.length === 0) {
            return false; // Email not registered, reject login
          }
          const dbUser = res.rows[0];
          if (dbUser.status !== "Aktif") {
            return false; // User not active, reject login
          }
        } catch (e) {
          console.error("Sign in validation error:", e);
          return false;
        } finally {
          client.release();
        }
      }
      return true;
    },
    async jwt({ token, user }) {
      if (user) {
        token.id = user.id;
        token.role = (user as any).role;
      }
      // Keep jwt tokens synchronized with the users DB roles
      if (token.email) {
        const client = await pool.connect();
        try {
          const res = await client.query("SELECT id, role, name FROM users WHERE email = $1", [token.email]);
          if (res.rows.length > 0) {
            token.id = String(res.rows[0].id);
            token.role = res.rows[0].role;
            token.name = res.rows[0].name;
          }
        } catch (e) {
          console.error("JWT sync error:", e);
        } finally {
          client.release();
        }
      }
      return token;
    },
    async session({ session, token }) {
      if (session.user) {
        (session.user as any).id = token.id;
        (session.user as any).role = token.role;
        (session.user as any).name = token.name;
      }
      return session;
    }
  },
  pages: {
    signIn: "/login",
    error: "/login",
  },
  session: {
    strategy: "jwt",
  },
  secret: process.env.NEXTAUTH_SECRET,
};
