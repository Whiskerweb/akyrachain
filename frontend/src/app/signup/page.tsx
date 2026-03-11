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

export default function SignupPage() {
  const router = useRouter();
  const setToken = useAkyraStore((s) => s.setToken);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSignup = async (e: React.FormEvent) => {
    e.preventDefault();

    if (password !== confirmPassword) {
      toast.error("Les mots de passe ne correspondent pas");
      return;
    }

    if (password.length < 8) {
      toast.error("Le mot de passe doit faire au moins 8 caracteres");
      return;
    }

    setLoading(true);
    try {
      const data = await authAPI.signup(email, password);
      setToken(data.access_token);
      toast.success("Compte cree ! Bienvenue dans la jungle.");
      router.push("/onboarding");
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Erreur lors de l'inscription";
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
            CREER UN COMPTE
          </h2>

          <form onSubmit={handleSignup} className="space-y-4">
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
                placeholder="Min. 8 caracteres"
                required
                minLength={8}
              />
            </div>

            <div>
              <label className="text-akyra-textSecondary text-sm mb-1 block">
                Confirmer le mot de passe
              </label>
              <input
                type="password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                className="input-akyra"
                placeholder="********"
                required
              />
            </div>

            <Button type="submit" loading={loading} className="w-full">
              Rejoindre la jungle
            </Button>
          </form>

          <p className="text-akyra-textSecondary text-sm text-center mt-4">
            Deja un compte ?{" "}
            <Link href="/login" className="text-akyra-green hover:underline">
              Se connecter
            </Link>
          </p>
        </JungleBox>
      </PageTransition>
    </div>
  );
}
