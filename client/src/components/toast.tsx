"use client";

import { AnimatePresence, motion } from "motion/react";
import { useSyncExternalStore } from "react";

let current: { id: number; text: string } | null = null;
const listeners = new Set<() => void>();
let timer: ReturnType<typeof setTimeout> | undefined;

export function toast(text: string) {
  current = { id: Date.now(), text };
  listeners.forEach((l) => l());
  clearTimeout(timer);
  timer = setTimeout(() => {
    current = null;
    listeners.forEach((l) => l());
  }, 2600);
}

function subscribe(cb: () => void) {
  listeners.add(cb);
  return () => listeners.delete(cb);
}

export function Toaster() {
  const msg = useSyncExternalStore(subscribe, () => current, () => null);
  return (
    <div aria-live="polite" className="pointer-events-none fixed inset-x-0 bottom-24 z-50 mx-auto flex max-w-[480px] justify-center px-6">
      <AnimatePresence>
        {msg && (
          <motion.div
            key={msg.id}
            initial={{ opacity: 0, y: 12, scale: 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 8 }}
            className="rounded-2xl bg-ink px-4 py-2.5 text-center text-sm font-semibold text-paper shadow-lg"
          >
            {msg.text}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
