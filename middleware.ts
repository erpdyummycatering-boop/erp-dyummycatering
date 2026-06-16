import { withAuth } from "next-auth/middleware";
import { NextResponse } from "next/server";

export default process.env.NODE_ENV === "development"
  ? function middleware() { return NextResponse.next(); }
  : withAuth({
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
