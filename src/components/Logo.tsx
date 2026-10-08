import logoImage from "@/assets/logo.png";
import { useLogo } from "@/hooks/useLogo";
import { useCompanySettings } from "@/hooks/useCompanySettings";

interface LogoProps {
  size?: "sm" | "md" | "lg";
  showText?: boolean;
}

export const Logo = ({ size = "md", showText = true }: LogoProps) => {
  const { logoUrl, isLoading } = useLogo();
  const { settings } = useCompanySettings();
  const sizeClasses = {
    sm: "h-12", // era h-8 (32px) -> h-12 (48px) = +16px
    md: "h-16", // era h-12 (48px) -> h-16 (64px) = +16px  
    lg: "h-20"  // era h-16 (64px) -> h-20 (80px) = +16px
  };

  const textSizeClasses = {
    sm: "text-lg",
    md: "text-xl", 
    lg: "text-2xl"
  };

  return (
    <div className="flex items-center gap-3">
      <img 
        src={logoUrl || logoImage} 
        alt="GESTAO LINE TAPE" 
        className={`${sizeClasses[size]} w-auto object-contain`}
      />
      {showText && (
        <div>
          <h1 className={`${textSizeClasses[size]} font-bold text-primary`}>
            {settings?.company_name || 'GESTAO LINE TAPE'}
          </h1>
          {size !== "sm" && (
            <p className="text-sm text-muted-foreground">
              {settings?.tagline || 'Controle de Estoque'}
            </p>
          )}
        </div>
      )}
    </div>
  );
};