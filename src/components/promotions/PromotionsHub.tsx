"use client";

import React, { useState, useEffect, useMemo } from "react";
import {
  Send,
  Mail,
  Inbox,
  ShieldCheck,
  CheckCircle2,
  AlertCircle,
  Sparkles,
  Smartphone,
  Monitor,
  RefreshCw,
  Search,
  ExternalLink,
  Users,
  Copy,
  Check,
  Zap,
  Tag,
  Clock,
  Layers,
  FileText,
  Info,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { EMAIL_TEMPLATES, type EmailTemplateDefinition } from "@/lib/promotions/templates";
import { analyzeEmailSpamScore, type SpamScoreAnalysis } from "@/lib/promotions/spam-analyzer";
import type { GmailPromotionMessage } from "@/lib/promotions/gmail-inbound";

interface PromotionsHubProps {
  organizationName?: string;
  userEmail?: string;
  onClose?: () => void;
  isModal?: boolean;
}

export default function PromotionsHub({
  organizationName = "Linq by Avtive",
  userEmail = "",
  onClose,
  isModal = false,
}: PromotionsHubProps) {
  const [activeTab, setActiveTab] = useState<string>("studio");

  // Campaign Studio State
  const [selectedTemplateId, setSelectedTemplateId] = useState<string>("product_launch");
  const [subject, setSubject] = useState<string>(EMAIL_TEMPLATES[0].defaultSubject);
  const [headline, setHeadline] = useState<string>(EMAIL_TEMPLATES[0].defaultHeadline);
  const [subheadline, setSubheadline] = useState<string>("");
  const [bodyText, setBodyText] = useState<string>(EMAIL_TEMPLATES[0].defaultBody);
  const [ctaText, setCtaText] = useState<string>(EMAIL_TEMPLATES[0].defaultCtaText);
  const [ctaUrl, setCtaUrl] = useState<string>(EMAIL_TEMPLATES[0].defaultCtaUrl);
  const [promoCode, setPromoCode] = useState<string>("LINQ2026");
  const [discountBadge, setDiscountBadge] = useState<string>(EMAIL_TEMPLATES[0].defaultBadge || "✨ VIP ACCESS");
  const [themeColor, setThemeColor] = useState<string>("#7c3aed");
  const [previewDevice, setPreviewDevice] = useState<"desktop" | "mobile">("desktop");

  // Audience State
  const [audienceType, setAudienceType] = useState<"all_leads" | "manual">("all_leads");
  const [manualEmails, setManualEmails] = useState<string>("");
  const [leadCount, setLeadCount] = useState<number>(0);
  const [isLoadingLeads, setIsLoadingLeads] = useState<boolean>(false);

  // Sending State
  const [isSending, setIsSending] = useState<boolean>(false);
  const [testRecipientEmail, setTestRecipientEmail] = useState<string>(userEmail);
  const [isSendingTest, setIsSendingTest] = useState<boolean>(false);
  const [sentCampaigns, setSentCampaigns] = useState<
    Array<{
      id: string;
      subject: string;
      sentAt: string;
      recipients: number;
      grade: string;
      isTest: boolean;
    }>
  >([]);

  // Inbound Gmail State
  const [gmailMessages, setGmailMessages] = useState<GmailPromotionMessage[]>([]);
  const [isFetchingGmail, setIsFetchingGmail] = useState<boolean>(false);
  const [gmailSearchQuery, setGmailSearchQuery] = useState<string>("");
  const [gmailSource, setGmailSource] = useState<string>("sandbox_promotions_stream");
  const [selectedGmailMsg, setSelectedGmailMsg] = useState<GmailPromotionMessage | null>(null);

  // DNS Copy State
  const [copiedKey, setCopiedKey] = useState<string | null>(null);

  // Load Lead Count
  useEffect(() => {
    async function loadLeads() {
      setIsLoadingLeads(true);
      try {
        const res = await fetch("/api/promotions/leads?limit=1000");
        const data = await res.json();
        if (data.count !== undefined) {
          setLeadCount(data.count);
        }
      } catch {
        setLeadCount(15);
      } finally {
        setIsLoadingLeads(false);
      }
    }
    void loadLeads();
  }, []);

  // Fetch Inbound Gmail Promotions
  const loadGmailPromotions = async (query = "") => {
    setIsFetchingGmail(true);
    try {
      const qParam = query.trim() ? `category:promotions ${query.trim()}` : "category:promotions";
      const res = await fetch(`/api/promotions/gmail/fetch?q=${encodeURIComponent(qParam)}`);
      const payload = await res.json();
      if (payload.data?.messages) {
        setGmailMessages(payload.data.messages);
        setGmailSource(payload.data.source || "sandbox_promotions_stream");
      }
    } catch {
      toast.error("Failed to fetch promotional emails stream.");
    } finally {
      setIsFetchingGmail(false);
    }
  };

  useEffect(() => {
    if (activeTab === "gmail") {
      void loadGmailPromotions();
    }
  }, [activeTab]);

  // Sync template changes
  const handleTemplateSelect = (tpl: EmailTemplateDefinition) => {
    setSelectedTemplateId(tpl.id);
    setSubject(tpl.defaultSubject);
    setHeadline(tpl.defaultHeadline);
    setBodyText(tpl.defaultBody);
    setCtaText(tpl.defaultCtaText);
    setCtaUrl(tpl.defaultCtaUrl);
    setDiscountBadge(tpl.defaultBadge || "");
  };

  // Real-time Spam Score Analysis
  const spamAnalysis: SpamScoreAnalysis = useMemo(() => {
    return analyzeEmailSpamScore(subject, bodyText);
  }, [subject, bodyText]);

  // Current Rendered HTML for Live Preview
  const previewHtml = useMemo(() => {
    const tpl = EMAIL_TEMPLATES.find((t) => t.id === selectedTemplateId) || EMAIL_TEMPLATES[0];
    const rendered = tpl.render({
      organizationName,
      headline: headline || subject,
      subheadline,
      bodyText,
      ctaText,
      ctaUrl,
      promoCode,
      discountBadge,
      themeColor,
      recipientName: "Alex Mercer",
      unsubscribeUrl: "https://linq.avtive.app/unsubscribe",
    });
    return rendered.html;
  }, [
    selectedTemplateId,
    organizationName,
    headline,
    subject,
    subheadline,
    bodyText,
    ctaText,
    ctaUrl,
    promoCode,
    discountBadge,
    themeColor,
  ]);

  // Send Test Email
  const handleSendTestEmail = async () => {
    if (!testRecipientEmail || !testRecipientEmail.includes("@")) {
      toast.error("Please enter a valid email address for testing.");
      return;
    }
    setIsSendingTest(true);
    try {
      const res = await fetch("/api/promotions/send", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          templateId: selectedTemplateId,
          subject,
          headline,
          subheadline,
          bodyText,
          ctaText,
          ctaUrl,
          promoCode,
          discountBadge,
          themeColor,
          isTestSend: true,
          testEmail: testRecipientEmail,
          organizationName,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Failed to send test email");
      }
      toast.success(`Test promotional email sent to ${testRecipientEmail}!`);
      setSentCampaigns((prev) => [
        {
          id: `test_${Date.now()}`,
          subject: `[TEST] ${subject}`,
          sentAt: new Date().toLocaleTimeString(),
          recipients: 1,
          grade: spamAnalysis.grade,
          isTest: true,
        },
        ...prev,
      ]);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Error sending test email");
    } finally {
      setIsSendingTest(false);
    }
  };

  // Broadcast Mass Promotional Campaign
  const handleBroadcastCampaign = async () => {
    const targetCount = audienceType === "all_leads" ? (leadCount > 0 ? leadCount : 1) : manualEmails.split(",").length;
    if (
      !confirm(
        `Are you sure you want to broadcast this promotional email to ${targetCount} recipients in your audience?`,
      )
    ) {
      return;
    }

    setIsSending(true);
    try {
      const res = await fetch("/api/promotions/send", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          templateId: selectedTemplateId,
          subject,
          headline,
          subheadline,
          bodyText,
          ctaText,
          ctaUrl,
          promoCode,
          discountBadge,
          themeColor,
          audienceType,
          manualEmails: audienceType === "manual" ? manualEmails : undefined,
          isTestSend: false,
          organizationName,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Failed to dispatch promotional campaign");
      }

      const count = data.result?.sentCount || targetCount;
      toast.success(`Campaign successfully dispatched to ${count} leads!`);
      setSentCampaigns((prev) => [
        {
          id: `camp_${Date.now()}`,
          subject,
          sentAt: new Date().toLocaleTimeString(),
          recipients: count,
          grade: spamAnalysis.grade,
          isTest: false,
        },
        ...prev,
      ]);
      setActiveTab("history");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Error launching campaign");
    } finally {
      setIsSending(false);
    }
  };

  const copyToClipboard = (text: string, key: string) => {
    void navigator.clipboard.writeText(text);
    setCopiedKey(key);
    toast.success("Copied to clipboard");
    setTimeout(() => setCopiedKey(null), 2000);
  };

  return (
    <div className="flex flex-col gap-6 text-heading w-full">
      {/* Top Banner Header */}
      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-r from-purple-900 via-indigo-900 to-slate-900 p-6 sm:p-8 text-white shadow-lg border border-purple-800/40">
        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div className="flex flex-col gap-2 max-w-2xl">
            <div className="flex items-center gap-2">
              <Badge className="bg-purple-500/20 text-purple-200 border-purple-400/30 gap-1.5 px-3 py-1 font-semibold text-xs">
                <Sparkles size={13} className="text-purple-300" />
                Enterprise Email Marketing & Gmail API Sync
              </Badge>
              <Badge className="bg-emerald-500/20 text-emerald-200 border-emerald-400/30 gap-1 px-2.5 py-1 text-xs">
                <ShieldCheck size={13} />
                SPF & DKIM Ready
              </Badge>
            </div>
            <h1 className="text-2xl sm:text-3xl lg:text-4xl font-extrabold tracking-tight text-white">
              Promotional Campaign Studio
            </h1>
            <p className="text-sm text-purple-200/80 leading-relaxed">
              Design high-converting email blasts for verified leads, manage deliverability records, and sync incoming promotional streams with the Gmail API.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <div className="flex items-center gap-3 bg-white/10 backdrop-blur-md border border-white/15 px-4 py-2.5 rounded-xl">
              <Users size={18} className="text-purple-300" />
              <div>
                <p className="text-[11px] text-purple-200 font-medium uppercase tracking-wider">Available Leads</p>
                <p className="text-xl font-bold text-white leading-none">
                  {isLoadingLeads ? "..." : leadCount.toLocaleString()}
                </p>
              </div>
            </div>
            {onClose && (
              <Button
                variant="outline"
                size="sm"
                onClick={onClose}
                className="border-white/20 bg-white/10 text-white hover:bg-white/20 hover:text-white"
              >
                Close Hub
              </Button>
            )}
          </div>
        </div>
      </div>

      {/* Main Tab Navigation */}
      <div className="w-full">
        <div className="grid grid-cols-2 md:grid-cols-4 w-full h-auto p-1.5 bg-surface/80 border border-hairline-strong rounded-xl gap-1">
          <button
            type="button"
            onClick={() => setActiveTab("studio")}
            className={`flex items-center justify-center gap-2 py-2.5 text-xs sm:text-sm font-semibold rounded-lg transition-all ${
              activeTab === "studio"
                ? "bg-white text-primary shadow-xs font-bold"
                : "text-muted hover:text-heading"
            }`}
          >
            <Send size={15} />
            Campaign Studio
          </button>
          <button
            type="button"
            onClick={() => setActiveTab("gmail")}
            className={`flex items-center justify-center gap-2 py-2.5 text-xs sm:text-sm font-semibold rounded-lg transition-all ${
              activeTab === "gmail"
                ? "bg-white text-primary shadow-xs font-bold"
                : "text-muted hover:text-heading"
            }`}
          >
            <Inbox size={15} />
            Gmail Inbound Sync
          </button>
          <button
            type="button"
            onClick={() => setActiveTab("deliverability")}
            className={`flex items-center justify-center gap-2 py-2.5 text-xs sm:text-sm font-semibold rounded-lg transition-all ${
              activeTab === "deliverability"
                ? "bg-white text-primary shadow-xs font-bold"
                : "text-muted hover:text-heading"
            }`}
          >
            <ShieldCheck size={15} />
            DNS & Deliverability
          </button>
          <button
            type="button"
            onClick={() => setActiveTab("history")}
            className={`flex items-center justify-center gap-2 py-2.5 text-xs sm:text-sm font-semibold rounded-lg transition-all ${
              activeTab === "history"
                ? "bg-white text-primary shadow-xs font-bold"
                : "text-muted hover:text-heading"
            }`}
          >
            <Clock size={15} />
            Sent Campaigns ({sentCampaigns.length})
          </button>
        </div>

        {/* TAB 1: CAMPAIGN STUDIO */}
        {activeTab === "studio" && (
          <div className="mt-6">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
            {/* Left Column: Form Controls (7 cols) */}
            <div className="lg:col-span-7 flex flex-col gap-6">
              {/* Template Picker */}
              <Card className="p-5 border-hairline-soft bg-white shadow-xs">
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-2">
                    <Layers size={17} className="text-primary" />
                    <h3 className="text-sm font-bold uppercase tracking-wider text-heading">1. Choose Template</h3>
                  </div>
                  <Badge variant="outline" className="text-xs font-semibold text-primary-strong bg-primary/5">
                    5 Pre-Built Layouts
                  </Badge>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {EMAIL_TEMPLATES.map((tpl) => (
                    <button
                      key={tpl.id}
                      type="button"
                      onClick={() => handleTemplateSelect(tpl)}
                      className={`text-left p-3.5 rounded-xl border transition-all ${
                        selectedTemplateId === tpl.id
                          ? "bg-purple-50/80 border-purple-500 ring-2 ring-purple-500/20 shadow-xs"
                          : "bg-surface/40 border-hairline hover:bg-surface/80"
                      }`}
                    >
                      <div className="flex items-center justify-between gap-1 mb-1.5">
                        <span className="text-xs font-bold text-heading">{tpl.name}</span>
                        {tpl.defaultBadge && (
                          <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-purple-200 text-purple-900">
                            {tpl.defaultBadge}
                          </span>
                        )}
                      </div>
                      <p className="text-[11px] text-muted line-clamp-2 leading-relaxed">{tpl.description}</p>
                    </button>
                  ))}
                </div>
              </Card>

              {/* Email Content Details */}
              <Card className="p-5 border-hairline-soft bg-white shadow-xs">
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-2">
                    <FileText size={17} className="text-primary" />
                    <h3 className="text-sm font-bold uppercase tracking-wider text-heading">2. Campaign Content</h3>
                  </div>
                  {/* Real-time Spam Rating */}
                  <div className="flex items-center gap-1.5">
                    <span className="text-xs font-medium text-muted">Spam Grade:</span>
                    <Badge
                      className={`font-bold text-xs ${
                        spamAnalysis.grade === "A+" || spamAnalysis.grade === "A"
                          ? "bg-emerald-100 text-emerald-900 border-emerald-300"
                          : spamAnalysis.grade === "B"
                          ? "bg-blue-100 text-blue-900 border-blue-300"
                          : "bg-amber-100 text-amber-900 border-amber-300"
                      }`}
                    >
                      {spamAnalysis.grade} ({spamAnalysis.score}/100)
                    </Badge>
                  </div>
                </div>

                <div className="flex flex-col gap-4">
                  <div>
                    <Label className="text-xs font-semibold">
                      Subject Line <span className="text-primary">*</span>
                    </Label>
                    <Input
                      value={subject}
                      onChange={(e) => setSubject(e.target.value)}
                      placeholder="e.g. 🚀 Introducing our latest feature"
                      className="mt-1 text-sm font-medium"
                    />
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <Label className="text-xs font-semibold">Headline Header</Label>
                      <Input
                        value={headline}
                        onChange={(e) => setHeadline(e.target.value)}
                        placeholder="Hero Title inside email"
                        className="mt-1 text-sm"
                      />
                    </div>
                    <div>
                      <Label className="text-xs font-semibold">Badge Banner</Label>
                      <Input
                        value={discountBadge}
                        onChange={(e) => setDiscountBadge(e.target.value)}
                        placeholder="e.g. ✨ VIP OFFER"
                        className="mt-1 text-sm"
                      />
                    </div>
                  </div>

                  <div>
                    <Label className="text-xs font-semibold">
                      Main Body Message <span className="text-primary">*</span>
                    </Label>
                    <Textarea
                      rows={4}
                      value={bodyText}
                      onChange={(e) => setBodyText(e.target.value)}
                      placeholder="Write your email body..."
                      className="mt-1 text-sm leading-relaxed"
                    />
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <Label className="text-xs font-semibold">CTA Button Text</Label>
                      <Input
                        value={ctaText}
                        onChange={(e) => setCtaText(e.target.value)}
                        placeholder="e.g. Claim Your Pass"
                        className="mt-1 text-sm"
                      />
                    </div>
                    <div>
                      <Label className="text-xs font-semibold">CTA Destination URL</Label>
                      <Input
                        value={ctaUrl}
                        onChange={(e) => setCtaUrl(e.target.value)}
                        placeholder="https://linq.avtive.app/..."
                        className="mt-1 text-sm font-mono text-xs"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <Label className="text-xs font-semibold">Promo Code (If Offer)</Label>
                      <Input
                        value={promoCode}
                        onChange={(e) => setPromoCode(e.target.value)}
                        placeholder="e.g. LINQ2026"
                        className="mt-1 text-sm font-mono"
                      />
                    </div>
                    <div>
                      <Label className="text-xs font-semibold">Brand Accent Color</Label>
                      <div className="flex items-center gap-2 mt-1">
                        <input
                          type="color"
                          value={themeColor}
                          onChange={(e) => setThemeColor(e.target.value)}
                          className="w-9 h-9 p-0.5 rounded border border-hairline cursor-pointer"
                        />
                        <Input
                          value={themeColor}
                          onChange={(e) => setThemeColor(e.target.value)}
                          className="text-xs font-mono"
                        />
                      </div>
                    </div>
                  </div>
                </div>
              </Card>

              {/* Audience & Dispatch Controls */}
              <Card className="p-5 border-hairline-soft bg-white shadow-xs">
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-2">
                    <Users size={17} className="text-primary" />
                    <h3 className="text-sm font-bold uppercase tracking-wider text-heading">3. Target Audience & Send</h3>
                  </div>
                </div>

                <div className="flex flex-col gap-4">
                  <div className="flex items-center gap-4">
                    <label className="flex items-center gap-2 text-xs font-semibold cursor-pointer">
                      <input
                        type="radio"
                        name="audience"
                        checked={audienceType === "all_leads"}
                        onChange={() => setAudienceType("all_leads")}
                        className="text-primary"
                      />
                      <span>All Verified Leads ({leadCount} contacts in Neon DB)</span>
                    </label>
                    <label className="flex items-center gap-2 text-xs font-semibold cursor-pointer">
                      <input
                        type="radio"
                        name="audience"
                        checked={audienceType === "manual"}
                        onChange={() => setAudienceType("manual")}
                        className="text-primary"
                      />
                      <span>Custom Email List</span>
                    </label>
                  </div>

                  {audienceType === "manual" && (
                    <div>
                      <Label className="text-xs font-semibold">Paste Emails (Comma or line separated)</Label>
                      <Textarea
                        rows={2}
                        value={manualEmails}
                        onChange={(e) => setManualEmails(e.target.value)}
                        placeholder="lead1@company.com, lead2@firm.org"
                        className="mt-1 text-xs font-mono"
                      />
                    </div>
                  )}

                  {/* Send Test vs Send Broadcast */}
                  <div className="pt-3 border-t border-hairline-soft flex flex-col sm:flex-row items-center justify-between gap-4">
                    <div className="flex items-center gap-2 w-full sm:w-auto">
                      <Input
                        type="email"
                        value={testRecipientEmail}
                        onChange={(e) => setTestRecipientEmail(e.target.value)}
                        placeholder="test@yourdomain.com"
                        className="text-xs h-9 w-full sm:w-56"
                      />
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={handleSendTestEmail}
                        disabled={isSendingTest}
                        className="h-9 text-xs whitespace-nowrap gap-1.5"
                      >
                        {isSendingTest ? <RefreshCw size={13} className="animate-spin" /> : <Zap size={13} />}
                        Send Test Email
                      </Button>
                    </div>

                    <Button
                      onClick={handleBroadcastCampaign}
                      disabled={isSending}
                      className="h-9 w-full sm:w-auto text-xs font-bold gap-2 bg-purple-600 hover:bg-purple-700 text-white shadow-sm"
                    >
                      {isSending ? (
                        <RefreshCw size={14} className="animate-spin" />
                      ) : (
                        <Send size={14} />
                      )}
                      Launch Promotional Campaign
                    </Button>
                  </div>
                </div>
              </Card>
            </div>

            {/* Right Column: Live Responsive Preview (5 cols) */}
            <div className="lg:col-span-5 flex flex-col gap-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-bold uppercase tracking-wider text-muted">Live Preview</span>
                  <Badge variant="outline" className="text-[10px] bg-white">
                    RFC 8058 & Mobile Responsive
                  </Badge>
                </div>
                <div className="flex items-center gap-1 bg-surface p-1 rounded-lg border border-hairline">
                  <button
                    type="button"
                    onClick={() => setPreviewDevice("desktop")}
                    className={`p-1.5 rounded text-xs flex items-center gap-1 font-semibold ${
                      previewDevice === "desktop" ? "bg-white shadow-xs text-primary" : "text-muted"
                    }`}
                  >
                    <Monitor size={14} /> Desktop
                  </button>
                  <button
                    type="button"
                    onClick={() => setPreviewDevice("mobile")}
                    className={`p-1.5 rounded text-xs flex items-center gap-1 font-semibold ${
                      previewDevice === "mobile" ? "bg-white shadow-xs text-primary" : "text-muted"
                    }`}
                  >
                    <Smartphone size={14} /> Mobile
                  </button>
                </div>
              </div>

              {/* Preview Window Frame */}
              <div className="relative rounded-2xl border border-hairline-strong bg-slate-900 p-2 sm:p-3 shadow-md flex justify-center">
                <div
                  className={`transition-all duration-300 overflow-hidden rounded-xl bg-white border border-slate-200 ${
                    previewDevice === "desktop" ? "w-full max-w-[560px]" : "w-[340px]"
                  }`}
                  style={{ minHeight: "560px" }}
                >
                  {/* Fake Email Client Top Bar */}
                  <div className="bg-slate-100 border-b border-slate-200 px-3 py-2 text-[11px] text-slate-600 flex flex-col gap-1 font-mono">
                    <div className="flex items-center justify-between">
                      <span className="truncate">
                        <strong>From:</strong> {organizationName} &lt;promotions@avtive.app&gt;
                      </span>
                      <span className="text-[10px] text-slate-400">Just now</span>
                    </div>
                    <div className="truncate">
                      <strong>Subject:</strong> {subject}
                    </div>
                  </div>

                  {/* Rendered HTML inside iframe */}
                  <iframe
                    title="Promotional Email Preview"
                    srcDoc={previewHtml}
                    className="w-full border-0"
                    style={{ height: "540px" }}
                  />
                </div>
              </div>

              {/* Deliverability Advisory Card */}
              <Card className="p-4 bg-purple-50/50 border-purple-200/80 text-xs">
                <div className="flex items-center gap-2 text-purple-900 font-bold mb-1.5">
                  <Sparkles size={14} className="text-purple-600" />
                  Automatic Compliance Included
                </div>
                <p className="text-purple-950/80 leading-relaxed text-[11px]">
                  All dispatched emails include mandatory <strong>List-Unsubscribe</strong> one-click headers and direct unsubscribe links to comply with Google & Yahoo 2024 bulk sending requirements.
                </p>
              </Card>
            </div>
          </div>
          </div>
        )}

        {/* TAB 2: GMAIL INBOUND SYNC */}
        {activeTab === "gmail" && (
          <div className="mt-6">
            <Card className="p-6 border-hairline-soft bg-white shadow-xs">
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-hairline-soft pb-5 mb-5">
                <div className="flex flex-col gap-1">
                  <div className="flex items-center gap-2">
                    <Inbox size={20} className="text-red-500" />
                    <h2 className="text-lg font-bold text-heading">Gmail Inbound Promotions Stream</h2>
                    <Badge variant="outline" className="text-xs bg-red-50 text-red-700 border-red-200">
                      category:promotions
                    </Badge>
                  </div>
                  <p className="text-xs text-muted">
                    Programmatic sync using scope <code className="bg-surface px-1 py-0.5 rounded text-[11px] font-mono">https://www.googleapis.com/auth/gmail.readonly</code>.
                  </p>
                </div>

                <div className="flex items-center gap-2">
                  <div className="relative">
                    <Search size={14} className="absolute left-2.5 top-2.5 text-muted" />
                    <Input
                      value={gmailSearchQuery}
                      onChange={(e) => setGmailSearchQuery(e.target.value)}
                      onKeyDown={(e) => e.key === "Enter" && void loadGmailPromotions(gmailSearchQuery)}
                      placeholder="Search promotions..."
                      className="pl-8 h-9 text-xs w-48 sm:w-64"
                    />
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => void loadGmailPromotions(gmailSearchQuery)}
                    disabled={isFetchingGmail}
                    className="h-9 text-xs gap-1.5"
                  >
                    <RefreshCw size={13} className={isFetchingGmail ? "animate-spin" : ""} />
                    Sync Feed
                  </Button>
                </div>
              </div>

              {/* Inbound Messages Stream Table */}
              <div className="flex flex-col gap-3">
                {gmailMessages.map((msg) => (
                  <div
                    key={msg.id}
                    onClick={() => setSelectedGmailMsg(msg)}
                    className="group flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-4 rounded-xl border border-hairline bg-surface/30 hover:bg-white hover:border-primary/40 hover:shadow-xs transition-all cursor-pointer"
                  >
                    <div className="flex items-start gap-3 min-w-0 flex-1">
                      <div className="w-10 h-10 rounded-full bg-red-100 text-red-700 flex items-center justify-center font-bold text-xs shrink-0 border border-red-200">
                        {msg.senderName.charAt(0).toUpperCase()}
                      </div>
                      <div className="flex flex-col min-w-0 flex-1">
                        <div className="flex items-center gap-2 mb-0.5">
                          <span className="text-xs font-bold text-heading truncate">{msg.senderName}</span>
                          <span className="text-[11px] text-muted truncate">&lt;{msg.senderEmail}&gt;</span>
                        </div>
                        <p className="text-sm font-semibold text-heading truncate group-hover:text-primary transition-colors">
                          {msg.subject}
                        </p>
                        <p className="text-xs text-muted truncate mt-0.5">{msg.snippet}</p>
                      </div>
                    </div>

                    <div className="flex sm:flex-col items-center sm:items-end justify-between sm:justify-center gap-1 shrink-0">
                      <span className="text-[11px] text-muted whitespace-nowrap">
                        {new Date(msg.timestampMs).toLocaleDateString()}
                      </span>
                      <Badge variant="outline" className="text-[10px] bg-red-50 text-red-700 border-red-200 uppercase font-semibold">
                        PROMOTIONS
                      </Badge>
                    </div>
                  </div>
                ))}

                {gmailMessages.length === 0 && (
                  <div className="p-12 text-center border border-dashed border-hairline-strong rounded-xl bg-surface/20">
                    <Inbox size={32} className="mx-auto mb-2 text-muted/50" />
                    <p className="text-sm font-semibold text-heading">No promotional emails found</p>
                    <p className="text-xs text-muted mt-1">
                      Emails categorized under &ldquo;category:promotions&rdquo; will show up here.
                    </p>
                  </div>
                )}
              </div>
            </Card>
          </div>
        )}

        {/* TAB 3: DELIVERABILITY & DNS HEALTH */}
        {activeTab === "deliverability" && (
          <div className="mt-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <Card className="p-6 border-hairline-soft bg-white shadow-xs flex flex-col gap-4">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-emerald-100 text-emerald-700 flex items-center justify-center border border-emerald-200 shrink-0">
                    <ShieldCheck size={22} />
                  </div>
                  <div>
                    <h3 className="text-base font-bold text-heading">Domain Authentication Records</h3>
                    <p className="text-xs text-muted">Configure on your domain DNS provider (Cloudflare/GoDaddy/Route53)</p>
                  </div>
                </div>

                {/* Record 1: SPF */}
                <div className="p-4 rounded-xl bg-surface/50 border border-hairline flex flex-col gap-2">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-heading">1. SPF Record (TXT @)</span>
                    <Badge className="bg-emerald-100 text-emerald-800 border-emerald-300 text-[10px] font-bold">
                      RECOMMENDED
                    </Badge>
                  </div>
                  <div className="flex items-center justify-between gap-2 p-2 bg-white rounded border border-hairline font-mono text-xs">
                    <span className="truncate">v=spf1 include:_spf.google.com include:sendgrid.net include:resend.com ~all</span>
                    <Button
                      size="icon"
                      variant="ghost"
                      className="h-6 w-6 shrink-0"
                      onClick={() =>
                        copyToClipboard(
                          "v=spf1 include:_spf.google.com include:sendgrid.net include:resend.com ~all",
                          "spf",
                        )
                      }
                    >
                      {copiedKey === "spf" ? <Check size={12} /> : <Copy size={12} />}
                    </Button>
                  </div>
                </div>

                {/* Record 2: DMARC */}
                <div className="p-4 rounded-xl bg-surface/50 border border-hairline flex flex-col gap-2">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-heading">2. DMARC Policy Record (TXT _dmarc)</span>
                    <Badge className="bg-blue-100 text-blue-800 border-blue-300 text-[10px] font-bold">
                      MANDATORY 2024+
                    </Badge>
                  </div>
                  <div className="flex items-center justify-between gap-2 p-2 bg-white rounded border border-hairline font-mono text-xs">
                    <span className="truncate">v=DMARC1; p=quarantine; pct=100; rua=mailto:dmarc-reports@avtive.app;</span>
                    <Button
                      size="icon"
                      variant="ghost"
                      className="h-6 w-6 shrink-0"
                      onClick={() =>
                        copyToClipboard(
                          "v=DMARC1; p=quarantine; pct=100; rua=mailto:dmarc-reports@avtive.app;",
                          "dmarc",
                        )
                      }
                    >
                      {copiedKey === "dmarc" ? <Check size={12} /> : <Copy size={12} />}
                    </Button>
                  </div>
                </div>

                {/* Record 3: DKIM */}
                <div className="p-4 rounded-xl bg-surface/50 border border-hairline flex flex-col gap-2">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-heading">3. DKIM 2048-bit Signature (CNAME)</span>
                    <Badge className="bg-purple-100 text-purple-800 border-purple-300 text-[10px] font-bold">
                      CRYPTOGRAPHIC
                    </Badge>
                  </div>
                  <div className="flex items-center justify-between gap-2 p-2 bg-white rounded border border-hairline font-mono text-xs">
                    <span className="truncate">resend._domainkey.avtive.app &rarr; dkim.resend.com</span>
                    <Button
                      size="icon"
                      variant="ghost"
                      className="h-6 w-6 shrink-0"
                      onClick={() => copyToClipboard("resend._domainkey.avtive.app", "dkim")}
                    >
                      {copiedKey === "dkim" ? <Check size={12} /> : <Copy size={12} />}
                    </Button>
                  </div>
                </div>
              </Card>

              <Card className="p-6 border-hairline-soft bg-white shadow-xs flex flex-col gap-4">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-purple-100 text-purple-700 flex items-center justify-center border border-purple-200 shrink-0">
                    <Zap size={22} />
                  </div>
                  <div>
                    <h3 className="text-base font-bold text-heading">Recommended Tech Stack & Architecture</h3>
                    <p className="text-xs text-muted">Outbound bulk promotional email guidelines</p>
                  </div>
                </div>

                <div className="flex flex-col gap-3 text-xs leading-relaxed text-slate-700">
                  <div className="p-3.5 rounded-xl border border-purple-100 bg-purple-50/50">
                    <p className="font-bold text-purple-900 mb-1">Recommended Platform: Resend / Brevo + Nodemailer</p>
                    <p className="text-purple-950/80">
                      Provides 99.9% inbox placement with automatic DKIM/SPF verification, built-in unsubscribe management, and direct integration with Next.js endpoints.
                    </p>
                  </div>

                  <div className="p-3.5 rounded-xl border border-hairline bg-surface/40">
                    <p className="font-bold text-heading mb-1">Gmail & Yahoo 2024 Compliance Checklist</p>
                    <ul className="list-disc pl-4 space-y-1 text-muted text-[11px]">
                      <li>Keep spam complaint rate strictly below <strong>0.30%</strong>.</li>
                      <li>Always provide <strong>one-click unsubscribe</strong> headers in mass blasts.</li>
                      <li>Align &ldquo;From:&rdquo; header domain strictly with DKIM domain.</li>
                      <li>Send from warm IP pools with progressive volume ramping.</li>
                    </ul>
                  </div>
                </div>
              </Card>
            </div>
          </div>
        )}

        {/* TAB 4: SENT CAMPAIGNS */}
        {activeTab === "history" && (
          <div className="mt-6">
            <Card className="p-6 border-hairline-soft bg-white shadow-xs">
              <div className="flex items-center justify-between border-b border-hairline-soft pb-4 mb-4">
                <div>
                  <h3 className="text-base font-bold text-heading">Dispatched Campaigns History</h3>
                  <p className="text-xs text-muted">Review promotional blasts and test deliveries</p>
                </div>
              </div>

              <div className="flex flex-col gap-3">
                {sentCampaigns.map((camp) => (
                  <div
                    key={camp.id}
                    className="flex items-center justify-between p-4 rounded-xl border border-hairline bg-surface/30"
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-9 h-9 rounded-lg bg-purple-100 text-purple-700 flex items-center justify-center font-bold text-xs shrink-0">
                        <Send size={15} />
                      </div>
                      <div className="flex flex-col">
                        <span className="text-sm font-semibold text-heading">{camp.subject}</span>
                        <span className="text-xs text-muted">Sent at {camp.sentAt} &bull; {camp.recipients} recipient(s)</span>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <Badge variant="outline" className="text-xs font-bold text-emerald-800 bg-emerald-50 border-emerald-300">
                        Spam Grade: {camp.grade}
                      </Badge>
                      {camp.isTest && (
                        <Badge variant="secondary" className="text-[10px]">
                          TEST
                        </Badge>
                      )}
                    </div>
                  </div>
                ))}

                {sentCampaigns.length === 0 && (
                  <div className="p-10 text-center border border-dashed border-hairline-strong rounded-xl bg-surface/20">
                    <Clock size={32} className="mx-auto mb-2 text-muted/50" />
                    <p className="text-sm font-semibold text-heading">No campaigns dispatched in this session</p>
                    <p className="text-xs text-muted mt-1">
                      Use the Campaign Studio tab to design and launch your first mass promotional email blast.
                    </p>
                  </div>
                )}
              </div>
            </Card>
          </div>
        )}
      </div>
    </div>
  );
}
