"use client";

import { useAuth } from "@/features/auth/hooks/useAuth";
import { DashboardHome } from "@/features/dashboard/components/DashboardHome";
import { PortfolioDashboard } from "@/features/dashboard/components/PortfolioDashboard";

export function DashboardView() {
  const { userDoc } = useAuth();
  const isStaff = userDoc?.role === "admin" || userDoc?.role === "cohort_manager";

  return (
    <div className="space-y-6">
      <DashboardHome />
      {isStaff && <PortfolioDashboard />}
    </div>
  );
}
