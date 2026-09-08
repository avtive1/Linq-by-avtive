"use client";

import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button as ShadButton } from "@/components/ui/button";

interface SendConfirmDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onConfirm: () => void;
  isSending: boolean;
}

export function SendConfirmDialog({
  open,
  onOpenChange,
  onConfirm,
  isSending,
}: SendConfirmDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        showCloseButton={false}
        className="w-full max-w-[340px] bg-white border border-border/80 rounded-xl p-6 shadow-xl text-center"
      >
        <DialogHeader className="p-0 mb-6">
          <DialogTitle className="text-base font-semibold text-heading text-center">
            Send to attendees?
          </DialogTitle>
        </DialogHeader>

        <div className="flex items-center justify-center gap-3">
          <ShadButton
            variant="secondary"
            size="sm"
            disabled={isSending}
            onClick={() => onOpenChange(false)}
            className="w-24 text-xs"
          >
            Cancel
          </ShadButton>
          <ShadButton
            size="sm"
            disabled={isSending}
            onClick={onConfirm}
            className="w-24 text-xs font-semibold"
          >
            {isSending ? "Sending..." : "Send"}
          </ShadButton>
        </div>
      </DialogContent>
    </Dialog>
  );
}
