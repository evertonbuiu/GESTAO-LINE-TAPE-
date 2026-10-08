import {
  CalendarDays,
  Copy,
  Eye,
  FileText,
  MapPin,
  MessageCircle,
  MoreVertical,
  Pencil,
  Sparkles,
  Trash2,
  User,
} from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { getQuoteStatusClasses, getQuoteStatusLabel } from '@/lib/quotes';

export interface QuoteCardData {
  id: string;
  quote_number?: string;
  client_name?: string;
  client_phone?: string;
  event_name?: string;
  event_date?: string;
  event_location?: string;
  total_amount?: number;
  status?: string;
  event_id?: string | null;
}

interface QuoteCardProps {
  quote: QuoteCardData;
  canViewValues: boolean;
  onView: (quote: QuoteCardData) => void;
  onEdit: (quote: QuoteCardData) => void;
  onPdf: (quote: QuoteCardData) => void;
  onDuplicate: (quote: QuoteCardData) => void;
  onWhatsApp: (quote: QuoteCardData) => void;
  onCreateEvent: (quote: QuoteCardData) => void;
  onDelete: (quote: QuoteCardData) => void;
  onStatusChange: (quote: QuoteCardData, status: string) => void;
}

function formatDate(value?: string) {
  const dateOnly = (value || '').split('T')[0];
  const [y, m, d] = dateOnly.split('-');
  return y && m && d ? `${d}/${m}/${y}` : 'Sem data';
}

export function QuoteCard({
  quote,
  canViewValues,
  onView,
  onEdit,
  onPdf,
  onDuplicate,
  onWhatsApp,
  onCreateEvent,
  onDelete,
  onStatusChange,
}: QuoteCardProps) {
  return (
    <Card className="border-border/70">
      <CardContent className="space-y-3 p-4">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <p className="text-sm font-semibold">
              {quote.quote_number || 'Sem número'} — {quote.event_name || 'Evento sem nome'}
            </p>
            <p className="flex items-center gap-1 truncate text-xs text-muted-foreground">
              <User className="h-3.5 w-3.5" aria-hidden="true" />
              {quote.client_name || 'Cliente não informado'}
            </p>
          </div>
          <Badge variant="outline" className={getQuoteStatusClasses(quote.status)}>
            {getQuoteStatusLabel(quote.status)}
          </Badge>
        </div>

        <div className="grid gap-1 text-xs text-muted-foreground">
          <p className="flex items-center gap-1">
            <CalendarDays className="h-3.5 w-3.5" aria-hidden="true" />
            {formatDate(quote.event_date)}
          </p>
          {quote.event_location && (
            <p className="flex items-center gap-1 truncate">
              <MapPin className="h-3.5 w-3.5" aria-hidden="true" />
              {quote.event_location}
            </p>
          )}
        </div>

        <div className="flex items-center justify-between gap-2">
          <span className="text-base font-bold text-primary">
            {canViewValues
              ? (quote.total_amount || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
              : '---'}
          </span>

          <div className="flex items-center gap-1">
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="min-h-11"
              onClick={() => onView(quote)}
            >
              <Eye className="mr-1 h-4 w-4" aria-hidden="true" />
              Ver
            </Button>

            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="min-h-11 min-w-11"
                  aria-label={`Mais ações do orçamento ${quote.quote_number || ''}`}
                >
                  <MoreVertical className="h-4 w-4" aria-hidden="true" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-56 bg-popover">
                <DropdownMenuItem onClick={() => onEdit(quote)}>
                  <Pencil className="mr-2 h-4 w-4" aria-hidden="true" />
                  Editar
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => onPdf(quote)}>
                  <FileText className="mr-2 h-4 w-4" aria-hidden="true" />
                  Gerar PDF
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => onDuplicate(quote)}>
                  <Copy className="mr-2 h-4 w-4" aria-hidden="true" />
                  Duplicar
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => onWhatsApp(quote)}>
                  <MessageCircle className="mr-2 h-4 w-4" aria-hidden="true" />
                  Enviar pelo WhatsApp
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => onCreateEvent(quote)} disabled={Boolean(quote.event_id)}>
                  <Sparkles className="mr-2 h-4 w-4" aria-hidden="true" />
                  {quote.event_id ? 'Evento já criado' : 'Criar evento'}
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={() => onStatusChange(quote, 'sent')}>Marcar como enviado</DropdownMenuItem>
                <DropdownMenuItem onClick={() => onStatusChange(quote, 'approved')}>Marcar como aprovado</DropdownMenuItem>
                <DropdownMenuItem onClick={() => onStatusChange(quote, 'rejected')}>Marcar como rejeitado</DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem className="text-destructive focus:text-destructive" onClick={() => onDelete(quote)}>
                  <Trash2 className="mr-2 h-4 w-4" aria-hidden="true" />
                  Excluir
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

export default QuoteCard;
