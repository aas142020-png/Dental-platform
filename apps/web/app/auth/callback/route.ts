import { NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { safeAuthNext } from "@/lib/auth-redirect";
import type { Database } from "@dental/db-types";


export async function GET(request: Request) {
  const url = new URL(request.url);
  const locale = url.searchParams.get("locale") === "en" ? "en" : "ar";
  const next = safeAuthNext(url.searchParams.get("next"), locale);
  const code = url.searchParams.get("code");
  if (!code) return NextResponse.redirect(new URL(`/${locale}/sign-in?error=callback`, url.origin));
  const store = await cookies();
  const supabase = createServerClient<Database>(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, {
    cookies: { getAll: () => store.getAll(), setAll: (items) => items.forEach(({name,value,options}) => store.set(name,value,options)) },
  });
  const { error } = await supabase.auth.exchangeCodeForSession(code);
  const response=NextResponse.redirect(new URL(error ? `/${locale}/sign-in?error=callback` : next, url.origin));
  response.headers.set("Cache-Control", "private, no-store, max-age=0");
  return response;
}

