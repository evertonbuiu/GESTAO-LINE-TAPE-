import React from "react";
import { Button } from "@/components/ui/button";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger, DropdownMenuSeparator, DropdownMenuLabel } from "@/components/ui/dropdown-menu";
import { Palette, Sun, Moon, Check } from "lucide-react";
import { useTheme } from "@/hooks/useTheme";

export const QuickThemeToggle = () => {
  const { theme, colorScheme, setTheme, setColorScheme, availableColorSchemes } = useTheme();

  const currentScheme = availableColorSchemes.find(s => s.id === colorScheme);

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" size="sm" className="gap-2">
          <Palette className="h-4 w-4" />
          Tema
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-48">
        <DropdownMenuLabel>Modo do Tema</DropdownMenuLabel>
        <DropdownMenuItem onClick={() => setTheme('light')}>
          <Sun className="h-4 w-4 mr-2" />
          Claro
          {theme === 'light' && <Check className="h-4 w-4 ml-auto" />}
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => setTheme('dark')}>
          <Moon className="h-4 w-4 mr-2" />
          Escuro
          {theme === 'dark' && <Check className="h-4 w-4 ml-auto" />}
        </DropdownMenuItem>
        
        <DropdownMenuSeparator />
        
        <DropdownMenuLabel>Esquema de Cores</DropdownMenuLabel>
        {availableColorSchemes.slice(0, 4).map((scheme) => (
          <DropdownMenuItem key={scheme.id} onClick={() => setColorScheme(scheme.id)}>
            <div className="flex items-center gap-2 w-full">
              <div className="flex gap-1">
                <div 
                  className="w-3 h-3 rounded-full border"
                  style={{ backgroundColor: `hsl(${scheme.primary})` }}
                />
                <div 
                  className="w-3 h-3 rounded-full border"
                  style={{ backgroundColor: `hsl(${scheme.secondary})` }}
                />
              </div>
              <span className="flex-1">{scheme.name}</span>
              {colorScheme === scheme.id && <Check className="h-4 w-4" />}
            </div>
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
};