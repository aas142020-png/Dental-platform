import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@dental/db-types";

/**
 * Every API function takes the client as its first argument. No singletons:
 * the web app passes a server or browser client; a future native app passes its own.
 */
export type DentalClient = SupabaseClient<Database>;
