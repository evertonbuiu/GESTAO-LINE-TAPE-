import { useLogo } from "@/hooks/useLogo";
import { useCompanySettings } from "@/hooks/useCompanySettings";
import { LineTapeSymbol } from "@/components/layout/BrandMark";

interface LogoProps {
  size?: "sm" | "md" | "lg";
  showText?: boolean;
}

// Logo da empresa: usa a imagem enviada em Configurações; sem ela, mostra a
// marca da Line Tape desenhada em SVG.
export const Logo = ({ size = "md", showText = true }: LogoProps) => {
  const { logoUrl } = useLogo();
  const { settings } = useCompanySettings();
  const box = { sm: "h-12 w-12", md: "h-16 w-16", lg: "h-20 w-20" }[size];
  const text = { sm: "text-lg", md: "text-xl", lg: "text-2xl" }[size];

  return (
    <div className="flex items-center gap-3">
      {logoUrl ? (
        <img src={logoUrl} alt="GESTÃO LINE TAPE" className={`${box} rounded-xl bg-white object-contain p-1`} />
      ) : (
        <div className={`${box} flex items-center justify-center rounded-xl bg-white p-2 shadow-sm ring-1 ring-black/5`}>
          <LineTapeSymbol className="h-full w-full" />
        </div>
      )}
      {showText && (
        <div>
          <h1 className={`${text} font-bold text-foreground`}>
            {settings?.company_name || "GESTÃO LINE TAPE"}
          </h1>
          {size !== "sm" && (
            <p className="text-sm text-muted-foreground">{settings?.tagline || "Iluminação e locação"}</p>
          )}
        </div>
      )}
    </div>
  );
};
