"use client";

import React, { useEffect, useRef, useState, useCallback } from "react";
import { Html5Qrcode, Html5QrcodeSupportedFormats } from "html5-qrcode";
import { X, CheckCircle2, AlertTriangle, ShieldAlert, Camera, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";

interface ScannedAttendee {
  id: string;
  name: string;
  role?: string;
  company?: string;
  track?: string;
}

interface ScanResultState {
  type: "success" | "warning" | "error";
  message: string;
  attendee?: ScannedAttendee;
}

interface QrAttendanceScannerModalProps {
  isOpen: boolean;
  onClose: () => void;
  eventId: string;
  eventName: string;
  onAttendanceMarked?: (attendeeId: string) => void;
}

/** Synthesize a pleasant audio beep using Web Audio API */
function playSuccessBeep() {
  try {
    const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    if (!AudioCtx) return;
    const ctx = new AudioCtx();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.type = "sine";
    osc.frequency.setValueAtTime(880, ctx.currentTime); // A5
    osc.frequency.exponentialRampToValueAtTime(1320, ctx.currentTime + 0.15); // E6

    gain.gain.setValueAtTime(0.15, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.15);

    osc.connect(gain);
    gain.connect(ctx.destination);

    osc.start();
    osc.stop(ctx.currentTime + 0.15);
  } catch {
    // Audio Context blocked or unsupported
  }
}

function playErrorBeep() {
  try {
    const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    if (!AudioCtx) return;
    const ctx = new AudioCtx();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.type = "sawtooth";
    osc.frequency.setValueAtTime(300, ctx.currentTime);
    osc.frequency.linearRampToValueAtTime(150, ctx.currentTime + 0.2);

    gain.gain.setValueAtTime(0.15, ctx.currentTime);
    gain.gain.linearRampToValueAtTime(0.01, ctx.currentTime + 0.2);

    osc.connect(gain);
    gain.connect(ctx.destination);

    osc.start();
    osc.stop(ctx.currentTime + 0.2);
  } catch {
    // Audio Context blocked or unsupported
  }
}

export function QrAttendanceScannerModal({
  isOpen,
  onClose,
  eventId,
  eventName,
  onAttendanceMarked,
}: QrAttendanceScannerModalProps) {
  const [isInitializing, setIsInitializing] = useState(true);
  const [initError, setInitError] = useState<string | null>(null);
  const [scanResult, setScanResult] = useState<ScanResultState | null>(null);
  const [scannedCount, setScannedCount] = useState(0);

  const html5QrcodeRef = useRef<Html5Qrcode | null>(null);
  const isProcessingRef = useRef(false);
  const lastScannedCodeRef = useRef<string | null>(null);
  const resetTimerRef = useRef<NodeJS.Timeout | null>(null);

  const processQrScan = useCallback(
    async (qrPayload: string) => {
      if (isProcessingRef.current) return;
      isProcessingRef.current = true;

      // Prevent immediate repeat scan of identical code within 3 seconds
      if (lastScannedCodeRef.current === qrPayload) {
        setTimeout(() => {
          isProcessingRef.current = false;
        }, 1500);
        return;
      }

      lastScannedCodeRef.current = qrPayload;

      try {
        const response = await fetch(`/api/events/${eventId}/attendance/scan`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ qrPayload }),
        });

        const body = await response.json();

        if (response.ok && body?.data?.success) {
          const attendee = body.data.attendee as ScannedAttendee;
          playSuccessBeep();
          if (typeof navigator !== "undefined" && "vibrate" in navigator) {
            try {
              navigator.vibrate([100, 50, 100]);
            } catch {
              // Ignore vibration failure
            }
          }

          setScanResult({
            type: "success",
            message: body.data.message || `Attendance marked for ${attendee?.name || "attendee"}.`,
            attendee,
          });

          setScannedCount((c) => c + 1);
          if (attendee?.id && onAttendanceMarked) {
            onAttendanceMarked(attendee.id);
          }
        } else if (body?.data?.alreadyAttended) {
          playErrorBeep();
          const attendee = body.data.attendee as ScannedAttendee;
          setScanResult({
            type: "warning",
            message: body.error || "Attendance has already been marked for this attendee.",
            attendee,
          });
        } else {
          playErrorBeep();
          setScanResult({
            type: "error",
            message: body.error || "Unable to verify attendance. Please try scanning again.",
          });
        }
      } catch {
        playErrorBeep();
        setScanResult({
          type: "error",
          message: "Network error occurred while verifying attendance. Please check your connection.",
        });
      } finally {
        if (resetTimerRef.current) clearTimeout(resetTimerRef.current);
        resetTimerRef.current = setTimeout(() => {
          setScanResult(null);
          isProcessingRef.current = false;
          lastScannedCodeRef.current = null;
        }, 2600);
      }
    },
    [eventId, onAttendanceMarked],
  );

  const [retryCount, setRetryCount] = useState(0);

  useEffect(() => {
    if (!isOpen) return;

    let mounted = true;
    setIsInitializing(true);
    setInitError(null);
    setScanResult(null);
    isProcessingRef.current = false;

    const elementId = "qr-attendance-reader";

    const startScanner = async () => {
      try {
        const qrScanner = new Html5Qrcode(elementId, {
          formatsToSupport: [Html5QrcodeSupportedFormats.QR_CODE],
          verbose: false,
        });
        html5QrcodeRef.current = qrScanner;

        const config = {
          fps: 15,
          qrbox: { width: 250, height: 250 },
          aspectRatio: 1.0,
        };

        const onScanSuccess = (decodedText: string) => {
          if (mounted) {
            processQrScan(decodedText);
          }
        };
        const onScanError = () => {
          // Frame decoding error (normal while scanning)
        };

        let started = false;

        // Strategy 1: Try environment camera (ideal for mobile rear cameras)
        try {
          await qrScanner.start({ facingMode: "environment" }, config, onScanSuccess, onScanError);
          started = true;
        } catch {
          // Fall through to strategy 2
        }

        // Strategy 2: Fallback to user/front camera (ideal for laptop integrated cameras)
        if (!started && mounted) {
          try {
            await qrScanner.start({ facingMode: "user" }, config, onScanSuccess, onScanError);
            started = true;
          } catch {
            // Fall through to strategy 3
          }
        }

        // Strategy 3: Query explicit media devices list
        if (!started && mounted) {
          try {
            const devices = await Html5Qrcode.getCameras();
            if (devices && devices.length > 0) {
              const cameraId = devices[0].id;
              await qrScanner.start(cameraId, config, onScanSuccess, onScanError);
              started = true;
            }
          } catch {
            // Devices query failed
          }
        }

        if (!started) {
          throw new Error("Could not start camera stream. Please check camera connection or permissions.");
        }

        if (mounted) {
          setIsInitializing(false);
        }
      } catch (err: unknown) {
        if (mounted) {
          setIsInitializing(false);
          const errMsg = err instanceof Error ? err.message : String(err);
          const isPermissionErr =
            errMsg.toLowerCase().includes("permission") ||
            errMsg.toLowerCase().includes("allowed") ||
            errMsg.toLowerCase().includes("denied") ||
            errMsg.toLowerCase().includes("notallowederror");

          if (isPermissionErr) {
            setInitError(
              "Camera permission is blocked in your browser. Click the padlock/tune icon next to the URL in your address bar, set Camera to 'Allow', then click Try Again."
            );
          } else {
            setInitError(
              `Unable to start camera: ${errMsg}. Please ensure your camera is enabled and allowed in your browser settings.`
            );
          }
        }
      }
    };

    // Short delay to ensure DOM element is mounted
    const initTimer = setTimeout(startScanner, 150);

    return () => {
      mounted = false;
      clearTimeout(initTimer);
      if (resetTimerRef.current) clearTimeout(resetTimerRef.current);
      const scanner = html5QrcodeRef.current;
      if (scanner) {
        const stopAndClear = async () => {
          try {
            if (scanner.isScanning) {
              await scanner.stop();
            }
          } catch (e) {
            // Suppress stop errors
          } finally {
            try {
              scanner.clear();
            } catch (e) {
              // Suppress clear errors
            }
          }
        };
        void stopAndClear();
        html5QrcodeRef.current = null;
      }
    };
  }, [isOpen, retryCount, processQrScan]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[99999] flex items-center justify-center bg-black/80 backdrop-blur-md p-4 animate-in fade-in duration-200">
      <div className="relative w-full max-w-lg overflow-hidden rounded-2xl border border-white/10 bg-gray-950 text-white shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-white/10 px-5 py-4 bg-gray-900/60">
          <div className="flex items-center gap-2.5">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-primary/20 text-primary-strong">
              <Camera size={18} />
            </div>
            <div>
              <h2 className="text-base font-semibold tracking-tight text-white leading-tight">
                Scan Attendance QR
              </h2>
              <p className="text-xs text-gray-400 truncate max-w-[220px] sm:max-w-xs">
                {eventName}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            {scannedCount > 0 && (
              <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/20 px-2.5 py-0.5 text-xs font-semibold text-emerald-400 border border-emerald-500/30">
                <Sparkles size={12} />
                {scannedCount} Marked
              </span>
            )}
            <Button
              type="button"
              variant="ghost"
              size="icon"
              onClick={onClose}
              className="h-8 w-8 rounded-full text-gray-400 hover:bg-white/10 hover:text-white"
            >
              <X size={18} />
            </Button>
          </div>
        </div>

        {/* Viewport Area */}
        <div className="relative flex flex-col items-center justify-center p-6 bg-black min-h-[340px]">
          {isInitializing && !initError && (
            <div className="absolute inset-0 z-10 flex flex-col items-center justify-center gap-3 bg-black/90 text-gray-400">
              <div className="h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent" />
              <p className="text-sm font-medium">Accessing camera...</p>
            </div>
          )}

          {initError && (
            <div className="z-10 flex flex-col items-center text-center p-6 bg-red-950/40 border border-red-500/30 rounded-xl my-4 gap-3 max-w-sm">
              <ShieldAlert size={36} className="text-red-400 shrink-0" />
              <p className="text-sm text-red-200 font-medium leading-relaxed">
                {initError}
              </p>
              <div className="flex items-center gap-2 mt-2">
                <Button
                  type="button"
                  variant="default"
                  onClick={() => {
                    setInitError(null);
                    setIsInitializing(true);
                    setRetryCount((c) => c + 1);
                  }}
                  className="bg-primary hover:bg-primary/90 text-white"
                >
                  Try Again
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  onClick={onClose}
                  className="border-white/20 text-white hover:bg-white/10"
                >
                  Close Scanner
                </Button>
              </div>
            </div>
          )}

          {/* Scanner Container — Always rendered with non-zero dimensions so html5-qrcode can mount video stream */}
          <div
            id="qr-attendance-reader"
            className={`w-full min-h-[280px] overflow-hidden rounded-xl border border-white/15 bg-black ${
              initError ? "hidden" : "block"
            }`}
          />

          {/* Scan Feedback Overlay Banner */}
          {scanResult && (
            <div
              className={`absolute inset-x-4 top-4 z-20 flex items-start gap-3 rounded-xl p-4 shadow-xl border animate-in slide-in-from-top-4 duration-200 ${
                scanResult.type === "success"
                  ? "bg-emerald-950/90 border-emerald-500/50 text-emerald-100"
                  : scanResult.type === "warning"
                    ? "bg-amber-950/90 border-amber-500/50 text-amber-100"
                    : "bg-red-950/90 border-red-500/50 text-red-100"
              }`}
            >
              {scanResult.type === "success" && (
                <CheckCircle2 className="h-6 w-6 text-emerald-400 shrink-0 mt-0.5" />
              )}
              {scanResult.type === "warning" && (
                <AlertTriangle className="h-6 w-6 text-amber-400 shrink-0 mt-0.5" />
              )}
              {scanResult.type === "error" && (
                <ShieldAlert className="h-6 w-6 text-red-400 shrink-0 mt-0.5" />
              )}

              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold tracking-tight leading-snug">
                  {scanResult.type === "success"
                    ? "Attendance Marked!"
                    : scanResult.type === "warning"
                      ? "Already Marked"
                      : "Scan Verification Failed"}
                </p>
                <p className="text-xs opacity-90 mt-0.5 leading-relaxed">
                  {scanResult.message}
                </p>
                {scanResult.attendee && (
                  <div className="mt-2 flex flex-wrap items-center gap-1.5 text-xs font-medium border-t border-white/10 pt-1.5">
                    <span className="font-bold text-white">
                      {scanResult.attendee.name}
                    </span>
                    {scanResult.attendee.role && (
                      <span className="opacity-75">• {scanResult.attendee.role}</span>
                    )}
                    {scanResult.attendee.company && (
                      <span className="opacity-75">({scanResult.attendee.company})</span>
                    )}
                  </div>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="border-t border-white/10 px-5 py-3.5 bg-gray-900/80 flex items-center justify-between">
          <p className="text-xs text-gray-400">
            Position attendee QR code inside the frame to scan.
          </p>
          <Button
            type="button"
            variant="secondary"
            size="sm"
            onClick={onClose}
            className="rounded-lg bg-white/10 text-white hover:bg-white/20 border-0 text-xs h-8 px-3"
          >
            Done
          </Button>
        </div>
      </div>
    </div>
  );
}
