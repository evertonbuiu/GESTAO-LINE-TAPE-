import { Search } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import type { QuoteSort } from '@/lib/quotes';

interface QuotesToolbarProps {
  search: string;
  onSearchChange: (value: string) => void;
  status: string;
  onStatusChange: (value: string) => void;
  month: string;
  onMonthChange: (value: string) => void;
  year: string;
  onYearChange: (value: string) => void;
  sort: QuoteSort;
  onSortChange: (value: QuoteSort) => void;
  years: number[];
}

const MONTHS = [
  { value: '01', label: 'Janeiro' },
  { value: '02', label: 'Fevereiro' },
  { value: '03', label: 'Março' },
  { value: '04', label: 'Abril' },
  { value: '05', label: 'Maio' },
  { value: '06', label: 'Junho' },
  { value: '07', label: 'Julho' },
  { value: '08', label: 'Agosto' },
  { value: '09', label: 'Setembro' },
  { value: '10', label: 'Outubro' },
  { value: '11', label: 'Novembro' },
  { value: '12', label: 'Dezembro' },
];

export function QuotesToolbar({
  search,
  onSearchChange,
  status,
  onStatusChange,
  month,
  onMonthChange,
  year,
  onYearChange,
  sort,
  onSortChange,
  years,
}: QuotesToolbarProps) {
  return (
    <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-5">
      <div className="md:col-span-2 xl:col-span-2">
        <Label htmlFor="quotes-search">Buscar</Label>
        <div className="relative mt-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" aria-hidden="true" />
          <Input
            id="quotes-search"
            value={search}
            onChange={(event) => onSearchChange(event.target.value)}
            placeholder="Número, cliente, evento, telefone ou local"
            className="pl-9"
          />
        </div>
      </div>

      <div>
        <Label htmlFor="quotes-status">Status</Label>
        <Select value={status} onValueChange={onStatusChange}>
          <SelectTrigger id="quotes-status" className="mt-1">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos</SelectItem>
            <SelectItem value="draft">Rascunho</SelectItem>
            <SelectItem value="sent">Enviado</SelectItem>
            <SelectItem value="approved">Aprovado</SelectItem>
            <SelectItem value="rejected">Rejeitado</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div className="grid grid-cols-2 gap-2">
        <div>
          <Label htmlFor="quotes-month">Mês</Label>
          <Select value={month} onValueChange={onMonthChange}>
            <SelectTrigger id="quotes-month" className="mt-1">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos</SelectItem>
              {MONTHS.map((item) => (
                <SelectItem key={item.value} value={item.value}>
                  {item.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div>
          <Label htmlFor="quotes-year">Ano</Label>
          <Select value={year} onValueChange={onYearChange}>
            <SelectTrigger id="quotes-year" className="mt-1">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos</SelectItem>
              {years.map((item) => (
                <SelectItem key={item} value={String(item)}>
                  {item}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      <div>
        <Label htmlFor="quotes-sort">Ordenar por</Label>
        <Select value={sort} onValueChange={(value) => onSortChange(value as QuoteSort)}>
          <SelectTrigger id="quotes-sort" className="mt-1">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="created_desc">Mais recentes</SelectItem>
            <SelectItem value="event_date_asc">Data do evento (crescente)</SelectItem>
            <SelectItem value="event_date_desc">Data do evento (decrescente)</SelectItem>
            <SelectItem value="total_desc">Maior valor</SelectItem>
            <SelectItem value="client_asc">Cliente (A-Z)</SelectItem>
          </SelectContent>
        </Select>
      </div>
    </div>
  );
}

export default QuotesToolbar;
