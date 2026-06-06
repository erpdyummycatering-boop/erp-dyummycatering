import { withAuth } from "next-auth/middleware";

export default withAuth({
  pages: {
    signIn: "/login",
  },
});

export const config = {
  matcher: [
    // Protect all routes except api/auth, login, print, static, images, favicon
    "/((?!api/auth|login|print|_next/static|_next/image|favicon.ico).*)",
  ],
};
