import { useEffect, useMemo, useRef, useState } from "react";
import QRCode from "qrcode";
import { BrowserMultiFormatReader, type IScannerControls } from "@zxing/browser";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Camera, Printer, QrCode, Loader2, Search } from "lucide-react";
import { useCustomAuth } from "@/hooks/useCustomAuth";

import { PageActions } from "@/components/layout/PageHeader";
interface EquipmentRow {
  id: string;
  name: string;
  category: string | null;
  total_stock: number | null;
  available: number | null;
  status: string | null;
}

/** Conteúdo do QR: usa o identificador já existente do equipamento. */
export const qrPayload = (id: string) => `LINETAPE:EQUIP:${id}`;

export const parseQrPayload = (raw: string): string | null => {
  const value = raw.trim();
  const uuid = /[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}/;
  const match = value.match(uuid);
  return match ? match[0] : null;
};

export const EquipmentQRCodes = ({ onNavigate }: { onNavigate?: (tab: string) => void }) => {
  const { userRole } = useCustomAuth();
  const canAct = userRole === "admin" || userRole === "deposito" || userRole === "financeiro";

  const [equipment, setEquipment] = useState<EquipmentRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [scannerOpen, setScannerOpen] = useState(false);
  const [manualCode, setManualCode] = useState("");
  const [found, setFound] = useState<EquipmentRow | null>(null);
  const [cameraError, setCameraError] = useState<string | null>(null);

  const videoRef = useRef<HTMLVideoElement | null>(null);
  const controlsRef = useRef<IScannerControls | null>(null);

  useEffect(() => {
    void (async () => {
      const { data, error: err } = await supabase
        .from("equipment")
        .select("id, name, category, total_stock, available, status")
        .order("name")
        .limit(500);
      if (err) setError("Não foi possível carregar os equipamentos.");
      setEquipment(data ?? []);
      setLoading(false);
    })();
  }, []);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return equipment;
    return equipment.filter(
      (e) => e.name.toLowerCase().includes(q) || (e.category ?? "").toLowerCase().includes(q),
    );
  }, [equipment, search]);

  const openEquipmentById = (id: string) => {
    const item = equipment.find((e) => e.id === id);
    if (!item) {
      toast.error("Equipamento não encontrado para este código.");
      return;
    }
    setFound(item);
    setScannerOpen(false);
  };

  const stopScanner = () => {
    controlsRef.current?.stop();
    controlsRef.current = null;
  };

  useEffect(() => {
    if (!scannerOpen) {
      stopScanner();
      return;
    }
    setCameraError(null);
    const supported =
      typeof navigator !== "undefined" && !!navigator.mediaDevices?.getUserMedia;
    if (!supported) {
      setCameraError("Câmera não suportada neste dispositivo. Use a digitação do código.");
      return;
    }
    const reader = new BrowserMultiFormatReader();
    let cancelled = false;
    void reader
      .decodeFromVideoDevice(undefined, videoRef.current ?? undefined, (result) => {
        if (result && !cancelled) {
          const id = parseQrPayload(result.getText());
          if (id) {
            cancelled = true;
            stopScanner();
            openEquipmentById(id);
          }
        }
      })
      .then((controls) => {
        controlsRef.current = controls;
        if (cancelled) controls.stop();
      })
      .catch(() => {
        setCameraError("Não foi possível acessar a câmera. Use a digitação do código.");
      });

    return () => {
      cancelled = true;
      stopScanner();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [scannerOpen]);

  const printLabels = async () => {
    const chosen = equipment.filter((e) => selected.has(e.id));
    if (chosen.length === 0) {
      toast.error("Selecione ao menos um equipamento.");
      return;
    }
    const labels = await Promise.all(
      chosen.map(async (e) => ({
        name: e.name,
        code: e.id.slice(0, 8).toUpperCase(),
        dataUrl: await QRCode.toDataURL(qrPayload(e.id), { width: 220, margin: 1 }),
      })),
    );

    const win = window.open("", "_blank", "width=900,height=700");
    if (!win) {
      toast.error("Permita pop-ups para imprimir as etiquetas.");
      return;
    }
    win.document.write(`<!doctype html><html lang="pt-BR"><head><meta charset="utf-8" />
      <title>Etiquetas QR — LINE TAPE</title>
      <style>
        body{font-family:Arial,Helvetica,sans-serif;margin:16px}
        .grid{display:grid;grid-template-columns:repeat(3,1fr);gap:12px}
        .label{border:1px solid #ccc;border-radius:6px;padding:10px;text-align:center;page-break-inside:avoid}
        .label img{width:130px;height:130px}
        .name{font-size:12px;font-weight:bold;margin-top:6px;word-break:break-word}
        .code{font-size:10px;color:#555}
      </style></head><body>
      <h3>Etiquetas de equipamentos</h3>
      <div class="grid">
        ${labels
          .map(
            (l) =>
              `<div class="label"><img src="${l.dataUrl}" alt="QR ${l.name}" /><div class="name">${l.name}</div><div class="code">${l.code}</div></div>`,
          )
          .join("")}
      </div>
      <script>window.onload=function(){setTimeout(function(){window.print()},300)}<\/script>
      </body></html>`);
    win.document.close();
  };

  return (
    <div className="space-y-6 p-6">
      <PageActions>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => setScannerOpen(true)}>
            <Camera className="mr-2 h-4 w-4" /> Ler QR Code
          </Button>
          <Button onClick={() => void printLabels()} disabled={selected.size === 0}>
            <Printer className="mr-2 h-4 w-4" /> Imprimir ({selected.size})
          </Button>
        </div>
      </PageActions>

      {error && (
        <Alert variant="destructive">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Equipamentos</CardTitle>
          <CardDescription>Selecione os itens para gerar as etiquetas.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="relative max-w-md">
            <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              className="pl-8"
              placeholder="Buscar equipamento…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>

          {loading ? (
            <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
          ) : filtered.length === 0 ? (
            <p className="text-sm text-muted-foreground">Nenhum equipamento encontrado.</p>
          ) : (
            <div className="max-h-[480px] space-y-2 overflow-auto">
              {filtered.map((e) => (
                <div key={e.id} className="flex items-center gap-3 rounded border border-border p-2">
                  <Checkbox
                    checked={selected.has(e.id)}
                    onCheckedChange={(v) =>
                      setSelected((prev) => {
                        const next = new Set(prev);
                        if (v === true) next.add(e.id);
                        else next.delete(e.id);
                        return next;
                      })
                    }
                  />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium">{e.name}</p>
                    <p className="text-xs text-muted-foreground">
                      {e.category ?? "Sem categoria"} · código {e.id.slice(0, 8).toUpperCase()}
                    </p>
                  </div>
                  <Badge variant="outline">{e.available ?? 0} disp.</Badge>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <Dialog open={scannerOpen} onOpenChange={setScannerOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Ler QR Code</DialogTitle>
            <DialogDescription>
              Aponte a câmera para a etiqueta ou digite o código manualmente.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            {cameraError ? (
              <Alert>
                <AlertDescription>{cameraError}</AlertDescription>
              </Alert>
            ) : (
              <video ref={videoRef} className="w-full rounded bg-black" muted playsInline />
            )}
            <div className="space-y-1">
              <Label>Código do equipamento</Label>
              <div className="flex gap-2">
                <Input
                  value={manualCode}
                  placeholder="Cole o conteúdo do QR ou o ID"
                  onChange={(e) => setManualCode(e.target.value)}
                />
                <Button
                  onClick={() => {
                    const id = parseQrPayload(manualCode);
                    if (!id) {
                      toast.error("Código inválido.");
                      return;
                    }
                    openEquipmentById(id);
                  }}
                >
                  Abrir
                </Button>
              </div>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={!!found} onOpenChange={(o) => !o && setFound(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{found?.name}</DialogTitle>
            <DialogDescription>
              {found?.category ?? "Sem categoria"} · código {found?.id.slice(0, 8).toUpperCase()}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2 text-sm">
            <p>Estoque total: {found?.total_stock ?? 0}</p>
            <p>Disponível: {found?.available ?? 0}</p>
            <p>Status: {found?.status ?? "-"}</p>
          </div>
          <div className="flex flex-wrap gap-2 pt-2">
            <Button
              variant="outline"
              disabled={!canAct}
              onClick={() => {
                onNavigate?.("event-checklists");
                setFound(null);
              }}
            >
              Ir para checklists
            </Button>
            <Button
              variant="outline"
              disabled={!canAct}
              onClick={() => {
                onNavigate?.("maintenance");
                setFound(null);
              }}
            >
              Ir para manutenção
            </Button>
            <Button
              variant="ghost"
              onClick={() => {
                onNavigate?.("equipment");
                setFound(null);
              }}
            >
              Ver equipamentos
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};
