import createIntlMiddleware from "next-intl/middleware";
import { createServerClient } from "@supabase/ssr";
import { NextRequest } from "next/server";
import { routing } from "./i18n/routing";

const intl = createIntlMiddleware(routing);
export default async function middleware(request: NextRequest) {
  let response = intl(request);
  const supabase = createServerClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, {
    cookies: {
      getAll: () => request.cookies.getAll(),
      setAll: (items, headers) => {
        items.forEach(({name,value}) => request.cookies.set(name,value));
        const intlResponse = intl(request);
        items.forEach(({name,value,options}) => intlResponse.cookies.set(name,value,options));
        Object.entries(headers).forEach(([name,value]) => intlResponse.headers.set(name,value));
        response = intlResponse;
      },
    },
  });
  // getUser validates and refreshes the auth session when necessary. Never trust getSession in middleware.
  await supabase.auth.getUser();
  // Authenticated and guest HTML must never enter shared CDN caches.
  response.headers.set("Cache-Control", "private, no-store, max-age=0");
  return response;
}
export const config={matcher:"/((?!api|auth/callback|_next|_vercel|.*\\..*).*)"};
