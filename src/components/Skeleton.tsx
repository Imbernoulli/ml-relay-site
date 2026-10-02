/** Grey placeholder lines that hold a section's place while its data loads. */
export default function Skeleton({ lines = 3, className = "" }: { lines?: number; className?: string }) {
  return (
    <div aria-hidden className={`animate-pulse rounded-xl border border-border bg-card p-4 ${className}`}>
      {Array.from({ length: lines }, (_, i) => (
        <div key={i} className={`h-3 rounded bg-muted ${i ? "mt-2.5" : ""}`} style={{ width: `${[60, 90, 75, 85, 50][i % 5]}%` }} />
      ))}
    </div>
  );
}
