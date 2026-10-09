// Janela de confirmação usada antes de excluir registros.
// Uso: if (!(await confirmDelete({ title, description }))) return;
import { useEffect, useState } from "react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

interface ConfirmOptions {
  title?: string;
  description?: string;
  confirmLabel?: string;
}

interface Pending extends ConfirmOptions {
  resolve: (ok: boolean) => void;
}

let show: ((p: Pending) => void) | null = null;

export function confirmDelete(opts: ConfirmOptions = {}): Promise<boolean> {
  return new Promise((resolve) => {
    if (!show) {
      // sem a janela montada (não deve acontecer): não exclui
      resolve(false);
      return;
    }
    show({ ...opts, resolve });
  });
}

export function ConfirmHost() {
  const [pending, setPending] = useState<Pending | null>(null);

  useEffect(() => {
    show = (p) => setPending(p);
    return () => {
      show = null;
    };
  }, []);

  const close = (ok: boolean) => {
    pending?.resolve(ok);
    setPending(null);
  };

  return (
    <AlertDialog open={!!pending} onOpenChange={(open) => !open && close(false)}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{pending?.title ?? "Excluir este registro?"}</AlertDialogTitle>
          <AlertDialogDescription>
            {pending?.description ?? "Esta ação não pode ser desfeita."}
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel onClick={() => close(false)}>Cancelar</AlertDialogCancel>
          <AlertDialogAction
            onClick={() => close(true)}
            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
          >
            {pending?.confirmLabel ?? "Excluir"}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
