import { useState } from 'react';
import {
  Building2,
  CheckCircle2,
  FileUp,
  Loader2,
  LockKeyhole,
  RefreshCw,
  ShieldCheck,
} from 'lucide-react';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

type C6TestResult = {
  environment?: string;
  authenticated?: boolean;
  statement_access?: boolean;
  start_date?: string;
  end_date?: string;
  entries_count?: number;
  received?: number;
  recognized?: number;
  imported?: number;
  ignored?: number;
};

export const OpenFinanceConnection = () => {
  const { toast } = useToast();
  const [testingAuth, setTestingAuth] = useState(false);
  const [testingStatement, setTestingStatement] = useState(false);
  const [result, setResult] = useState<C6TestResult | null>(null);

  const testAuthentication = async () => {
    setTestingAuth(true);
    try {
      const { data, error } = await supabase.functions.invoke('c6-auth-test', {
        body: {},
      });
      if (error) throw error;
      if (!data?.ok || !data?.authenticated) {
        throw new Error(data?.error || 'O C6 não confirmou a autenticação.');
      }

      setResult(data);
      toast({
        title: 'C6 autenticado com sucesso',
        description: data.statement_access
          ? 'O acesso ao extrato de produção está liberado.'
          : 'Autenticação concluída, mas o escopo statement.read não foi localizado.',
      });
    } catch (error) {
      toast({
        title: 'Falha ao testar o C6',
        description: error instanceof Error ? error.message : 'Tente novamente.',
        variant: 'destructive',
      });
    } finally {
      setTestingAuth(false);
    }
  };

  const testStatement = async () => {
    setTestingStatement(true);
    try {
      const { data, error } = await supabase.functions.invoke('c6-statement-sync', {
        body: { days: 7 },
      });
      if (error) throw error;
      if (!data?.ok) throw new Error(data?.error || 'O C6 não retornou o extrato.');

      setResult(data);
      toast({
        title: 'Extrato do C6 sincronizado',
        description: `${data.imported ?? 0} novo(s) lançamento(ões); ${data.ignored ?? 0} já existente(s).`,
      });
    } catch (error) {
      toast({
        title: 'Falha ao consultar o extrato',
        description: error instanceof Error ? error.message : 'Tente novamente.',
        variant: 'destructive',
      });
    } finally {
      setTestingStatement(false);
    }
  };

  return (
    <div className="space-y-5 p-1">
      <Alert>
        <ShieldCheck className="h-4 w-4" />
        <AlertTitle>Conexão direta e segura com o C6 Bank</AlertTitle>
        <AlertDescription>
          O Line Tape usa a API oficial do C6 Bank PJ. Certificado e credenciais permanecem
          protegidos nas Edge Functions do Supabase e nunca são enviados ao navegador.
        </AlertDescription>
      </Alert>

      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between gap-2">
              <CardTitle className="flex items-center gap-2 text-base">
                <FileUp className="h-4 w-4" /> Importar extrato
              </CardTitle>
              <Badge>Disponível</Badge>
            </div>
            <CardDescription>
              OFX, CSV e Excel continuam disponíveis para conferência manual.
            </CardDescription>
          </CardHeader>
          <CardContent className="text-sm text-muted-foreground">
            Use esta alternativa para períodos antigos ou durante indisponibilidade da API.
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <div className="flex items-center justify-between gap-2">
              <CardTitle className="flex items-center gap-2 text-base">
                <Building2 className="h-4 w-4" /> C6 Bank PJ
              </CardTitle>
              <Badge variant="default">API direta configurada</Badge>
            </div>
            <CardDescription>
              Consulte o extrato bancário diretamente pela API oficial de produção do C6.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3 text-sm">
            <div className="flex gap-2">
              <LockKeyhole className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
              <span>Integração mTLS sem Pluggy e sem senha bancária no sistema.</span>
            </div>
            <div className="flex gap-2">
              <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
              <span>Novos lançamentos são incluídos automaticamente, sem duplicar os existentes.</span>
            </div>

            <div className="grid gap-2 sm:grid-cols-2">
              <Button variant="outline" onClick={testAuthentication} disabled={testingAuth || testingStatement}>
                {testingAuth ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  <ShieldCheck className="mr-2 h-4 w-4" />
                )}
                Testar conexão
              </Button>
              <Button onClick={testStatement} disabled={testingAuth || testingStatement}>
                {testingStatement ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  <RefreshCw className="mr-2 h-4 w-4" />
                )}
                Sincronizar agora
              </Button>
            </div>

            {result && (
              <div className="rounded-md border bg-muted/40 p-3 text-xs" aria-live="polite">
                <p>
                  <strong>Ambiente:</strong>{' '}
                  {result.environment === 'production' ? 'Produção' : result.environment || 'Não informado'}
                </p>
                {typeof result.authenticated === 'boolean' && (
                  <p>
                    <strong>Autenticação:</strong> {result.authenticated ? 'Aprovada' : 'Não aprovada'}
                  </p>
                )}
                {typeof result.statement_access === 'boolean' && (
                  <p>
                    <strong>Acesso ao extrato:</strong>{' '}
                    {result.statement_access ? 'Liberado' : 'Não liberado'}
                  </p>
                )}
                {typeof result.entries_count === 'number' && (
                  <p>
                    <strong>Lançamentos encontrados:</strong> {result.entries_count}
                  </p>
                )}
                {typeof result.imported === 'number' && (
                  <p>
                    <strong>Novos lançamentos:</strong> {result.imported}
                  </p>
                )}
                {typeof result.ignored === 'number' && (
                  <p>
                    <strong>Já existentes:</strong> {result.ignored}
                  </p>
                )}
                {result.start_date && result.end_date && (
                  <p>
                    <strong>Período:</strong> {result.start_date} a {result.end_date}
                  </p>
                )}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
};
