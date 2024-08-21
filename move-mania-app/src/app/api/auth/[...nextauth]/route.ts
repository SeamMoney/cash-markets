import NextAuth from "next-auth"
import GoogleProvider from "next-auth/providers/google"

console.log("GOOGLE_CLIENT_ID:", process.env.GOOGLE_CLIENT_ID)
console.log("GOOGLE_CLIENT_SECRET is set:", !!process.env.GOOGLE_CLIENT_SECRET)
console.log("NEXTAUTH_SECRET is set:", !!process.env.NEXTAUTH_SECRET)

const handler = NextAuth({
  // Add secret
  secret: process.env.NEXTAUTH_SECRET || 'secret',
  providers: [
    // GithubProvider({
    //   clientId: process.env.GITHUB_ID,
    //   clientSecret: process.env.GITHUB_SECRET,
    // }),
    GoogleProvider({
      clientId: process.env.GOOGLE_CLIENT_ID || '',
      clientSecret: process.env.GOOGLE_CLIENT_SECRET || '',
    })
    // ...add more providers here
  ],
});


export { handler as GET, handler as POST }