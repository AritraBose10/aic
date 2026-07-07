import { cn } from "@/lib/utils";

const BAR_COUNT = 12;
const BARS = Array.from({ length: BAR_COUNT }, (_, i) => i);

const SIZE_MAP = {
  sm: "size-4",
  default: "size-8",
  lg: "size-12",
} as const;

interface LoaderProps {
  className?: string;
  size?: keyof typeof SIZE_MAP;
}

export function Loader({ className, size = "default" }: LoaderProps) {
  return (
    <span role="status" className={cn("relative inline-block shrink-0", SIZE_MAP[size], className)}>
      <span className="sr-only">Loading…</span>
      {BARS.map((i) => (
        <span
          key={i}
          className="absolute inset-0"
          style={{ transform: `rotate(${(i * 360) / BAR_COUNT}deg)` }}
        >
          <span
            className="loader-bar absolute top-0 left-1/2 h-[26%] w-[9%] -translate-x-1/2 rounded-full bg-current"
            style={{
              animation: "loader-fade 1.2s linear infinite",
              animationDelay: `${(i * 1.2) / BAR_COUNT}s`,
            }}
          />
        </span>
      ))}
    </span>
  );
}
