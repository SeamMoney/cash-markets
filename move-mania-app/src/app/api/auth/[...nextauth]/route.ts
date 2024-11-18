import NextAuth from "next-auth"
import GoogleProvider from "next-auth/providers/google"
import { setUpAndGetUser } from "@/lib/api"

const handler = NextAuth({
  secret: process.env.NEXTAUTH_SECRET || 'secret',
  providers: [
    GoogleProvider({
      clientId: process.env.GOOGLE_CLIENT_ID || '',
      clientSecret: process.env.GOOGLE_CLIENT_SECRET || '',
    })
  ],
  callbacks: {
    async signIn({ user, account, profile, email, credentials }) {
      console.log("SignIn callback started", { user, account, profile, email });

      if (!user.email) {
        console.error("User email is missing")
        return false
      }

      try {
        console.log("Attempting to set up user", user.email);

        const newUser = await setUpAndGetUser({
          email: user.email,
          username: user.name || '',
          image: user.image || '',
          referred_by: null,
        })

        console.log("User setup result:", newUser);

        // Always return true to allow sign in
        return true
      } catch (error) {
        console.error("Error in sign in callback:", error)
        // Still return true to allow sign in
        return true
      }
    },
  },
  debug: true,
  logger: {
    error(code, metadata) {
      console.error("NextAuth Error:", code, metadata)
    },
    warn(code) {
      console.warn("NextAuth Warning:", code)
    },
    debug(code, metadata) {
      console.log("NextAuth Debug:", code, metadata)
    }
  }
});

export { handler as GET, handler as POST }