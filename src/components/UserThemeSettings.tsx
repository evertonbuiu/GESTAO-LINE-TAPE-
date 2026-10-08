import React, { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { Palette, Sun, Moon, Save, RotateCcw, Eye, Check } from "lucide-react";
import { useTheme } from "@/hooks/useTheme";
import { useToast } from "@/hooks/use-toast";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { HslColorPicker } from "react-colorful";
import { AppearanceSettings } from "@/components/theme/AppearanceSettings";


import { PageActions } from "@/components/layout/PageHeader";
interface ColorInputProps {
  label: string;
  value: string;
  onChange: (value: string) => void;
  description?: string;
}

const ColorInput = ({ label, value, onChange, description }: ColorInputProps) => {
  const [hslValue, setHslValue] = useState(value);
  const [showPicker, setShowPicker] = useState(false);

  const handleChange = (newValue: string) => {
    setHslValue(newValue);
    onChange(newValue);
  };

  // Convert HSL string to HSL object for color picker
  const hslToObject = (hslString: string) => {
    const match = hslString.match(/(\d+)\s+(\d+)%\s+(\d+)%/);
    if (match) {
      return {
        h: parseInt(match[1]),
        s: parseInt(match[2]),
        l: parseInt(match[3])
      };
    }
    return { h: 220, s: 60, l: 50 };
  };

  // Convert HSL object to HSL string
  const objectToHsl = (hsl: { h: number; s: number; l: number }) => {
    return `${Math.round(hsl.h)} ${Math.round(hsl.s)}% ${Math.round(hsl.l)}%`;
  };

  const handlePickerChange = (hsl: { h: number; s: number; l: number }) => {
    const hslString = objectToHsl(hsl);
    handleChange(hslString);
  };

  return (
    <div className="space-y-2">
      <Label className="text-sm font-medium">{label}</Label>
      {description && (
        <p className="text-xs text-muted-foreground">{description}</p>
      )}
      <div className="space-y-3">
        <div className="flex items-center gap-2">
          <Input
            value={hslValue}
            onChange={(e) => handleChange(e.target.value)}
            placeholder="Ex: 220 60% 50%"
            className="flex-1"
          />
          <Button
            variant="outline"
            size="sm"
            onClick={() => setShowPicker(!showPicker)}
            className="w-12 h-8 p-0"
            style={{ backgroundColor: `hsl(${hslValue})` }} title="Escolher cor" aria-label="Escolher cor">
            <Palette className="h-4 w-4" />
          </Button>
        </div>
        
        {showPicker && (
          <div className="p-4 border rounded-lg bg-background">
            <HslColorPicker
              color={hslToObject(hslValue)}
              onChange={handlePickerChange}
            />
            <div className="mt-3 flex justify-end">
              <Button 
                variant="outline" 
                size="sm"
                onClick={() => setShowPicker(false)}
              >
                Fechar
              </Button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export const UserThemeSettings = () => {
  const { 
    theme, 
    colorScheme, 
    setTheme, 
    setColorScheme, 
    availableColorSchemes,
    customColors,
    updateAllCustomColors,
    saveThemePreferences
  } = useTheme();
  
  const { toast } = useToast();
  const [isPreviewOpen, setIsPreviewOpen] = useState(false);
  const [tempCustomColors, setTempCustomColors] = useState(customColors);

  // Sync temp colors with actual custom colors when they change
  React.useEffect(() => {
    setTempCustomColors(customColors);
  }, [customColors]);

  const handleSaveTheme = async () => {
    try {
      await saveThemePreferences();
      toast({
        title: "Tema Salvo",
        description: "Suas preferências de tema foram salvas com sucesso!",
      });
    } catch (error) {
      toast({
        title: "Erro",
        description: "Não foi possível salvar as preferências de tema.",
        variant: "destructive",
      });
    }
  };

  const handleCustomColorChange = (colorKey: string, colorValue: string) => {
    const updatedColors = {
      ...tempCustomColors,
      [colorKey]: colorValue
    };
    
    setTempCustomColors(updatedColors);
    
    // Apply all custom colors at once for real-time preview
    updateAllCustomColors(updatedColors);
    
    // Automatically switch to custom scheme
    setColorScheme('custom');
  };

  const applyCustomColors = () => {
    toast({
      title: "Cores Aplicadas",
      description: "Suas cores personalizadas foram aplicadas!",
    });
  };

  const resetToDefaults = () => {
    setTheme('dark');
    setColorScheme('blue');
    
    const defaultColors = {
      primary: '220 60% 50%',
      secondary: '220 40% 80%',
      accent: '220 40% 70%',
      background: '220 60% 15%'
    };
    
    setTempCustomColors(defaultColors);
    updateAllCustomColors(defaultColors);
    
    toast({
      title: "Tema Resetado",
      description: "O tema foi resetado para as configurações padrão.",
    });
  };

  return (
    <div className="p-6 space-y-6 max-w-4xl mx-auto">
      <PageActions>
        <div className="flex gap-2">
          <Dialog open={isPreviewOpen} onOpenChange={setIsPreviewOpen}>
            <DialogTrigger asChild>
              <Button variant="outline">
                <Eye className="h-4 w-4 mr-2" />
                Visualizar
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-2xl">
              <DialogHeader>
                <DialogTitle>Prévia do Tema</DialogTitle>
              </DialogHeader>
              <div className="space-y-4">
                <Card>
                  <CardHeader>
                    <CardTitle>Exemplo de Card</CardTitle>
                    <CardDescription>
                      Esta é uma prévia de como o tema ficará aplicado
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="flex gap-2">
                      <Button>Botão Primário</Button>
                      <Button variant="secondary">Botão Secundário</Button>
                      <Button variant="outline">Botão Outline</Button>
                    </div>
                    <Separator />
                    <div className="space-y-2">
                      <Badge>Badge Padrão</Badge>
                      <Badge variant="secondary">Badge Secundário</Badge>
                      <Badge variant="outline">Badge Outline</Badge>
                    </div>
                  </CardContent>
                </Card>
              </div>
            </DialogContent>
          </Dialog>
          <Button onClick={handleSaveTheme}>
            <Save className="h-4 w-4 mr-2" />
            Salvar Tema
          </Button>
        </div>
      </PageActions>

      <Tabs defaultValue="appearance" className="space-y-6">
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="appearance">Aparência Geral</TabsTrigger>
          <TabsTrigger value="colors">Esquemas de Cores</TabsTrigger>
          <TabsTrigger value="custom">Cores Personalizadas</TabsTrigger>
        </TabsList>

        <TabsContent value="appearance" className="space-y-6">
          <AppearanceSettings />

          <Card>
            <CardHeader>
              <CardTitle>Modo de Tema</CardTitle>
              <CardDescription>
                Escolha entre tema claro ou escuro
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <Card 
                  className={`cursor-pointer transition-all ${
                    theme === 'light' ? 'ring-2 ring-primary' : ''
                  }`}
                  onClick={() => setTheme('light')}
                >
                  <CardContent className="p-4 text-center">
                    <Sun className="h-8 w-8 mx-auto mb-2" />
                    <p className="font-medium">Claro</p>
                    {theme === 'light' && <Check className="h-4 w-4 mx-auto mt-2 text-primary" />}
                  </CardContent>
                </Card>
                
                <Card 
                  className={`cursor-pointer transition-all ${
                    theme === 'dark' ? 'ring-2 ring-primary' : ''
                  }`}
                  onClick={() => setTheme('dark')}
                >
                  <CardContent className="p-4 text-center">
                    <Moon className="h-8 w-8 mx-auto mb-2" />
                    <p className="font-medium">Escuro</p>
                    {theme === 'dark' && <Check className="h-4 w-4 mx-auto mt-2 text-primary" />}
                  </CardContent>
                </Card>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Informações do Tema Atual</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label className="text-sm font-medium">Tema</Label>
                  <p className="text-lg capitalize">{theme}</p>
                </div>
                <div>
                  <Label className="text-sm font-medium">Esquema de Cores</Label>
                  <p className="text-lg">
                    {availableColorSchemes.find(s => s.id === colorScheme)?.name || 'Não encontrado'}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="colors" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Esquemas de Cores Predefinidos</CardTitle>
              <CardDescription>
                Escolha um dos esquemas de cores predefinidos
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {availableColorSchemes.filter(scheme => !scheme.isCustom).map((scheme) => (
                  <Card
                    key={scheme.id}
                    className={`cursor-pointer transition-all ${
                      colorScheme === scheme.id ? 'ring-2 ring-primary' : ''
                    }`}
                    onClick={() => setColorScheme(scheme.id)}
                  >
                    <CardContent className="p-4">
                      <div className="flex items-center gap-3 mb-3">
                        <div className="flex gap-1">
                          <div 
                            className="w-4 h-4 rounded-full border"
                            style={{ backgroundColor: `hsl(${scheme.primary})` }}
                          />
                          <div 
                            className="w-4 h-4 rounded-full border"
                            style={{ backgroundColor: `hsl(${scheme.secondary})` }}
                          />
                          <div 
                            className="w-4 h-4 rounded-full border"
                            style={{ backgroundColor: `hsl(${scheme.accent})` }}
                          />
                        </div>
                        {colorScheme === scheme.id && <Check className="h-4 w-4 text-primary ml-auto" />}
                      </div>
                      <h3 className="font-medium">{scheme.name}</h3>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="custom" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Cores Personalizadas</CardTitle>
              <CardDescription>
                Crie seu próprio esquema de cores usando valores HSL
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <ColorInput
                  label="Cor Primária"
                  value={tempCustomColors.primary}
                  onChange={(value) => handleCustomColorChange('primary', value)}
                  description="Cor principal do tema (botões, links, etc.)"
                />
                
                <ColorInput
                  label="Cor Secundária"
                  value={tempCustomColors.secondary}
                  onChange={(value) => handleCustomColorChange('secondary', value)}
                  description="Cor secundária para elementos de apoio"
                />
                
                <ColorInput
                  label="Cor de Destaque"
                  value={tempCustomColors.accent}
                  onChange={(value) => handleCustomColorChange('accent', value)}
                  description="Cor para elementos que precisam chamar atenção"
                />
                
                <ColorInput
                  label="Cor de Fundo"
                  value={tempCustomColors.background}
                  onChange={(value) => handleCustomColorChange('background', value)}
                  description="Cor de fundo principal da interface"
                />
              </div>

              <Separator />

              <div className="space-y-4">
                <h4 className="font-medium">Dicas para cores HSL:</h4>
                <ul className="text-sm text-muted-foreground space-y-1">
                  <li>• Use o formato: "matiz saturação% luminosidade%"</li>
                  <li>• Exemplo: "220 60% 50%" para um azul médio</li>
                  <li>• Matiz: 0-360 (vermelho=0, verde=120, azul=240)</li>
                  <li>• Saturação: 0-100% (0=cinza, 100=cor pura)</li>
                  <li>• Luminosidade: 0-100% (0=preto, 100=branco)</li>
                </ul>
              </div>

              <div className="flex gap-2">
                <Button onClick={applyCustomColors}>
                  <Palette className="h-4 w-4 mr-2" />
                  Aplicar Cores Personalizadas
                </Button>
                <Button 
                  variant="outline" 
                  onClick={resetToDefaults}
                >
                  <RotateCcw className="h-4 w-4 mr-2" />
                  Resetar para Padrão
                </Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
};