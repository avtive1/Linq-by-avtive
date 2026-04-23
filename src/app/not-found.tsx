import Link from "next/link";
import GradientBackground from "@/components/GradientBackground";
import { Button } from "@/components/ui";
import { SearchX } from "lucide-react";

export default function NotFound() {
  return (
    <main className="relative min-h-screen w-full flex items-center justify-center p-8 text-center bg-transparent">
      <GradientBackground />
      <div className="relative z-10 flex flex-col items-center gap-5 glass-panel p-10 rounded-xl shadow-2xl max-w-md animate-slide-up">
        <div className="w-12 h-12 rounded-full bg-surface flex items-center justify-center text-muted">
          <SearchX size={24} />
        </div>
        <div className="flex flex-col gap-2">
          <h1 className="text-2xl font-semibold text-heading">Page not found</h1>
          <p className="text-sm text-muted">
            The page you are looking for does not exist or may have moved.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <Link href="/">
            <Button variant="secondary">Back to Home</Button>
          </Link>
          <Link href="/dashboard">
            <Button variant="primary">Open Dashboard</Button>
          </Link>
        </div>
      </div>
    </main>
  );
}
