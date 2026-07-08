import { AlertTriangle } from "lucide-react";

/**
 * INV-07 governance: every investor-facing page must display disclaimers and
 * make clear the platform facilitates *discovery*, not investment *execution*.
 * No action anywhere in the investor feature set records a financial
 * transaction — "commit"/"close" are status labels with audit entries only.
 */
export function InvestorDisclaimer() {
  return (
    <div className="flex items-start gap-2 rounded-md border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-xs text-amber-800 dark:text-amber-200">
      <AlertTriangle className="mt-0.5 size-4 shrink-0" />
      <p>
        This platform supports investor <strong>discovery and introductions only</strong>. It does not
        execute, custody, or record any investment transaction. Deal stages are informational labels;
        any commitment happens off-platform under your own legal and financial advice. All access is
        logged and governed by the ecosystem&apos;s confidentiality and disclosure policies.
      </p>
    </div>
  );
}
