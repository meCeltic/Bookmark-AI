import { NextResponse } from "next/server"
import { createRouteHandler } from "@/lib/supabase-route-handler"

export async function GET() {
  try {
    const supabase = createRouteHandler()

    // Check if user is authenticated
    const {
      data: user,
    } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    // Check if the bookmarks table exists
    const { error: checkError } = await supabase.from("bookmarks").select("id").limit(1)

    if (checkError && checkError.message.includes("does not exist")) {
      // Table doesn't exist, so create it

      // Create the bookmarks table
      const { error: createTableError } = await supabase.rpc("exec_sql", {
        sql: `
          CREATE TABLE IF NOT EXISTS public.bookmarks (
            id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
            user_id UUID REFERENCES auth.users(id) NOT NULL,
            url TEXT NOT NULL,
            title TEXT,
            favicon TEXT,
            summary TEXT,
            tags TEXT[] DEFAULT '{}',
            created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
          );
        `,
      })

      if (createTableError) {
        console.error("Error creating table:", createTableError)

        // If the exec_sql function doesn't exist, we need to use a different approach
        if (createTableError.message.includes("function") && createTableError.message.includes("does not exist")) {
          // We'll use the Supabase REST API directly to create the table
          // This requires using the service role key which has more permissions

          // First, let's try to use the Supabase SQL HTTP API
          try {
            const response = await fetch(`${process.env.SUPABASE_URL}/rest/v1/`, {
              method: "POST",
              headers: {
                "Content-Type": "application/json",
                apikey: process.env.SUPABASE_SERVICE_ROLE_KEY || "",
                Authorization: `Bearer ${process.env.SUPABASE_SERVICE_ROLE_KEY || ""}`,
                Prefer: "return=minimal",
              },
              body: JSON.stringify({
                query: `
                  CREATE TABLE IF NOT EXISTS public.bookmarks (
                    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
                    user_id UUID REFERENCES auth.users(id) NOT NULL,
                    url TEXT NOT NULL,
                    title TEXT,
                    favicon TEXT,
                    summary TEXT,
                    tags TEXT[] DEFAULT '{}',
                    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
                  );
                  
                  -- Set up RLS (Row Level Security)
                  ALTER TABLE public.bookmarks ENABLE ROW LEVEL SECURITY;
                  
                  -- Create policy to allow users to see only their own bookmarks
                  CREATE POLICY "Users can view their own bookmarks" 
                    ON public.bookmarks FOR SELECT 
                    USING (auth.uid() = user_id);
                  
                  -- Create policy to allow users to insert their own bookmarks
                  CREATE POLICY "Users can insert their own bookmarks" 
                    ON public.bookmarks FOR INSERT 
                    WITH CHECK (auth.uid() = user_id);
                  
                  -- Create policy to allow users to update their own bookmarks
                  CREATE POLICY "Users can update their own bookmarks" 
                    ON public.bookmarks FOR UPDATE 
                    USING (auth.uid() = user_id);
                  
                  -- Create policy to allow users to delete their own bookmarks
                  CREATE POLICY "Users can delete their own bookmarks" 
                    ON public.bookmarks FOR DELETE 
                    USING (auth.uid() = user_id);
                `,
              }),
            })

            if (!response.ok) {
              const errorText = await response.text()
              console.error("Error creating table via REST API:", errorText)
              return NextResponse.json({ error: "Failed to create database schema via REST API" }, { status: 500 })
            }
          } catch (error) {
            console.error("Error using REST API:", error)
            return NextResponse.json({ error: "Failed to create database schema via REST API" }, { status: 500 })
          }
        } else {
          return NextResponse.json(
            { error: "Failed to create database schema: " + createTableError.message },
            { status: 500 },
          )
        }
      }

      // Set up RLS and policies
      const setupRLS = async () => {
        // Enable RLS
        const { error: rlsError } = await supabase.rpc("exec_sql", {
          sql: `ALTER TABLE public.bookmarks ENABLE ROW LEVEL SECURITY;`,
        })

        if (rlsError && !rlsError.message.includes("does not exist")) {
          console.error("Error enabling RLS:", rlsError)
        }

        // Create policies
        const policies = [
          `CREATE POLICY IF NOT EXISTS "Users can view their own bookmarks" 
            ON public.bookmarks FOR SELECT 
            USING (auth.uid() = user_id);`,
          `CREATE POLICY IF NOT EXISTS "Users can insert their own bookmarks" 
            ON public.bookmarks FOR INSERT 
            WITH CHECK (auth.uid() = user_id);`,
          `CREATE POLICY IF NOT EXISTS "Users can update their own bookmarks" 
            ON public.bookmarks FOR UPDATE 
            USING (auth.uid() = user_id);`,
          `CREATE POLICY IF NOT EXISTS "Users can delete their own bookmarks" 
            ON public.bookmarks FOR DELETE 
            USING (auth.uid() = user_id);`,
        ]

        for (const policy of policies) {
          const { error: policyError } = await supabase.rpc("exec_sql", { sql: policy })
          if (policyError && !policyError.message.includes("does not exist")) {
            console.error("Error creating policy:", policyError)
          }
        }
      }

      // Try to set up RLS and policies, but don't fail if it doesn't work
      // We'll handle this in the Supabase dashboard if needed
      try {
        await setupRLS()
      } catch (error) {
        console.error("Error setting up RLS:", error)
      }
    }

    // Check if the table exists now
    const { error: finalCheckError } = await supabase.from("bookmarks").select("id").limit(1)

    if (finalCheckError && finalCheckError.message.includes("does not exist")) {
      return NextResponse.json({
        success: false,
        message: "Failed to create the bookmarks table. Please set up the database manually in the Supabase dashboard.",
        error: finalCheckError.message,
      })
    }

    return NextResponse.json({ success: true, message: "Database setup completed successfully" })
  } catch (error: any) {
    console.error("Setup error:", error)
    return NextResponse.json({ error: "Setup failed: " + error.message }, { status: 500 })
  }
}
