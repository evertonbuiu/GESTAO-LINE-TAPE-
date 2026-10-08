import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { ContractTerms as ContractTermsType } from "@/types/contract";
import { FileText, CreditCard, Truck, XCircle, Shield, Plus } from "lucide-react";
import { numberToWords } from "@/utils/numberToWords";

interface ContractTermsProps {
  terms: ContractTermsType;
  onTermsUpdate: (field: keyof ContractTermsType, value: string) => void;
  totalValue?: number;
  eventDate?: string;
  initialSetupDate?: string;
  eventLocation?: string;
}

export function ContractTerms({ terms, onTermsUpdate, totalValue = 0, eventDate = '', initialSetupDate = '', eventLocation = '' }: ContractTermsProps) {
  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL'
    }).format(value);
  };

  const formatDate = (dateString: string) => {
    if (!dateString) return '';
    const date = new Date(dateString + 'T00:00:00');
    return date.toLocaleDateString('pt-BR');
  };

  const halfValue = totalValue / 2;
  const downPayment = formatCurrency(halfValue);
  const remainingPayment = formatCurrency(halfValue);
  const totalFormatted = formatCurrency(totalValue);
  
  // Valores por extenso
  const totalInWords = numberToWords(totalValue);
  const downPaymentInWords = numberToWords(halfValue);
  const remainingPaymentInWords = numberToWords(halfValue);
  
  // Data um dia antes do evento
  const dayBeforeEvent = eventDate ? (() => {
    const date = new Date(eventDate + 'T00:00:00');
    date.setDate(date.getDate() - 1);
    return date.toLocaleDateString('pt-BR');
  })() : '';

  const generatedPaymentTerms = totalValue > 0 
    ? `Valor Total do Contrato: ${totalFormatted} (${totalInWords})

Forma de Pagamento:
- Entrada (50%): ${downPayment} (${downPaymentInWords}) - A ser pago na assinatura do contrato
- Restante (50%): ${remainingPayment} (${remainingPaymentInWords}) - A ser pago até ${dayBeforeEvent || 'um dia antes do evento'}

Formas de pagamento aceitas: PIX, Transferência Bancária ou Dinheiro.
Os dados bancários para pagamento constam neste contrato.`
    : '';

  // Use user's edited version if it exists, otherwise use generated text
  const defaultPaymentTerms = terms.paymentTerms !== undefined && terms.paymentTerms !== '' 
    ? terms.paymentTerms 
    : generatedPaymentTerms;

  const generatedDeliveryTerms = initialSetupDate || eventLocation
    ? `A montagem começará na data ${formatDate(initialSetupDate) || '[DATA INICIAL DE MONTAGEM]'} no local ${eventLocation || '[LOCAL DO EVENTO]'}. A entrega dos equipamentos montados terá o prazo de até 1 hora antes do evento. Cada item do orçamento tem um prazo de 5 horas de montagem após a forração entregar o espaço para montar. Desmontagem será realizada no dia seguinte ao evento. É necessário acesso livre ao local para montagem e desmontagem.`
    : '';

  const defaultDeliveryTerms = terms.deliveryTerms !== undefined && terms.deliveryTerms !== ''
    ? terms.deliveryTerms
    : generatedDeliveryTerms;

  const termItems = [
    {
      key: 'paymentTerms' as keyof ContractTermsType,
      title: 'Condições de Pagamento',
      icon: CreditCard,
      placeholder: defaultPaymentTerms,
      value: defaultPaymentTerms
    },
    {
      key: 'deliveryTerms' as keyof ContractTermsType,
      title: 'Condições de Entrega',
      icon: Truck,
      placeholder: defaultDeliveryTerms,
      value: defaultDeliveryTerms
    },
    {
      key: 'cancellationPolicy' as keyof ContractTermsType,
      title: 'Política de Cancelamento',
      icon: XCircle,
      placeholder: 'Ex: Cancelamento até 30 dias: reembolso de 70%, até 15 dias: 40%, até 7 dias: 20%. Equipamentos já entregues não reembolsáveis...',
      value: terms.cancellationPolicy
    },
    {
      key: 'warrantyTerms' as keyof ContractTermsType,
      title: 'Garantias e Responsabilidades',
      icon: Shield,
      placeholder: 'Ex: Garantia de funcionamento durante todo o evento, técnico de plantão, seguro dos equipamentos, não responsabilidade por falta de energia...',
      value: terms.warrantyTerms
    },
    {
      key: 'additionalTerms' as keyof ContractTermsType,
      title: 'Termos Adicionais',
      icon: Plus,
      placeholder: 'Ex: Alterações técnicas dependem de viabilidade, equipamentos sujeitos à disponibilidade, foro da comarca local, força maior...',
      value: terms.additionalTerms
    }
  ];

  return (
    <Card className="shadow-card border-border/60">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-professional">
          <FileText className="w-5 h-5" />
          Termos e Condições do Contrato
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        {termItems.map((item) => (
          <div key={item.key} className="space-y-2">
            <Label 
              htmlFor={item.key} 
              className="flex items-center gap-2 text-sm font-medium text-professional"
            >
              <item.icon className="w-4 h-4" />
              {item.title}
            </Label>
            <Textarea
              id={item.key}
              value={item.value}
              onChange={(e) => onTermsUpdate(item.key, e.target.value)}
              placeholder={item.placeholder}
              rows={3}
              className="min-h-[80px] resize-none border-border/60 focus:border-primary"
            />
          </div>
        ))}
      </CardContent>
    </Card>
  );
}