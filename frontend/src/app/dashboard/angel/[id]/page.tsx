"use client";

import { use } from "react";
import Link from "next/link";
import { Header } from "@/components/layout/Header";
import { Card } from "@/components/ui/Card";
import { PageTransition } from "@/components/ui/PageTransition";
import { PixelProgressBar } from "@/components/ui/PixelProgressBar";
import { agentName } from "@/lib/utils";
import { ArrowLeft } from "lucide-react";

export default function VerdictDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);

  // TODO: fetch from API
  return (
    <>
      <Header />
      <div className="max-w-3xl mx-auto px-4 py-8">
        <PageTransition>
          <Link
            href="/dashboard/angel"
            className="inline-flex items-center gap-2 text-akyra-textSecondary hover:text-akyra-text mb-6"
          >
            <ArrowLeft size={16} />
            Retour aux Chroniques
          </Link>

          <Card variant="danger" className="space-y-6">
            <h1 className="font-heading text-sm text-akyra-red pixel-shadow">
              VERDICT #{id}
            </h1>

            {/* Score breakdown */}
            <div className="space-y-3">
              <PixelProgressBar label="Premeditation" value={8} max={10} color="red" />
              <PixelProgressBar label="Execution" value={7} max={10} color="red" />
              <PixelProgressBar label="Impact" value={7} max={10} color="red" />
            </div>

            {/* Narrative */}
            <div className="border-t border-akyra-border pt-4">
              <h3 className="font-heading text-xs text-akyra-textSecondary mb-3">
                LE RECIT DE L&apos;ANGE
              </h3>
              <p className="text-akyra-text leading-relaxed">
                Le verdict detaille sera charge depuis l&apos;API...
              </p>
            </div>
          </Card>
        </PageTransition>
      </div>
    </>
  );
}
