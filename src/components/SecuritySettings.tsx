import { useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useCustomAuth } from "@/hooks/useCustomAuth";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Progress } from "@/components/ui/progress";
import { ShieldAlert, Loader2 } from "lucide-react";
import { toast } from "sonner";

const WEAK_PATTERNS = ["123456", "senha", "password", "admin", "linetape", "qwerty", "abc123"];

export interface PasswordCheck {
  score: number;
  problems: string[];
}

/** Avalia a força de uma senha localmente — nada é enviado ou registrado. */
export const evaluatePassword = (password: string, username = ""): PasswordCheck => {
  const problems: string[] = [];
  if (password.length < 10) problems.push("Use pelo menos 10 caracteres.");
  if (!/[a-z]/.test(password)) problems.push("Inclua letras minúsculas.");
  if (!/[A-Z]/.test(password)) problems.push("Inclua letras maiúsculas.");
  if (!/[0-9]/.test(password)) problems.push("Inclua números.");
  if (!/[^A-Za-z0-9]/.test(password)) problems.push("Inclua um símbolo.");
  const lower = password.toLowerCase();
  if (WEAK_PATTERNS.some((p) => lower.includes(p))) problems.push("Evite palavras comuns.");
  if (username && lower.includes(username.toLowerCase())) problems.push("Não use seu usuário na senha.");

  const score = Math.max(0, 6 - problems.length);
  return { score, problems };
};

const DISMISS_KEY = "linetape_password_advice_dismissed";

export const SecuritySettings = () => {
  const { user } = useCustomAuth();
  const [current, setCurrent] = useState("");
  const [next, setNext] = useState("");
  const [confirm, setConfirm] = useState("");
  const [saving, setSaving] = useState(false);
  const [dismissed, setDismissed] = useState(
    () => localStorage.getItem(`${DISMISS_KEY}_${user?.id ?? ""}`) === "1",
  );

  const check = useMemo(() => evaluatePassword(next, user?.username ?? ""), [next, user?.username]);
  const strong = next.length > 0 && check.problems.length === 0;
  const matches = next.length > 0 && next === confirm;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    if (!strong || !matches) return;

    setSaving(true);
    try {
      // Revalida a senha atual antes de trocar (não é armazenada em lugar algum).
      const email = `${user.username.toLowerCase()}@linetape.local`;
      const { error: signInError } = await supabase.auth.signInWithPassword({
        email,
        password: current,
      });
      if (signInError) {
        toast.error("Senha atual incorreta.");
        return;
      }

      const { error } = await supabase.auth.updateUser({ password: next });
      if (error) {
        toast.error("Não foi possível alterar a senha.");
        return;
      }

      localStorage.setItem(`${DISMISS_KEY}_${user.id}`, "1");
      setDismissed(true);
      setCurrent("");
      setNext("");
      setConfirm("");
      toast.success("Senha alterada com sucesso.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-6 p-6">

      {!dismissed && (
        <Alert>
          <ShieldAlert className="h-4 w-4" />
          <AlertTitle>Revise sua senha de acesso</AlertTitle>
          <AlertDescription className="space-y-2">
            <p>
              Se você ainda usa a senha inicial ou uma senha simples, troque agora. O sistema nunca
              exibe nem armazena sua senha em texto.
            </p>
            <Button
              size="sm"
              variant="ghost"
              onClick={() => {
                localStorage.setItem(`${DISMISS_KEY}_${user?.id ?? ""}`, "1");
                setDismissed(true);
              }}
            >
              Já troquei minha senha
            </Button>
          </AlertDescription>
        </Alert>
      )}

      <Card className="max-w-xl">
        <CardHeader>
          <CardTitle className="text-lg">Alterar senha</CardTitle>
          <CardDescription>Necessário informar a senha atual.</CardDescription>
        </CardHeader>
        <CardContent>
          <form className="space-y-4" onSubmit={handleSubmit}>
            <div>
              <Label htmlFor="current-password">Senha atual</Label>
              <Input
                id="current-password"
                type="password"
                autoComplete="current-password"
                value={current}
                onChange={(e) => setCurrent(e.target.value)}
                required
              />
            </div>
            <div>
              <Label htmlFor="new-password">Nova senha</Label>
              <Input
                id="new-password"
                type="password"
                autoComplete="new-password"
                value={next}
                onChange={(e) => setNext(e.target.value)}
                required
              />
              <Progress className="mt-2 h-2" value={(check.score / 6) * 100} />
              {check.problems.length > 0 && next.length > 0 && (
                <ul className="mt-2 list-disc pl-5 text-xs text-muted-foreground">
                  {check.problems.map((p) => (
                    <li key={p}>{p}</li>
                  ))}
                </ul>
              )}
            </div>
            <div>
              <Label htmlFor="confirm-password">Confirmar nova senha</Label>
              <Input
                id="confirm-password"
                type="password"
                autoComplete="new-password"
                value={confirm}
                onChange={(e) => setConfirm(e.target.value)}
                required
              />
              {confirm.length > 0 && !matches && (
                <p className="mt-1 text-xs text-destructive">As senhas não coincidem.</p>
              )}
            </div>
            <Button type="submit" disabled={!strong || !matches || !current || saving}>
              {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Alterar senha
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
};
