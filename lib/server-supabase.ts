import { createServerComponentClient } from "@supabase/auth-helpers-nextjs";
import { cookies } from "next/headers";

// Server component client (this is recreated for each request, so no singleton needed)
export const createServerClient = () => {
  const cookieStore = cookies(); // Ensure cookies() is accessed synchronously
  return createServerComponentClient(
    { cookies: () => cookieStore },
    {
      supabaseUrl: process.env.SUPABASE_URL!,
      supabaseKey: process.env.SUPABASE_ANON_KEY!,
    }
  );
};
