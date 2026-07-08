"use client";

import { useEffect, useRef } from "react";
import { toast } from "sonner";
import { useAuth } from "@/features/auth/hooks/useAuth";
import { logoutUser } from "@/features/auth/lib/authActions";
import { recordLoginEvent, INACTIVITY_TIMEOUT_MS } from "@/features/auth/lib/sessionActions";

/**
 * SEC-05 session hardening, mounted on every protected route:
 *  - inactivity timeout: signs the user out after 30 min of no interaction;
 *  - new-device alert: warns once when the session is a first-seen device.
 * Renders nothing.
 */
export function SessionGuard() {
  const { firebaseUser, userDoc } = useAuth();
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const checkedDevice = useRef(false);

  // Inactivity timeout.
  useEffect(() => {
    if (!firebaseUser) return;
    const reset = () => {
      if (timer.current) clearTimeout(timer.current);
      timer.current = setTimeout(() => {
        toast.info("Signed out after 30 minutes of inactivity.");
        logoutUser();
      }, INACTIVITY_TIMEOUT_MS);
    };
    const events = ["mousedown", "keydown", "touchstart", "scroll"] as const;
    events.forEach((e) => window.addEventListener(e, reset, { passive: true }));
    reset();
    return () => {
      events.forEach((e) => window.removeEventListener(e, reset));
      if (timer.current) clearTimeout(timer.current);
    };
  }, [firebaseUser]);

  // New-device alert (once per mount, after the profile is known).
  useEffect(() => {
    if (!userDoc || checkedDevice.current) return;
    checkedDevice.current = true;
    recordLoginEvent(userDoc.uid)
      .then(({ isNewDevice }) => {
        if (isNewDevice) toast.warning("New sign-in from a device we haven't seen before. If this wasn't you, sign out of all devices from Account.");
      })
      .catch(() => {});
  }, [userDoc]);

  return null;
}
