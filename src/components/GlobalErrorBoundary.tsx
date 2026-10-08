import { Component, ErrorInfo, ReactNode } from "react";
import { AlertCircle, Copy, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { buildDiagnostics, logAppError } from "@/lib/errorLogger";

interface Props {
  children: ReactNode;
}

interface State {
  error: Error | null;
  copied: boolean;
}

export class GlobalErrorBoundary extends Component<Props, State> {
  state: State = { error: null, copied: false };

  static getDerivedStateFromError(error: Error): Partial<State> {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    void logAppError({
      message: error.message,
      stack: error.stack,
      context: { componentStack: info.componentStack },
    });
  }

  private diagnostics() {
    const { error } = this.state;
    return JSON.stringify(
      buildDiagnostics({ message: error?.message ?? "Erro desconhecido", stack: error?.stack }),
      null,
      2,
    );
  }

  private handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(this.diagnostics());
      this.setState({ copied: true });
    } catch {
      this.setState({ copied: false });
    }
  };

  render() {
    const { error, copied } = this.state;
    if (!error) return this.props.children;

    return (
      <div className="min-h-screen flex items-center justify-center bg-background p-6">
        <Alert variant="destructive" className="max-w-lg">
          <AlertCircle className="h-4 w-4" />
          <AlertTitle>Algo deu errado</AlertTitle>
          <AlertDescription className="mt-2 space-y-4">
            <p className="text-sm">
              Registramos o problema para análise. Você pode recarregar o sistema ou copiar o
              diagnóstico e enviar ao suporte.
            </p>
            <pre className="max-h-40 overflow-auto rounded bg-muted p-2 text-xs text-muted-foreground">
              {error.message}
            </pre>
            <div className="flex gap-2">
              <Button size="sm" onClick={() => window.location.reload()}>
                <RefreshCw className="mr-2 h-3 w-3" />
                Recarregar
              </Button>
              <Button size="sm" variant="outline" onClick={this.handleCopy}>
                <Copy className="mr-2 h-3 w-3" />
                {copied ? "Copiado!" : "Copiar diagnóstico"}
              </Button>
            </div>
          </AlertDescription>
        </Alert>
      </div>
    );
  }
}
