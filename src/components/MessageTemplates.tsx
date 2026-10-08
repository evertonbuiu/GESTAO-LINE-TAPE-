import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Loader2, MessageSquare, AlertTriangle } from "lucide-react";
import { useCustomAuth } from "@/hooks/useCustomAuth";

interface Template {
  id: string;
  key: string;
  title: string;
  body: string;
  channel: string;
  is_active: boolean;
}

const VARIABLES = [
  "{{cliente}}",
  "{{evento}}",
  "{{data_evento}}",
  "{{valor}}",
  "{{link}}",
  "{{empresa}}",
];

/**
 * Templates de mensagens (WhatsApp).
 * O envio permanece DESATIVADO até que WHATSAPP_APP_SECRET e WHATSAPP_VERIFY_TOKEN
 * estejam configurados nos segredos do projeto.
 */
export const MessageTemplates = () => {
  const { userRole } = useCustomAuth();
  const canEdit = userRole === "admin" || userRole === "financeiro";

  const [templates, setTemplates] = useState<Template[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    const { data, error: err } = await supabase
      .from("message_templates")
      .select("id, key, title, body, channel, is_active")
      .order("key");
    if (err) setError("Não foi possível carregar os templates.");
    setTemplates((data ?? []) as Template[]);
    setLoading(false);
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const save = async (template: Template) => {
    setSaving(template.id);
    const { error: err } = await supabase
      .from("message_templates")
      .update({ title: template.title, body: template.body, is_active: template.is_active })
      .eq("id", template.id);
    if (err) toast.error("Não foi possível salvar o template.");
    else toast.success("Template salvo.");
    setSaving(null);
  };

  const patch = (id: string, changes: Partial<Template>) =>
    setTemplates((prev) => prev.map((t) => (t.id === id ? { ...t, ...changes } : t)));

  return (
    <div className="space-y-6 p-6">

      <Alert variant="destructive">
        <AlertTriangle className="h-4 w-4" />
        <AlertTitle>Envio automático desativado</AlertTitle>
        <AlertDescription>
          O disparo de mensagens permanece desligado até que os segredos{" "}
          <strong>WHATSAPP_APP_SECRET</strong> e <strong>WHATSAPP_VERIFY_TOKEN</strong> sejam
          configurados. Você pode editar e ativar os templates normalmente — nada será enviado
          enquanto a integração estiver pendente.
        </AlertDescription>
      </Alert>

      {error && <p className="text-sm text-destructive">{error}</p>}

      {loading ? (
        <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
      ) : templates.length === 0 ? (
        <p className="text-sm text-muted-foreground">Nenhum template cadastrado.</p>
      ) : (
        <div className="grid gap-4 lg:grid-cols-2">
          {templates.map((t) => (
            <Card key={t.id}>
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between gap-2">
                  <div>
                    <CardTitle className="text-base">{t.title}</CardTitle>
                    <CardDescription>
                      chave: {t.key} · canal: {t.channel}
                    </CardDescription>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge variant={t.is_active ? "default" : "outline"}>
                      {t.is_active ? "Ativo" : "Inativo"}
                    </Badge>
                    <Switch
                      checked={t.is_active}
                      disabled={!canEdit}
                      onCheckedChange={(v) => patch(t.id, { is_active: v })}
                    />
                  </div>
                </div>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="space-y-1">
                  <Label>Título</Label>
                  <Input
                    value={t.title}
                    disabled={!canEdit}
                    onChange={(e) => patch(t.id, { title: e.target.value })}
                  />
                </div>
                <div className="space-y-1">
                  <Label>Mensagem</Label>
                  <Textarea
                    rows={5}
                    value={t.body}
                    disabled={!canEdit}
                    onChange={(e) => patch(t.id, { body: e.target.value })}
                  />
                </div>
                <p className="text-xs text-muted-foreground">
                  Variáveis disponíveis: {VARIABLES.join(", ")}
                </p>
                <Button
                  size="sm"
                  disabled={!canEdit || saving === t.id}
                  onClick={() => void save(t)}
                >
                  {saving === t.id && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  Salvar
                </Button>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
};
