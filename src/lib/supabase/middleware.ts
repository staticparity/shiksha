import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

export async function updateSession(request: NextRequest) {
  let supabaseResponse = NextResponse.next({
    request,
  });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value)
          );
          supabaseResponse = NextResponse.next({
            request,
          });
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          );
        },
      },
    }
  );

  // Refresh session - important for server components
  const {
    data: { user },
  } = await supabase.auth.getUser();

  // Public routes that don't require auth
  const publicRoutes = ["/", "/login", "/signup", "/callback"];
  const isPublicRoute = publicRoutes.some(
    (route) =>
      request.nextUrl.pathname === route ||
      request.nextUrl.pathname.startsWith("/api/")
  );

  if (!user && !isPublicRoute) {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    return NextResponse.redirect(url);
  }

  // Role-based routing for authenticated users
  if (user) {
    const pathname = request.nextUrl.pathname;

    // Check user role from school_members
    const { data: membership } = await supabase
      .from("school_members")
      .select("role")
      .eq("user_id", user.id)
      .limit(1)
      .single();

    const role = membership?.role ?? "student";

    // Redirect teachers away from student routes
    if (role === "teacher" && pathname === "/dashboard") {
      const url = request.nextUrl.clone();
      url.pathname = "/teacher/dashboard";
      return NextResponse.redirect(url);
    }

    // Redirect students away from teacher routes
    if (role === "student" && pathname.startsWith("/teacher")) {
      const url = request.nextUrl.clone();
      url.pathname = "/dashboard";
      return NextResponse.redirect(url);
    }

    // After login, redirect to correct dashboard
    if (pathname === "/login" || pathname === "/signup") {
      const url = request.nextUrl.clone();
      url.pathname = role === "teacher" ? "/teacher/dashboard" : "/dashboard";
      return NextResponse.redirect(url);
    }
  }

  return supabaseResponse;
}
