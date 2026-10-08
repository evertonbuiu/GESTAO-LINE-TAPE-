// Marca da Line Tape desenhada em SVG (fica nítida em qualquer tamanho e
// funciona no tema claro e no escuro, sem o fundo branco da imagem).
import { cn } from "@/lib/utils";
import { useLogo } from "@/hooks/useLogo";
import { useCompanySettings } from "@/hooks/useCompanySettings";

export function LineTapeSymbol({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 64 64" className={className} aria-hidden="true">
      <polygon points="12,6 12,58 34,32" fill="#E5343B" />
      <polygon points="12,6 58,32 34,32" fill="#3B3F94" />
      <polygon points="12,58 34,32 58,32" fill="#11A04C" />
      <path d="M12 6 L58 32 L12 58 Z" fill="none" stroke="white" strokeWidth="2.2" strokeLinejoin="round" />
      <path d="M34 32 L12 6 M34 32 L58 32 M34 32 L12 58" stroke="white" strokeWidth="2.2" strokeLinecap="round" />
    </svg>
  );
}

interface BrandMarkProps {
  compact?: boolean;
  className?: string;
}

/** Logo do menu lateral: usa o logo enviado em Configurações, se houver. */
export function BrandMark({ compact = false, className }: BrandMarkProps) {
  const { logoUrl } = useLogo();
  const { settings } = useCompanySettings();
  const name = settings?.company_name || "Line Tape";
  return (
    <div className={cn("flex min-w-0 items-center gap-3", className)}>
      {logoUrl ? (
        <img src={logoUrl} alt={name} className="h-9 w-9 shrink-0 rounded-lg bg-white object-contain p-0.5" />
      ) : (
        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-white/95 shadow-sm ring-1 ring-black/5">
          <LineTapeSymbol className="h-7 w-7" />
        </div>
      )}
      {!compact && (
        <div className="min-w-0 leading-tight">
          <p className="truncate text-sm font-semibold tracking-wide text-sidebar-foreground">GESTÃO LINE TAPE</p>
          <p className="truncate text-xs text-sidebar-foreground/60">{settings?.tagline || "Iluminação e locação"}</p>
        </div>
      )}
    </div>
  );
}
