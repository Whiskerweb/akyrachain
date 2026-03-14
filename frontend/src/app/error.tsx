"use client";

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <div className="min-h-screen bg-akyra-bg flex items-center justify-center">
      <div className="text-center max-w-sm">
        <p className="text-akyra-red text-xs font-mono mb-3">
          {error.message || "Something went wrong"}
        </p>
        <button
          onClick={reset}
          className="px-4 py-2 bg-akyra-surface border border-akyra-border rounded-lg text-akyra-text text-xs hover:border-akyra-green/40 transition-colors"
        >
          Retry
        </button>
      </div>
    </div>
  );
}
