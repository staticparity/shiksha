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

  const pathname = request.nextUrl.pathname;
  const isApiRoute = pathname.startsWith('/api/');
  const isPublicRoute = ['/', '/login', '/signup', '/callback'].includes(pathname) || isApiRoute;
  const redirectWithCookies = (path: string) => {
    const response = NextResponse.redirect(new URL(path, request.url));
    supabaseResponse.cookies.getAll().forEach(cookie => response.cookies.set(cookie));
    return response;
  };

  // Refresh session — handle stale tokens gracefully
  let user = null;
  try {
    const { data, error } = await supabase.auth.getUser();
    if (error && (error.status ?? 0) >= 500) throw error;
    user = data.user;
  } catch {
    // A network outage is not proof that a refresh token is invalid. Preserve
    // cookies and let public/auth routes recover without a redirect loop.
    if (isApiRoute) return NextResponse.json({ error: 'Authentication is temporarily unavailable. Please try again.' }, { status: 503 });
    if (isPublicRoute) return supabaseResponse;
    return new NextResponse('Authentication is temporarily unavailable. Please refresh to try again.', { status: 503 });
  }

  if (!user && !isPublicRoute) {
    return redirectWithCookies(`/login?next=${encodeURIComponent(pathname + request.nextUrl.search)}`);
  }

  // API handlers enforce their own authorization and always return API errors.
  if (isApiRoute) return supabaseResponse;

  // Role-based routing for authenticated users
  if (user && (['/dashboard', '/login', '/signup'].includes(pathname) || pathname.startsWith('/teacher'))) {
    // Check user role from school_members
    const { data: membership, error: membershipError } = await supabase
      .from("school_members")
      .select("role")
      .eq("user_id", user.id)
      .limit(1)
      .maybeSingle();

    if (membershipError) return new NextResponse('Could not load your workspace. Please refresh to try again.', { status: 503 });

    const role = membership?.role ?? "student";

    // Redirect teachers away from student routes
    if (role === "teacher" && pathname === "/dashboard") {
      return redirectWithCookies('/teacher/dashboard');
    }

    // Redirect students away from teacher routes
    if (role === "student" && pathname.startsWith("/teacher")) {
      return redirectWithCookies('/dashboard');
    }

    // After login, redirect to correct dashboard
    if (pathname === "/login" || pathname === "/signup") {
      return redirectWithCookies(role === 'teacher' ? '/teacher/dashboard' : '/dashboard');
    }
  }

  return supabaseResponse;
}
