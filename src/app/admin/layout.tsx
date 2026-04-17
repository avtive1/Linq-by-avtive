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

  const adminEmail = process.env.ADMIN_EMAIL?.trim();
  if (!adminEmail || session.user.email?.trim() !== adminEmail) {
    redirect("/dashboard");
  }

  return (
    <div className="relative min-h-screen bg-transparent select-text">
      <GradientBackground />
      
      {/* Admin Secure Topbar */}
      <div className="relative z-50 bg-[#161122]/80 backdrop-blur-md border-b border-white/10 px-6 py-4 flex items-center justify-between shadow-2xl">
        <Link href="/admin" className="flex items-center gap-3 group">
          <div className="w-10 h-10 rounded-lg bg-red-500/20 text-red-500 flex items-center justify-center border border-red-500/30 group-hover:scale-105 transition-transform">
            <Shield size={20} />
          </div>
          <div>
            <h1 className="text-white font-bold text-lg leading-tight tracking-[0.1em]">SUPERVISOR</h1>
            <p className="text-red-400 text-[10px] uppercase font-bold tracking-[0.2em]">Global Admin Access</p>
          </div>
        </Link>
        
        <Link href="/dashboard" className="flex items-center gap-2 text-sm font-bold text-muted hover:text-white transition-colors bg-white/5 py-2.5 px-4 rounded-lg border border-white/10 hover:bg-white/10 group">
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
