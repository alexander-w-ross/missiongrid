"use client";

import { useEffect } from "react";
import { AnimatePresence, motion } from "motion/react";
import { AlertTriangle, CheckCircle2, Info } from "lucide-react";
import { cn } from "@/lib/utils";
import { useMissionStore } from "@/store/missionStore";

const ICON = {
  info: Info,
  warn: AlertTriangle,
  success: CheckCircle2,
};

const STYLE = {
  info: "border-[color:var(--color-cyan)]/50 text-[color:var(--color-cyan)]",
  warn: "border-[color:var(--color-red)]/50 text-[color:var(--color-red)]",
  success: "border-[color:var(--color-teal)]/50 text-[color:var(--color-teal)]",
};

export function NoticeToast() {
  const notice = useMissionStore((s) => s.notice);
  const setNotice = useMissionStore((s) => s.setNotice);

  useEffect(() => {
    if (!notice) return;
    const t = setTimeout(() => setNotice(null), 4000);
    return () => clearTimeout(t);
  }, [notice, setNotice]);

  const Icon = notice ? ICON[notice.kind] : Info;

  return (
    <div className="pointer-events-none fixed bottom-5 left-1/2 z-50 -translate-x-1/2">
      <AnimatePresence>
        {notice && (
          <motion.div
            key={notice.id}
            initial={{ opacity: 0, y: 16, scale: 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 8, scale: 0.98 }}
            transition={{ duration: 0.2 }}
            className={cn(
              "panel pointer-events-auto flex items-center gap-2.5 px-4 py-2.5",
              STYLE[notice.kind],
            )}
          >
            <Icon className="h-4 w-4 shrink-0" strokeWidth={2} />
            <span className="font-mono text-xs text-[color:var(--color-ink)]">
              {notice.message}
            </span>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
