import Link from "next/link";

export default function NotFound() {
  return (
    <div className="min-h-screen bg-akyra-bg flex items-center justify-center">
      <div className="text-center">
        <p className="text-akyra-textDisabled text-xs font-mono mb-4">404 — Page introuvable</p>
        <Link
          href="/"
          className="px-4 py-2 bg-akyra-surface border border-akyra-border rounded-lg text-akyra-text text-xs hover:border-akyra-green/40 transition-colors"
        >
          Retour
        </Link>
      </div>
    </div>
  );
}
