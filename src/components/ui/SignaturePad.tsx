import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { SavedSignaturesSelector } from "@/components/ui/SavedSignaturesSelector";

interface SignaturePadProps {
  value?: string;
  onChange: (dataUrl?: string) => void;
  height?: number; // CSS pixels
  signatureType?: 'company' | 'client';
  showSavedSignatures?: boolean;
}

const SignaturePad = ({ 
  value, 
  onChange, 
  height = 160, 
  signatureType = 'company',
  showSavedSignatures = true 
}: SignaturePadProps) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [isDrawing, setIsDrawing] = useState(false);
  const [ctx, setCtx] = useState<CanvasRenderingContext2D | null>(null);

  const setupCanvas = () => {
    const canvas = canvasRef.current;
    const container = containerRef.current;
    if (!canvas || !container) return;

    const dpr = window.devicePixelRatio || 1;
    const width = Math.max(320, container.clientWidth);
    const cssHeight = height;

    canvas.width = Math.floor(width * dpr);
    canvas.height = Math.floor(cssHeight * dpr);
    canvas.style.width = width + "px";
    canvas.style.height = cssHeight + "px";

    const context = canvas.getContext("2d");
    if (!context) return;

    context.scale(dpr, dpr);
    context.lineJoin = "round";
    context.lineCap = "round";
    context.strokeStyle = "#111827"; // neutral-900 tone from design system
    context.lineWidth = 2;
    context.fillStyle = "#ffffff";

    // Clear to white background
    context.save();
    context.setTransform(1, 0, 0, 1, 0, 0);
    context.clearRect(0, 0, canvas.width, canvas.height);
    context.restore();

    setCtx(context);

    // If we have a saved signature, draw it
    if (value) {
      const img = new Image();
      img.onload = () => {
        context.drawImage(img, 0, 0, width, cssHeight);
      };
      img.src = value;
    }
  };

  useEffect(() => {
    setupCanvas();
    const onResize = () => setupCanvas();
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    // Redraw saved value if it changes externally
    if (!ctx || !canvasRef.current || !value) return;
    const container = containerRef.current;
    if (!container) return;
    const width = Math.max(320, container.clientWidth);
    const cssHeight = height;
    const img = new Image();
    img.onload = () => {
      ctx.clearRect(0, 0, width, cssHeight);
      ctx.drawImage(img, 0, 0, width, cssHeight);
    };
    img.src = value;
  }, [value, ctx, height]);

  const getPos = (e: PointerEvent | React.PointerEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current!;
    const rect = canvas.getBoundingClientRect();
    return { x: e.clientX - rect.left, y: e.clientY - rect.top };
  };

  const handlePointerDown = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (!ctx) return;
    (e.target as HTMLCanvasElement).setPointerCapture(e.pointerId);
    const { x, y } = getPos(e);
    ctx.beginPath();
    ctx.moveTo(x, y);
    setIsDrawing(true);
  };

  const handlePointerMove = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (!ctx || !isDrawing) return;
    const { x, y } = getPos(e);
    ctx.lineTo(x, y);
    ctx.stroke();
  };

  const commit = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const data = canvas.toDataURL("image/png");
    onChange(data);
  };

  const handlePointerUp = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (!ctx) return;
    setIsDrawing(false);
    ctx.closePath();
    commit();
  };

  const clear = () => {
    const canvas = canvasRef.current;
    if (!ctx || !canvas) return;
    const container = containerRef.current;
    if (!container) return;
    const width = Math.max(320, container.clientWidth);
    const cssHeight = height;
    ctx.clearRect(0, 0, width, cssHeight);
    onChange(undefined);
    toast("Assinatura removida");
  };

  const handleUploadClick = () => {
    fileInputRef.current?.click();
  };

  const handleFileChange: React.ChangeEventHandler<HTMLInputElement> = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!/^image\/(png|jpe?g)$/.test(file.type)) {
      toast("Formato inválido - Envie PNG ou JPG");
      e.currentTarget.value = "";
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      const url = reader.result as string;
      onChange(url);
      toast("Assinatura carregada");
    };
    reader.readAsDataURL(file);
    e.currentTarget.value = "";
  };

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <span className="text-sm text-muted-foreground">Assine no quadro abaixo</span>
        <div className="flex flex-wrap items-center gap-2 justify-end">
          <Button variant="secondary" size="sm" onClick={handleUploadClick}>Upload imagem</Button>
          <Button variant="ghost" size="sm" onClick={clear}>Remover</Button>
          <input ref={fileInputRef} type="file" accept="image/png,image/jpeg" className="hidden" onChange={handleFileChange} />
        </div>
      </div>
      
      {showSavedSignatures && (
        <div className="flex justify-center">
          <SavedSignaturesSelector
            signatureType={signatureType}
            currentSignature={value}
            onSignatureSelect={onChange}
          />
        </div>
      )}
      
      <div ref={containerRef} className="rounded-md border border-border bg-background">
        <canvas
          ref={canvasRef}
          onPointerDown={handlePointerDown}
          onPointerMove={handlePointerMove}
          onPointerUp={handlePointerUp}
          className="w-full touch-none cursor-crosshair"
        />
      </div>
    </div>
  );
};

export default SignaturePad;