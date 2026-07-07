import { Loader } from "@/components/Loader";

interface PageLoaderProps {
  label?: string;
}

export function PageLoader({ label = "Loading" }: PageLoaderProps) {
  return (
    <div className="flex min-h-[50vh] flex-1 flex-col items-center justify-center gap-3 text-muted-foreground">
      <Loader size="lg" />
      <p className="text-sm">{label}…</p>
    </div>
  );
}
