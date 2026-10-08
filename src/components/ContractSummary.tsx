import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { Calculator } from "lucide-react";

interface Product {
  id: string;
  name: string;
  description?: string;
  quantity: number;
  unitPrice: number;
  subtotal: number;
  image?: string;
}

interface ContractSummaryProps {
  products: Product[];
  subtotal: number;
  discount: number;
  discountRate: number;
  withDiscount: boolean;
  tax: number;
  total: number;
  taxRate: number;
  withTax: boolean;
}

export function ContractSummary({
  products,
  subtotal,
  discount,
  discountRate,
  withDiscount,
  tax,
  total,
  taxRate,
  withTax
}: ContractSummaryProps) {
  return (
    <Card className="shadow-card border-border/60">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-professional">
          <Calculator className="w-5 h-5" />
          Resumo Financeiro do Contrato
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Financial Summary */}
        <div className="space-y-3">
          <div className="flex justify-between text-sm">
            <span className="text-muted-foreground">Subtotal dos Serviços:</span>
            <span className="font-medium">R$ {subtotal.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
          </div>
          
          {withDiscount && (
            <div className="flex justify-between text-sm text-destructive">
              <span>Desconto ({discountRate}%):</span>
              <span>- R$ {discount.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
            </div>
          )}
          
          {withTax && (
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Impostos ({taxRate}%):</span>
              <span className="font-medium">R$ {tax.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
            </div>
          )}
          
          <Separator className="bg-border/60" />
          
          <div className="flex justify-between text-lg font-bold text-professional">
            <span>Total do Contrato:</span>
            <span>R$ {total.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
          </div>
        </div>

        {/* Important Note */}
        <div className="bg-primary/10 border border-primary/20 rounded-md p-3">
          <p className="text-xs text-primary/80 font-medium">
            ⚠️ IMPORTANTE: Este valor representa o total dos serviços de decoração conforme especificado neste contrato. 
            Qualquer alteração no escopo dos serviços resultará em aditivo contratual.
          </p>
        </div>
      </CardContent>
    </Card>
  );
}