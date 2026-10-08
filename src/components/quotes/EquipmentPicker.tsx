import { useEffect, useMemo, useState } from 'react';
import { AlertTriangle, ImageOff, Minus, Package, Pencil, Plus, Search, Trash2 } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { makeItemId, normalizeText, roundMoney, type QuoteItem } from '@/lib/quotes';
import { resolveProductImageDisplayUrl } from '@/lib/storageUrls';

interface EquipmentRow {
  id: string;
  name: string;
  category: string;
  available: number;
  total_stock: number;
  price_per_day: number;
  image_url?: string;
  description?: string;
}

interface EquipmentPickerProps {
  items: QuoteItem[];
  onChange: (items: QuoteItem[]) => void;
  onEditItem?: (item: QuoteItem, index: number) => void;
  canViewValues?: boolean;
}

function ItemThumbnail({ src, alt, size = 'sm' }: { src?: string; alt: string; size?: 'sm' | 'md' }) {
  const [failed, setFailed] = useState(false);
  const dimensions = size === 'md' ? 'h-20 w-20' : 'h-14 w-14';
  const displaySrc = resolveProductImageDisplayUrl(src);

  useEffect(() => {
    setFailed(false);
  }, [displaySrc]);

  if (!displaySrc || failed) {
    return (
      <div
        className={`${dimensions} flex shrink-0 flex-col items-center justify-center rounded-md border bg-muted text-[9px] text-muted-foreground`}
        role="img"
        aria-label={`Sem imagem para ${alt}`}
      >
        <ImageOff className="mb-1 h-4 w-4" aria-hidden="true" />
        <span>Sem foto</span>
      </div>
    );
  }

  return (
    <div className={`${dimensions} shrink-0 overflow-hidden rounded-md border bg-muted`}>
      <img
        src={displaySrc}
        alt={alt}
        loading="lazy"
        referrerPolicy="no-referrer"
        className="h-full w-full object-cover"
        onError={() => setFailed(true)}
      />
    </div>
  );
}

export function EquipmentPicker({ items, onChange, onEditItem, canViewValues = true }: EquipmentPickerProps) {
  const [equipment, setEquipment] = useState<EquipmentRow[]>([]);
  const [search, setSearch] = useState('');
  const [category, setCategory] = useState('all');

  useEffect(() => {
    let active = true;
    supabase
      .from('equipment')
      .select('id, name, category, available, total_stock, price_per_day, image_url, description')
      .order('name')
      .then(({ data }) => {
        if (active) setEquipment((data as EquipmentRow[]) || []);
      });
    return () => {
      active = false;
    };
  }, []);

  const categories = useMemo(
    () => Array.from(new Set(equipment.map((item) => item.category).filter(Boolean))).sort(),
    [equipment],
  );

  const results = useMemo(() => {
    const needle = normalizeText(search);
    return equipment
      .filter((item) => (category === 'all' ? true : item.category === category))
      .filter((item) =>
        !needle ? true : normalizeText(item.name).includes(needle) || normalizeText(item.category).includes(needle),
      )
      .slice(0, 40);
  }, [equipment, search, category]);

  const availabilityFor = (name: string) => equipment.find((row) => row.name === name)?.available ?? null;

  const updateItem = (id: string, patch: Partial<QuoteItem>) => {
    onChange(
      items.map((item) => {
        if (item.id !== id) return item;
        const next = { ...item, ...patch };
        const quantity = Math.max(1, Number(next.quantity) || 1);
        const unitPrice = Math.max(0, Number(next.unit_price) || 0);
        return { ...next, quantity, unit_price: unitPrice, total_price: roundMoney(quantity * unitPrice) };
      }),
    );
  };

  const addEquipment = (row: EquipmentRow) => {
    const existing = items.find((item) => item.name === row.name);
    if (existing) {
      updateItem(existing.id, { quantity: existing.quantity + 1 });
      return;
    }
    const unitPrice = Number(row.price_per_day) || 0;
    onChange([
      ...items,
      {
        id: makeItemId(),
        name: row.name,
        description: row.description || '',
        category: row.category,
        image_url: row.image_url,
        quantity: 1,
        unit_price: unitPrice,
        total_price: roundMoney(unitPrice),
      },
    ]);
  };

  const addCustomItem = () => {
    const id = makeItemId();
    onChange([
      ...items,
      {
        id,
        name: '',
        description: '',
        quantity: 1,
        unit_price: 0,
        total_price: 0,
      },
    ]);
  };

  return (
    <div className="space-y-4">
      <div className="grid gap-3 sm:grid-cols-[1fr_200px]">
        <div>
          <Label htmlFor="equipment-search">Buscar equipamento</Label>
          <div className="relative mt-1">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" aria-hidden="true" />
            <Input
              id="equipment-search"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Nome ou categoria"
              className="pl-9"
            />
          </div>
        </div>
        <div>
          <Label htmlFor="equipment-category">Categoria</Label>
          <Select value={category} onValueChange={setCategory}>
            <SelectTrigger id="equipment-category" className="mt-1">
              <SelectValue placeholder="Todas" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todas as categorias</SelectItem>
              {categories.map((item) => (
                <SelectItem key={item} value={item}>
                  {item}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="max-h-56 overflow-auto rounded-md border border-border">
        {results.length === 0 ? (
          <p className="p-4 text-sm text-muted-foreground">Nenhum equipamento encontrado.</p>
        ) : (
          <ul className="divide-y divide-border">
            {results.map((row) => (
              <li key={row.id} className="flex items-center gap-3 px-3 py-2">
                <ItemThumbnail src={row.image_url} alt={row.name} />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium">{row.name}</p>
                  <p className="truncate text-xs text-muted-foreground">
                    {row.category} â€¢ DisponÃ­vel: {row.available}/{row.total_stock}
                    {canViewValues
                      ? ` â€¢ ${Number(row.price_per_day || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}`
                      : ''}
                  </p>
                </div>
                <Button type="button" size="sm" variant="secondary" className="shrink-0" onClick={() => addEquipment(row)}>
                  <Plus className="mr-1 h-4 w-4" aria-hidden="true" />
                  Adicionar
                </Button>
              </li>
            ))}
          </ul>
        )}
      </div>

      <div className="flex items-center justify-between">
        <h4 className="flex items-center gap-2 text-sm font-semibold">
          <Package className="h-4 w-4" aria-hidden="true" />
          Itens do orÃ§amento ({items.length})
        </h4>
        <Button type="button" size="sm" variant="outline" onClick={addCustomItem}>
          <Plus className="mr-1 h-4 w-4" aria-hidden="true" />
          Item avulso
        </Button>
      </div>

      {items.length === 0 ? (
        <p className="rounded-md border border-dashed border-border p-6 text-center text-sm text-muted-foreground">
          Nenhum item adicionado ainda. Busque um equipamento acima ou crie um item avulso.
        </p>
      ) : (
        <div className="space-y-3">
          {items.map((item, index) => {
            const available = availabilityFor(item.name);
            const conflict = available !== null && item.quantity > available;

            return (
              <Card key={item.id} className="border-border/70">
                <CardContent className="space-y-3 p-3">
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
                    <ItemThumbnail src={item.image_url} alt={item.name || `Item ${index + 1}`} size="md" />
                    <div className="grid min-w-0 flex-1 gap-3 sm:grid-cols-[minmax(180px,1fr)_180px_140px_auto] sm:items-end">
                    <div>
                      <Label htmlFor={`item-name-${item.id}`} className="text-xs">
                        Item {index + 1}
                      </Label>
                      <Input
                        id={`item-name-${item.id}`}
                        value={item.name}
                        onChange={(event) => updateItem(item.id, { name: event.target.value })}
                        placeholder="Nome do item"
                      />
                    </div>
                    <div>
                      <Label htmlFor={`item-qty-${item.id}`} className="text-xs">
                        Quantidade
                      </Label>
                      <div className="flex items-center gap-1">
                        <Button
                          type="button"
                          variant="outline"
                          size="icon"
                          className="min-h-11 min-w-11 shrink-0"
                          aria-label={`Diminuir quantidade de ${item.name || `item ${index + 1}`}`}
                          onClick={() => updateItem(item.id, { quantity: Math.max(1, item.quantity - 1) })}
                        >
                          <Minus className="h-4 w-4" aria-hidden="true" />
                        </Button>
                        <Input
                          id={`item-qty-${item.id}`}
                          type="number"
                          min={1}
                          value={item.quantity}
                          onChange={(event) => updateItem(item.id, { quantity: parseInt(event.target.value, 10) || 1 })}
                          className="min-w-16 flex-1 text-center tabular-nums"
                        />
                        <Button
                          type="button"
                          variant="outline"
                          size="icon"
                          className="min-h-11 min-w-11 shrink-0"
                          aria-label={`Aumentar quantidade de ${item.name || `item ${index + 1}`}`}
                          onClick={() => updateItem(item.id, { quantity: item.quantity + 1 })}
                        >
                          <Plus className="h-4 w-4" aria-hidden="true" />
                        </Button>
                      </div>
                    </div>
                    <div>
                      <Label htmlFor={`item-price-${item.id}`} className="text-xs">
                        PreÃ§o unitÃ¡rio
                      </Label>
                      <Input
                        id={`item-price-${item.id}`}
                        type="number"
                        min={0}
                        step="0.01"
                        value={item.unit_price}
                        onChange={(event) => updateItem(item.id, { unit_price: parseFloat(event.target.value) || 0 })}
                        disabled={!canViewValues}
                      />
                    </div>
                    <div className="flex items-center gap-1">
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        className="min-h-11 shrink-0"
                        aria-label={`Editar ${item.name || `item ${index + 1}`}`}
                        onClick={() => onEditItem?.(item, index)}
                      >
                        <Pencil className="mr-1 h-4 w-4" aria-hidden="true" />
                        Editar
                      </Button>
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="min-h-11 min-w-11 text-destructive"
                        aria-label={`Remover ${item.name || `item ${index + 1}`}`}
                        onClick={() => onChange(items.filter((row) => row.id !== item.id))}
                      >
                        <Trash2 className="h-4 w-4" aria-hidden="true" />
                      </Button>
                    </div>
                    </div>
                  </div>

                  <div className="flex flex-wrap items-center justify-between gap-2">
                    {item.description && (
                      <p className="w-full text-sm text-muted-foreground">{item.description}</p>
                    )}
                    {conflict ? (
                      <Badge variant="outline" className="border-amber-500/40 text-amber-600 dark:text-amber-400">
                        <AlertTriangle className="mr-1 h-3.5 w-3.5" aria-hidden="true" />
                        Quantidade acima do disponÃ­vel ({available})
                      </Badge>
                    ) : (
                      <span className="text-xs text-muted-foreground">
                        {available !== null ? `DisponÃ­vel em estoque: ${available}` : 'Item avulso'}
                      </span>
                    )}
                    {canViewValues && (
                      <span className="text-sm font-semibold">
                        {roundMoney(item.quantity * item.unit_price).toLocaleString('pt-BR', {
                          style: 'currency',
                          currency: 'BRL',
                        })}
                      </span>
                    )}
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}

export default EquipmentPicker;

