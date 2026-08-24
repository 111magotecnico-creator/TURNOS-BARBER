"use client";

import { Suspense, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Button } from "@/components/ui/Button";
import { Field, Input } from "@/components/ui/Input";
import { apiFetch } from "@/lib/client";

// useSearchParams() fuerza un bailout de render estático; el
// límite de Suspense permite prerenderizar la página igual.
export default function AdminLoginPage() {
  return (
    <Suspense>
      <LoginForm />
    </Suspense>
  );
}

function LoginForm() {
  const router = useRouter();
  const params = useSearchParams();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      await apiFetch("/api/auth/login", {
        method: "POST",
        json: { email, password },
      });
      router.replace(params.get("next") || "/admin/dashboard");
      router.refresh(); // re-ejecuta middleware/layout con la cookie nueva
    } catch (err) {
      setError((err as Error).message);
      setLoading(false);
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center p-4">
      <div className="w-full max-w-sm">
        <div className="mb-8 text-center">
          <span className="mx-auto mb-3 flex h-14 w-14 items-center justify-center rounded-2xl bg-accent text-2xl text-accent-ink">
            ✂
          </span>
          <h1 className="text-xl font-extrabold tracking-wide">BARBER STUDIO</h1>
          <p className="mt-1 text-sm text-muted">Panel de administración</p>
        </div>

        <form onSubmit={submit} className="grid gap-4 rounded-card border border-line bg-surface p-6">
          <Field label="Email" required>
            <Input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="admin@barberstudio.com"
              autoComplete="email"
              required
            />
          </Field>
          <Field label="Contraseña" required>
            <Input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              autoComplete="current-password"
              required
            />
          </Field>
          {error && (
            <p className="rounded-xl border border-danger/40 bg-danger/10 px-3 py-2 text-sm text-danger">
              {error}
            </p>
          )}
          <Button type="submit" size="lg" fullWidth loading={loading}>
            Ingresar
          </Button>
        </form>
      </div>
    </div>
  );
}
