import { ReactNode } from "react";
import { redirect } from "next/navigation";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import Link from "next/link";
import { ArrowLeft, Shield } from "lucide-react";
import GradientBackground from "@/components/GradientBackground";

export default async function AdminLayout({ children }: { children: ReactNode }) {
  // Next.js 15+: cookies() is async and must be awaited
  const cookieStore = await cookies();

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

  const supabase = createServerClient(supabaseUrl, supabaseAnonKey, {
    cookies: {
      get(name: string) {
        return cookieStore.get(name)?.value;
      },
      set() {},
      remove() {},
    },
  });

  const { data: { session } } = await supabase.auth.getSession();

  if (!session) {
    redirect("/login");
  }

  const adminEmails = (process.env.ADMIN_EMAILS || process.env.ADMIN_EMAIL || "")
    .split(",")
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean);
  const sessionEmail = session.user.email?.trim().toLowerCase();
  if (!sessionEmail || !adminEmails.includes(sessionEmail)) {
    redirect("/dashboard");
  }

  return (
    <div className="relative min-h-screen bg-transparent select-text">
      <GradientBackground />
      
      {/* Admin Secure Topbar */}
      <div className="relative z-50 bg-heading/90 backdrop-blur-md border-b border-white/15 px-6 py-4 flex items-center justify-between shadow-2xl">
        <Link href="/admin" className="flex items-center gap-3 group rounded-[4px] transition-all duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40 focus-visible:ring-offset-2">
          <div className="w-10 h-10 rounded-md bg-danger/20 text-danger flex items-center justify-center border border-danger/40 group-hover:scale-105 transition-transform">
            <Shield size={20} />
          </div>
          <div>
            <h1 className="text-white font-bold text-xl leading-tight tracking-[0.02em]">Supervisor</h1>
            <p className="text-white/80 text-sm font-medium leading-snug tracking-[0.03em]">Global Admin Access</p>
          </div>
        </Link>
        
        <Link href="/dashboard" className="flex items-center gap-2 text-sm font-semibold text-white/75 hover:text-white transition-all duration-150 bg-white/10 py-2 px-4 rounded-md border border-white/15 hover:bg-white/20 active:scale-[0.97] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40 focus-visible:ring-offset-2 group">
          <ArrowLeft size={16} className="group-hover:-translate-x-1 transition-transform" />
          Exit Admin
        </Link>
      </div>

      <div className="relative z-10 w-full max-w-[1400px] mx-auto">
        {children}
      </div>
    </div>
  );
}
