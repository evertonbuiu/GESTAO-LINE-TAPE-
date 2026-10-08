import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Textarea } from "@/components/ui/textarea";
import { AlertTriangle, CheckCircle2, FlaskConical, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import {
  NATIONAL_EDGE_FUNCTION,
  NATIONAL_HOMOLOGATION_URL,
  NATIONAL_MANUAL_URL,
  NATIONAL_MANUAL_VERSION,
  NATIONAL_NOT_A_FISCAL_DOCUMENT,
  NATIONAL_REGISTRATION_LABELS,
  NationalRegistrationStatus,
  nationalBlockReasons,
} from "@/lib/nfseNational";

interface Props {
  config?: {
    national_homologation_enabled?: boolean | null;
    national_transmission_enabled?: boolean | null;
    national_registration_status?: string | null;
  } | null;
}

export function NationalHomologationSection({ config }: Props) {
  const { toast } = useToast();
  const [validating, setValidating] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [result, setResult] = useState<string | null>(null);
  const [xml, setXml] = useState<string | null>(null);

  const status = (config?.national_registration_status ?? "nao_solicitado") as NationalRegistrationStatus;

  const call = async (action: string, extra: Record<string, unknown> = {}) => {
    const { data, error } = await supabase.functions.invoke(NATIONAL_EDGE_FUNCTION, {
      body: { action, ...extra },
    });
    if (error) throw new Error(error.message);
    return data as Record<string, unknown>;
  };

  const handleValidate = async () => {
    setValidating(true);
    setResult(null);
    try {
      const data = await call("preflight");
      const checks = (data?.checks ?? {}) as Record<string, unknown>;
      setResult(
        [
          data?.ready ? "Ambiente acessível e configuração válida." : "Ambiente não está pronto.",
          `WSDL: HTTP ${checks.http_status ?? "—"} / contrato ${checks.contract_valid ? "válido" : "inválido"}`,
          checks.wsdl_detail ? `Detalhe: ${checks.wsdl_detail}` : null,
          data?.instructions ? String(data.instructions) : null,
        ]
          .filter(Boolean)
          .join("\n")
      );
    } catch (e) {
      setResult(`Falha ao validar: ${(e as Error).message}`);
    } finally {
      setValidating(false);
    }
  };

  const handlePreview = async () => {
    setGenerating(true);
    setXml(null);
    try {
      const data = await call("preview_dps", {
        dps_number: "1",
        service_description: "Execução de música com sonorização e iluminação cênica",
        service_value: 1000,
        issue_date: new Date().toISOString(),
        competence_date: new Date().toISOString(),
      });
      setXml(String(data?.xml ?? ""));
      toast({ title: "Prévia gerada", description: NATIONAL_NOT_A_FISCAL_DOCUMENT });
    } catch (e) {
      toast({
        title: "Erro ao gerar prévia",
        description: (e as Error).message,
        variant: "destructive",
      });
    } finally {
      setGenerating(false);
    }
  };

  return (
    <div className="space-y-3 rounded-lg border border-dashed p-4">
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <FlaskConical className="h-4 w-4" />
          <span className="font-medium">Homologação NFS-e Nacional (DPS)</span>
        </div>
        <Badge variant="outline">Não vale como nota fiscal</Badge>
      </div>

      <p className="text-xs text-muted-foreground">
        Adaptador separado do padrão de produção ABRASF 2.04. Endpoint oficial:{" "}
        <span className="break-all">{NATIONAL_HOMOLOGATION_URL}</span> — manual v{NATIONAL_MANUAL_VERSION}{" "}
        <a href={NATIONAL_MANUAL_URL} target="_blank" rel="noreferrer" className="underline">
          (PDF)
        </a>
        .
      </p>

      <div className="flex items-center gap-2 text-xs">
        {status === "aprovado" ? (
          <CheckCircle2 className="h-4 w-4 text-green-600" />
        ) : (
          <AlertTriangle className="h-4 w-4 text-amber-600" />
        )}
        <span>{NATIONAL_REGISTRATION_LABELS[status] ?? status}</span>
      </div>

      <Alert>
        <AlertTriangle className="h-4 w-4" />
        <AlertDescription className="text-xs">
          Transmissão desativada: {nationalBlockReasons(config ?? null).join(" ")}
        </AlertDescription>
      </Alert>

      <div className="flex flex-wrap gap-2">
        <Button variant="outline" size="sm" onClick={handleValidate} disabled={validating}>
          {validating && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
          Validar ambiente
        </Button>
        <Button variant="outline" size="sm" onClick={handlePreview} disabled={generating}>
          {generating && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
          Gerar prévia XML
        </Button>
      </div>

      {result && <pre className="whitespace-pre-wrap text-xs text-muted-foreground">{result}</pre>}
      {xml && <Textarea readOnly value={xml} className="h-48 font-mono text-[11px]" />}
    </div>
  );
}

export default NationalHomologationSection;
