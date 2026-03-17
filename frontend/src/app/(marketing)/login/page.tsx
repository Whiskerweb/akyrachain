"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { toast } from "sonner";
import { Button } from "@/components/ui/Button";
import { JungleBox } from "@/components/ui/JungleBox";
import { PageTransition } from "@/components/ui/PageTransition";
import { authAPI } from "@/lib/api";
import { useAkyraStore } from "@/stores/akyraStore";

export default function LoginPage() {
  const router = useRouter();
  const setToken = useAkyraStore((s) => s.setToken);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      const data = await authAPI.login(email, password);
      setToken(data.access_token);
      toast.success("Connexion reussie !");
      router.push("/dashboard");
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Erreur de connexion";
      toast.error(msg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-jungle-gradient flex items-center justify-center px-4">
      <PageTransition className="w-full max-w-md">
        <div className="text-center mb-8">
          <Link href="/">
            <h1 className="font-heading text-2xl text-akyra-green pixel-shadow">
              AKYRA
            </h1>
          </Link>
        </div>

        <JungleBox>
          <h2 className="font-heading text-xs text-akyra-text mb-6 text-center">
            CONNEXION
          </h2>

          <form onSubmit={handleLogin} className="space-y-4">
            <div>
              <label className="text-akyra-textSecondary text-sm mb-1 block">
                Email
              </label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="input-akyra"
                placeholder="ton@email.com"
                required
              />
            </div>

            <div>
              <label className="text-akyra-textSecondary text-sm mb-1 block">
                Mot de passe
              </label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="input-akyra"
                placeholder="********"
                required
              />
            </div>

            <Button type="submit" loading={loading} className="w-full">
              Entrer dans la jungle
            </Button>
          </form>

          <p className="text-akyra-textSecondary text-sm text-center mt-4">
            Pas encore de compte ?{" "}
            <Link href="/signup" className="text-akyra-green hover:underline">
              Creer un compte
            </Link>
          </p>
        </JungleBox>
      </PageTransition>
    </div>
  );
}
