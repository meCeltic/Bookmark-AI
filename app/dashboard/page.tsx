import { redirect } from "next/navigation";
import { createServerClient } from "../../lib/server-supabase";
import DashboardContent from "./dashboard-content";

export default async function Dashboard() {
  console.log("Initializing Supabase client...");
  const supabase = createServerClient();

  console.log("Fetching user data...");
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    console.log("User not authenticated. Redirecting to /login...");
    redirect("/login");
  }

  console.log("User authenticated. Rendering DashboardContent...");
  return <DashboardContent user={user} />;
}
