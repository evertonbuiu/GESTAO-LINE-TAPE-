import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Slider } from "@/components/ui/slider";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Sun, Moon, Monitor, RotateCcw, Save, Check } from "lucide-react";
import { useTheme } from "@/hooks/useTheme";
import { useToast } from "@/hooks/use-toast";
import {
  PRIMARY_PRESETS,
  FONT_SCALE_MIN,
  FONT_SCALE_MAX,
  RADIUS_SCALE_MIN,
  RADIUS_SCALE_MAX,
  isValidHsl,
  ThemeMode,
} from "@/lib/appearance";

const MODES: { id: ThemeMode; label: string; icon: typeof Sun }[] = [
  { id: "light", label: "Claro", icon: Sun },
  { id: "dark", label: "Escuro", icon: Moon },
  { id: "system", label: "Automático", icon: Monitor },
];

export const AppearanceSettings = () => {
  const { appearance, effectiveMode, updateAppearance, saveAppearance, resetAppearance } = useTheme();
  const { toast } = useToast();
  const [saving, setSaving] = useState(false);
  const [customColor, setCustomColor] = useState(appearance.primary_hsl ?? "");

  const handleSave = async () => {
    setSaving(true);
    try {
      await saveAppearance();
      toast({ title: "Aparência salva", description: "Suas preferências foram salvas na sua conta." });
    } catch {
      toast({
        title: "Erro ao salvar",
        description: "Não foi possível salvar suas preferências de aparência.",
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  };

  const handleReset = () => {
    resetAppearance();
    setCustomColor("");
    toast({ title: "Padrões restaurados", description: "Clique em Salvar para manter a alteração." });
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <CardTitle>Aparência</CardTitle>
            <CardDescription>
              Preferências pessoais de exibição. Aplicadas apenas à sua conta.
            </CardDescription>
          </div>
          <Badge variant="secondary">Modo atual: {effectiveMode === "dark" ? "Escuro" : "Claro"}</Badge>
        </div>
      </CardHeader>

      <CardContent className="space-y-6">
        {/* Modo */}
        <div className="space-y-2">
          <Label>Modo do tema</Label>
          <div className="grid grid-cols-3 gap-2">
            {MODES.map(({ id, label, icon: Icon }) => (
              <Button
                key={id}
                type="button"
                variant={appearance.mode === id ? "default" : "outline"}
                className="min-h-11 justify-center gap-2"
                aria-pressed={appearance.mode === id}
                onClick={() => updateAppearance({ mode: id })}
              >
                <Icon className="h-4 w-4" aria-hidden="true" />
                <span>{label}</span>
              </Button>
            ))}
          </div>
        </div>

        <Separator />

        {/* Cor principal */}
        <div className="space-y-3">
          <Label>Cor principal</Label>
          <div className="flex flex-wrap gap-2">
            <Button
              type="button"
              variant={appearance.primary_hsl === null ? "default" : "outline"}
              className="min-h-11"
              onClick={() => {
                updateAppearance({ primary_hsl: null });
                setCustomColor("");
              }}
            >
              Padrão do sistema
            </Button>
            {PRIMARY_PRESETS.map(preset => (
              <button
                key={preset.id}
                type="button"
                aria-label={`Cor ${preset.name}`}
                aria-pressed={appearance.primary_hsl === preset.hsl}
                onClick={() => {
                  updateAppearance({ primary_hsl: preset.hsl });
                  setCustomColor(preset.hsl);
                }}
                className="flex min-h-11 min-w-11 items-center justify-center rounded-md border border-border"
                style={{ backgroundColor: `hsl(${preset.hsl})` }}
              >
                {appearance.primary_hsl === preset.hsl && (
                  <Check className="h-4 w-4 text-primary-foreground" aria-hidden="true" />
                )}
              </button>
            ))}
          </div>
          <div className="space-y-1">
            <Label htmlFor="appearance-custom-hsl" className="text-xs text-muted-foreground">
              Cor personalizada (HSL, ex.: 217 91% 60%)
            </Label>
            <div className="flex gap-2">
              <Input
                id="appearance-custom-hsl"
                value={customColor}
                placeholder="217 91% 60%"
                onChange={e => {
                  const value = e.target.value;
                  setCustomColor(value);
                  if (isValidHsl(value)) updateAppearance({ primary_hsl: value });
                }}
              />
            </div>
            {customColor !== "" && !isValidHsl(customColor) && (
              <p className="text-xs text-destructive">Formato inválido. Use "H S% L%".</p>
            )}
          </div>
        </div>

        <Separator />

        {/* Densidade */}
        <div className="space-y-2">
          <Label>Densidade da interface</Label>
          <div className="grid grid-cols-2 gap-2">
            {(["comfortable", "compact"] as const).map(d => (
              <Button
                key={d}
                type="button"
                variant={appearance.density === d ? "default" : "outline"}
                className="min-h-11"
                aria-pressed={appearance.density === d}
                onClick={() => updateAppearance({ density: d })}
              >
                {d === "comfortable" ? "Confortável" : "Compacta"}
              </Button>
            ))}
          </div>
        </div>

        {/* Escalas */}
        <div className="space-y-2">
          <Label htmlFor="font-scale">Tamanho da fonte ({Math.round(appearance.font_scale * 100)}%)</Label>
          <Slider
            id="font-scale"
            min={FONT_SCALE_MIN}
            max={FONT_SCALE_MAX}
            step={0.05}
            value={[appearance.font_scale]}
            onValueChange={([v]) => updateAppearance({ font_scale: v })}
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="radius-scale">
            Arredondamento dos cantos ({Math.round(appearance.radius_scale * 100)}%)
          </Label>
          <Slider
            id="radius-scale"
            min={RADIUS_SCALE_MIN}
            max={RADIUS_SCALE_MAX}
            step={0.1}
            value={[appearance.radius_scale]}
            onValueChange={([v]) => updateAppearance({ radius_scale: v })}
          />
        </div>

        <Separator />

        {/* Acessibilidade */}
        <div className="space-y-4">
          <div className="flex items-center justify-between gap-4">
            <div>
              <Label htmlFor="reduced-motion">Reduzir animações</Label>
              <p className="text-xs text-muted-foreground">Minimiza transições e movimentos na tela.</p>
            </div>
            <Switch
              id="reduced-motion"
              checked={appearance.reduced_motion}
              onCheckedChange={v => updateAppearance({ reduced_motion: v })}
            />
          </div>
          <div className="flex items-center justify-between gap-4">
            <div>
              <Label htmlFor="high-contrast">Alto contraste</Label>
              <p className="text-xs text-muted-foreground">Aumenta o contraste de textos e bordas.</p>
            </div>
            <Switch
              id="high-contrast"
              checked={appearance.high_contrast}
              onCheckedChange={v => updateAppearance({ high_contrast: v })}
            />
          </div>
        </div>

        {/* Prévia */}
        <div className="rounded-lg border border-border bg-card p-4">
          <p className="mb-3 text-sm font-medium text-card-foreground">Prévia</p>
          <div className="flex flex-wrap items-center gap-2">
            <Button type="button" size="sm">Botão principal</Button>
            <Button type="button" size="sm" variant="outline">Secundário</Button>
            <Badge>Etiqueta</Badge>
            <span className="text-sm text-muted-foreground">Texto de apoio</span>
          </div>
        </div>

        <div className="flex flex-wrap gap-2">
          <Button type="button" onClick={handleSave} disabled={saving} className="min-h-11 gap-2">
            <Save className="h-4 w-4" aria-hidden="true" />
            {saving ? "Salvando..." : "Salvar aparência"}
          </Button>
          <Button type="button" variant="outline" onClick={handleReset} className="min-h-11 gap-2">
            <RotateCcw className="h-4 w-4" aria-hidden="true" />
            Restaurar padrões
          </Button>
        </div>
      </CardContent>
    </Card>
  );
};

export default AppearanceSettings;
