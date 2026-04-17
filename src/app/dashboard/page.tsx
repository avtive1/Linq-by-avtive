"use client";
import { useState, useEffect, useMemo, Suspense } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import GradientBackground from "@/components/GradientBackground";
import { Button, TextInput, Skeleton, AnimatedCounter, FilePicker } from "@/components/ui";
import { supabase } from "@/lib/supabase";
import { Plus, LogOut, Calendar, MapPin, User, Search, Users, BarChart3, ArrowLeft, X, ChevronRight, Sparkles } from "lucide-react";
import { EventData } from "@/types/card";
import { toast } from "sonner";
import { getEventStatus } from "@/lib/utils";

import { useSearchParams } from "next/navigation";

type DashboardEventData = EventData & { attendeeCount: number };

function DashboardContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const impersonateId = searchParams.get("impersonate");
  
  const [events, setEvents] = useState<DashboardEventData[]>([]);
  const [userName, setUserName] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const [isEventModalOpen, setIsEventModalOpen] = useState(false);
  const [isCheckingAuth, setIsCheckingAuth] = useState(true);
  const [isAdmin, setIsAdmin] = useState(false);
  const [isPreviewMode, setIsPreviewMode] = useState(false);
  
  const [eventForm, setEventForm] = useState({
    name: "",
    location: "",
    date: "",
    logo: "",
  });
  const [isSubmittingEvent, setIsSubmittingEvent] = useState(false);
  const [stats, setStats] = useState({
    totalEvents: 0,
    totalAttendees: 0,
  });

  useEffect(() => {
    let isMounted = true;
    const checkUser = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!isMounted) return;
      
      if (!session) {
        router.replace("/login");
        return;
      }
      
      // Check for admin - for client side UI toggle
      const adminEmail = process.env.NEXT_PUBLIC_ADMIN_EMAIL;
      const isActuallyAdmin = session.user.email && adminEmail && session.user.email.toLowerCase() === adminEmail.toLowerCase();
      
      if (isActuallyAdmin) {
        setIsAdmin(true);
      }

      // Logic for Effective User ID
      let effectiveId = session.user.id;
      let effectiveName = session.user.email?.split("@")[0] || "";

      if (impersonateId && isActuallyAdmin) {
        effectiveId = impersonateId;
        setIsPreviewMode(true);
        // Fetch target user email for the banner/name
        const { data: { user: targetUser } } = await supabase.auth.getUser(); // This only gets current user, we can't easily get other user names from client without an API
        effectiveName = "Organization View"; 
      }
      
      setUserName(effectiveName);
      fetchData(effectiveId, () => isMounted);
      setIsCheckingAuth(false);
    };
    checkUser();
    return () => { isMounted = false; };
  }, [router, impersonateId]);

  const fetchData = async (userId: string, getIsMounted?: () => boolean) => {
    try {
      // 1. Fetch all events owned by this user
      const { data: eventRecords, error: eventError } = await supabase
        .from("events")
        .select("*")
        .eq('user_id', userId)
        .order('created_at', { ascending: false });

      if (eventError) throw eventError;
      const validEventRecords = eventRecords || [];

      // 2. Fetch all attendees for THESE specific events (including public registrations)
      const eventIds = validEventRecords.map(e => e.id);
      let attendeeRecords: any[] = [];
      
      if (eventIds.length > 0) {
        const { data: attendeeData, error: attendeeError } = await supabase
          .from("attendees")
          .select("*")
          .in('event_id', eventIds);
        
        if (attendeeError) throw attendeeError;
        attendeeRecords = attendeeData || [];
      }
      
      const eventCounts = new Map<string, number>();
      attendeeRecords.forEach(a => {
        if (a.event_id) {
          eventCounts.set(a.event_id, (eventCounts.get(a.event_id) || 0) + 1);
        }
      });

      const mappedEvents: DashboardEventData[] = validEventRecords.map(r => ({
        id: r.id,
        name: r.name,
        location: r.location,
        date: r.date,
        logo_url: r.logo_url,
        attendeeCount: eventCounts.get(r.id) || 0,
      }));
      
      if (getIsMounted && !getIsMounted()) return;

      setEvents(mappedEvents);
      
      setStats({
        totalEvents: mappedEvents.length,
        totalAttendees: attendeeRecords.length,
      });

    } catch (err: any) {
      console.error("Error fetching dashboard data:", err);
      toast.error("Could not load data. Please refresh and try again.");
    }
  };

  const filteredEvents = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();
    if (!query) return events;
    
    return events.filter(evt => {
      const name = (evt.name || "").toLowerCase();
      const location = (evt.location || "").toLowerCase();
      const date = (evt.date || "").toLowerCase();
      // Concatenate for a broader search matches
      const searchBlob = `${name} ${location} ${date}`;
      return searchBlob.includes(query);
    });
  }, [searchQuery, events]);

  const handleLogout = async () => {
    await supabase.auth.signOut();
    router.push("/login");
  };

  const handleEventSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!eventForm.name || !eventForm.location || !eventForm.date) {
      toast.error("Please fill all required fields.");
      return;
    }

    setIsSubmittingEvent(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("No user found");
      
      let logoUrl = "";
      if (eventForm.logo) {
        try {
          // Convert base64 to Blob
          const base64Data = eventForm.logo.split(",")[1];
          const blob = await fetch(`data:image/png;base64,${base64Data}`).then(res => res.blob());
          const fileName = `${user.id}/${Date.now()}.png`;
          
          const { data: uploadData, error: uploadError } = await supabase.storage
            .from("event-logos")
            .upload(fileName, blob, { contentType: 'image/png' });
            
          if (uploadError) throw uploadError;
          
          const { data: { publicUrl } } = supabase.storage
            .from("event-logos")
            .getPublicUrl(uploadData.path);
            
          logoUrl = publicUrl;
        } catch (uploadErr) {
          console.error("Logo upload failed:", uploadErr);
          toast.error("Logo upload failed, but creating event anyway...");
        }
      }
      
      const data = {
        name: eventForm.name,
        location: eventForm.location,
        date: eventForm.date,
        user_id: user.id,
        logo_url: logoUrl
      };
      
      const { error } = await supabase.from("events").insert(data);
      if (error) throw error;
      
      toast.success(`Event "${eventForm.name}" created successfully!`);
      
      setIsEventModalOpen(false);
      setEventForm({ name: "", location: "", date: "", logo: "" });
      fetchData(user.id);
    } catch (err: any) {
      console.error(err);
      toast.error("Failed to create event. Please try again.");
    } finally {
      setIsSubmittingEvent(false);
    }
  };

  return (
    <main className="relative min-h-screen w-full bg-transparent">
      {isPreviewMode && (
        <div className="relative z-[100] bg-danger/10 backdrop-blur-md border-b border-danger/20 px-6 py-3 flex items-center justify-between text-danger text-sm font-bold shadow-sm">
          <div className="flex items-center gap-2">
            <Sparkles size={18} />
            <span>Admin Preview Mode &mdash; Read Only</span>
          </div>
          <Link href="/admin" className="bg-danger text-white px-3 py-1 rounded-sm hover:brightness-110 transition-all text-xs">
            Exit Preview
          </Link>
        </div>
      )}
      <GradientBackground />
      <div className="relative z-10 max-w-[1240px] mx-auto px-4 sm:px-6 py-8 sm:py-12 md:py-16">
        <div className="flex flex-col gap-6 mb-12">
          <Skeleton className="w-24 h-4" />
          <Skeleton className="w-48 h-10" />
          <Skeleton className="w-32 h-4" />
        </div>
        
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-10">
          <Skeleton className="md:col-span-2 h-32" />
          <Skeleton className="md:col-span-1 h-32" />
          <Skeleton className="md:col-span-1 h-32" />
        </div>

        <div className="flex gap-3 mb-6">
          <Skeleton className="flex-1 h-12" />
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <Skeleton className="h-48" />
          <Skeleton className="h-48" />
        </div>
      </div>
    </main>
  );
}

export default function DashboardPage() {
  return (
    <Suspense fallback={
      <main className="relative min-h-screen w-full bg-transparent">
        <GradientBackground />
        <div className="relative z-10 max-w-[1240px] mx-auto px-4 sm:px-6 py-8 sm:py-12 md:py-16">
          <div className="flex flex-col gap-6 mb-12">
            <Skeleton className="w-24 h-4" />
            <Skeleton className="w-48 h-10" />
            <Skeleton className="w-32 h-4" />
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-10">
            <Skeleton className="md:col-span-2 h-32" />
            <Skeleton className="md:col-span-1 h-32" />
            <Skeleton className="md:col-span-1 h-32" />
          </div>

          <div className="flex gap-3 mb-6">
            <Skeleton className="flex-1 h-12" />
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <Skeleton className="h-48" />
            <Skeleton className="h-48" />
          </div>
        </div>
      </main>
    }>
      <DashboardContent />
    </Suspense>
  );
}