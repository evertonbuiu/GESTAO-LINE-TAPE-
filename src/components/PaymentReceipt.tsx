import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Download, Printer } from "lucide-react";
import { toast } from "sonner";
import jsPDF from "jspdf";
import { useLogo } from "@/hooks/useLogo";
import logoImage from "@/assets/logo.png";
import SignaturePad from "@/components/ui/SignaturePad";
import { Building2 } from "lucide-react";

interface PaymentReceiptProps {
  quoteData: {
    quote_number: string;
    client_name: string;
    client_document?: string;
    client_address?: string;
    client_email?: string;
    client_phone?: string;
    total_amount: number;
    quote_date?: string;
    service_description?: string;
  };
  companyData?: {
    name: string;
    document?: string;
    address?: string;
    phone?: string;
    email?: string;
  };
}

export const PaymentReceipt = ({ quoteData, companyData }: PaymentReceiptProps) => {
  const defaultCompany = {
    name: "LINE TAPE ILUMINAÇÃO E LOCAÇÃO LTDA",
    document: "",
    address: "RUA LUIZ HONORIO QD-36 LT-08 CIDADE JARDIM GOIANIA GOIAS",
    phone: "(62) 98343-6154",
    email: "linetapegyn@gmail.com",
  };

  const company = companyData || defaultCompany;
  const { logoUrl } = useLogo();

  const loadImageAsDataUrl = (url: string): Promise<string> =>
    new Promise((resolve, reject) => {
      const img = new Image();
      img.crossOrigin = "anonymous";
      img.onload = () => {
        const canvas = document.createElement("canvas");
        canvas.width = img.naturalWidth;
        canvas.height = img.naturalHeight;
        const ctx = canvas.getContext("2d");
        if (!ctx) return reject(new Error("ctx"));
        ctx.drawImage(img, 0, 0);
        resolve(canvas.toDataURL("image/png"));
      };
      img.onerror = reject;
      img.src = url;
    });

  const [receiptData, setReceiptData] = useState({
    receiptNumber: `REC-${quoteData.quote_number}`,
    paymentDate: new Date().toISOString().split('T')[0],
    amount: quoteData.total_amount,
    paymentMethod: 'dinheiro' as 'dinheiro' | 'pix' | 'transferencia' | 'cheque' | 'cartao',
    description: quoteData.service_description || 'Prestação de serviços conforme orçamento',
    observations: '',
  });

  const [companySignature, setCompanySignature] = useState<string | undefined>(undefined);


  // Função para converter número em extenso
  const numberToWords = (num: number): string => {
    if (num === 0) return "zero reais";
    
    const unidades = ["", "um", "dois", "três", "quatro", "cinco", "seis", "sete", "oito", "nove"];
    const dezenasAte19 = ["dez", "onze", "doze", "treze", "quatorze", "quinze", "dezesseis", "dezessete", "dezoito", "dezenove"];
    const dezenas = ["", "", "vinte", "trinta", "quarenta", "cinquenta", "sessenta", "setenta", "oitenta", "noventa"];
    const centenas = ["", "cento", "duzentos", "trezentos", "quatrocentos", "quinhentos", "seiscentos", "setecentos", "oitocentos", "novecentos"];

    let integerPart = Math.floor(num);
    const decimalPart = Math.round((num - integerPart) * 100);

    const convertGroup = (n: number): string => {
      if (n === 0) return "";
      if (n === 100) return "cem";
      
      let result = "";
      const c = Math.floor(n / 100);
      const d = Math.floor((n % 100) / 10);
      const u = n % 10;

      if (c > 0) result += centenas[c];
      if (d === 1) {
        if (result) result += " e ";
        result += dezenasAte19[u];
        return result;
      }
      if (d > 0) {
        if (result) result += " e ";
        result += dezenas[d];
      }
      if (u > 0) {
        if (result) result += " e ";
        result += unidades[u];
      }
      return result;
    };

    let words = "";
    
    if (integerPart >= 1000000) {
      const millions = Math.floor(integerPart / 1000000);
      words += convertGroup(millions) + (millions === 1 ? " milhão" : " milhões");
      integerPart %= 1000000;
      if (integerPart > 0) words += " e ";
    }
    
    if (integerPart >= 1000) {
      const thousands = Math.floor(integerPart / 1000);
      words += convertGroup(thousands) + " mil";
      integerPart %= 1000;
      if (integerPart > 0) words += " e ";
    }
    
    if (integerPart > 0) {
      words += convertGroup(integerPart);
    }
    
    words += integerPart === 1 ? " real" : " reais";

    if (decimalPart > 0) {
      words += " e " + convertGroup(decimalPart);
      words += decimalPart === 1 ? " centavo" : " centavos";
    }

    return words;
  };

  const getPaymentMethodLabel = (method: string) => {
    const methods: Record<string, string> = {
      dinheiro: "Dinheiro",
      pix: "PIX",
      transferencia: "Transferência Bancária",
      cheque: "Cheque",
      cartao: "Cartão de Crédito/Débito",
    };
    return methods[method] || method;
  };

  const generateReceiptPDF = async () => {
    const pdf = new jsPDF();
    const pageWidth = pdf.internal.pageSize.width;
    const pageHeight = pdf.internal.pageSize.height;
    const margin = 20;
    const contentBottom = pageHeight - 20;

    const moveToNextPageWhenNeeded = (currentY: number, requiredHeight: number) => {
      if (currentY + requiredHeight <= contentBottom) return currentY;

      pdf.addPage();
      return margin;
    };

    // Marca d'água com a logo da empresa
    try {
      const logoSrc = logoUrl || logoImage;
      const dataUrl = await loadImageAsDataUrl(logoSrc);
      const anyPdf = pdf as any;
      if (anyPdf.GState) {
        anyPdf.setGState(new anyPdf.GState({ opacity: 0.08 }));
      }
      const wmWidth = pageWidth - 40;
      const wmHeight = wmWidth;
      const wmX = (pageWidth - wmWidth) / 2;
      const wmY = (pageHeight - wmHeight) / 2;
      pdf.addImage(dataUrl, "PNG", wmX, wmY, wmWidth, wmHeight, undefined, "FAST");
      if (anyPdf.GState) {
        anyPdf.setGState(new anyPdf.GState({ opacity: 1 }));
      }
    } catch (e) {
      console.warn("Não foi possível carregar a logo para marca d'água", e);
    }

    let y = 20;

    // Título
    pdf.setFontSize(18);
    pdf.setFont(undefined, 'bold');
    pdf.text("RECIBO DE PAGAMENTO", pageWidth / 2, y, { align: 'center' });
    y += 15;

    // Número do recibo
    pdf.setFontSize(12);
    pdf.setFont(undefined, 'normal');
    pdf.text(`Recibo Nº: ${receiptData.receiptNumber}`, margin, y);
    y += 10;
    pdf.text(`Data: ${new Date(receiptData.paymentDate).toLocaleDateString('pt-BR')}`, margin, y);
    y += 15;

    // Valor em destaque
    pdf.setFontSize(14);
    pdf.setFont(undefined, 'bold');
    pdf.text(`Valor: R$ ${receiptData.amount.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`, margin, y);
    y += 10;

    // Valor por extenso
    pdf.setFontSize(10);
    pdf.setFont(undefined, 'italic');
    const extenso = `(${numberToWords(receiptData.amount)})`;
    const extensoLines = pdf.splitTextToSize(extenso, pageWidth - (margin * 2));
    pdf.text(extensoLines, margin, y);
    y += 5 * extensoLines.length + 10;

    // Linha separadora
    pdf.setDrawColor(200);
    pdf.line(margin, y, pageWidth - margin, y);
    y += 10;

    // Dados do recebedor (empresa)
    pdf.setFontSize(11);
    pdf.setFont(undefined, 'bold');
    pdf.text("RECEBEDOR:", margin, y);
    y += 8;
    
    pdf.setFont(undefined, 'normal');
    pdf.text(`Nome/Razão Social: ${company.name}`, margin, y);
    y += 6;
    
    if (company.document) {
      pdf.text(`CNPJ/CPF: ${company.document}`, margin, y);
      y += 6;
    }
    
    if (company.address) {
      const addressLines = pdf.splitTextToSize(`Endereço: ${company.address}`, pageWidth - (margin * 2));
      pdf.text(addressLines, margin, y);
      y += 6 * addressLines.length;
    }
    
    if (company.phone) {
      pdf.text(`Telefone: ${company.phone}`, margin, y);
      y += 6;
    }
    
    if (company.email) {
      pdf.text(`Email: ${company.email}`, margin, y);
      y += 10;
    }

    // Linha separadora
    pdf.setDrawColor(200);
    pdf.line(margin, y, pageWidth - margin, y);
    y += 10;

    // Dados do pagador (cliente)
    pdf.setFont(undefined, 'bold');
    pdf.text("PAGADOR:", margin, y);
    y += 8;
    
    pdf.setFont(undefined, 'normal');
    pdf.text(`Nome: ${quoteData.client_name}`, margin, y);
    y += 6;
    
    if (quoteData.client_document) {
      pdf.text(`CPF/CNPJ: ${quoteData.client_document}`, margin, y);
      y += 6;
    }
    
    if (quoteData.client_address) {
      const addressLines = pdf.splitTextToSize(`Endereço: ${quoteData.client_address}`, pageWidth - (margin * 2));
      pdf.text(addressLines, margin, y);
      y += 6 * addressLines.length;
    }
    
    if (quoteData.client_phone) {
      pdf.text(`Telefone: ${quoteData.client_phone}`, margin, y);
      y += 6;
    }
    
    if (quoteData.client_email) {
      pdf.text(`Email: ${quoteData.client_email}`, margin, y);
      y += 10;
    }

    // Linha separadora
    pdf.setDrawColor(200);
    pdf.line(margin, y, pageWidth - margin, y);
    y += 10;

    // Referente a
    pdf.setFont(undefined, 'bold');
    pdf.text("REFERENTE A:", margin, y);
    y += 8;
    
    pdf.setFont(undefined, 'normal');
    pdf.text(`Orçamento: ${quoteData.quote_number}`, margin, y);
    y += 6;
    
    const descLines = pdf.splitTextToSize(receiptData.description, pageWidth - (margin * 2));
    pdf.text(descLines, margin, y);
    y += 6 * descLines.length + 5;

    // Forma de pagamento
    pdf.text(`Forma de Pagamento: ${getPaymentMethodLabel(receiptData.paymentMethod)}`, margin, y);
    y += 10;

    // Observações
    if (receiptData.observations) {
      pdf.setFont(undefined, 'bold');
      pdf.text("Observações:", margin, y);
      y += 8;
      
      pdf.setFont(undefined, 'normal');
      const obsLines = pdf.splitTextToSize(receiptData.observations, pageWidth - (margin * 2));
      pdf.text(obsLines, margin, y);
      y += 6 * obsLines.length + 10;
    }

    // Declaração legal e assinatura devem permanecer juntas e dentro da página.
    pdf.setFontSize(9);
    pdf.setFont(undefined, 'italic');
    const declaration = `Declaro para os devidos fins que recebi de ${quoteData.client_name} a quantia de R$ ${receiptData.amount.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} (${numberToWords(receiptData.amount)}), referente aos serviços prestados conforme descrito neste documento. Dou plena, geral e irrevogável quitação para nada mais reclamar a qualquer título, tempo ou forma.`;
    const declLines = pdf.splitTextToSize(declaration, pageWidth - (margin * 2));
    const signatureBlockHeight = companySignature ? 55 : 40;
    y = moveToNextPageWhenNeeded(y + 10, (6 * declLines.length) + signatureBlockHeight);
    pdf.text(declLines, margin, y);
    y += 6 * declLines.length + 20;

    // Assinatura
    const signatureWidth = 70;
    const signatureX = pageWidth / 2 - signatureWidth / 2;
    y += 15;

    if (companySignature) {
      try {
        // Normaliza PNG/JPEG e URLs para PNG antes de inserir no jsPDF.
        // Isso também aguarda o carregamento completo da imagem selecionada.
        const signatureDataUrl = await loadImageAsDataUrl(companySignature);
        pdf.addImage(signatureDataUrl, "PNG", signatureX, y - 20, signatureWidth, 20, undefined, "FAST");
      } catch (e) {
        console.warn("Erro ao inserir assinatura", e);
        toast.error("Não foi possível inserir a assinatura no PDF. Selecione-a novamente.");
      }
    }

    pdf.setDrawColor(0);
    pdf.line(signatureX, y, signatureX + signatureWidth, y);
    y += 5;

    pdf.setFontSize(9);
    pdf.setFont(undefined, 'normal');
    pdf.text("Assinatura do Recebedor", pageWidth / 2, y, { align: 'center' });
    y += 4;
    pdf.text(company.name, pageWidth / 2, y, { align: 'center' });

    // Rodapé
    pdf.setFontSize(8);
    pdf.setTextColor(150);
    pdf.text(
      `Documento emitido em ${new Date().toLocaleDateString('pt-BR')} às ${new Date().toLocaleTimeString('pt-BR')}`,
      pageWidth / 2,
      pdf.internal.pageSize.height - 10,
      { align: 'center' }
    );

    pdf.save(`recibo-${receiptData.receiptNumber}.pdf`);
    toast.success("Recibo gerado com sucesso!");
  };

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label htmlFor="receiptNumber">Número do Recibo</Label>
          <Input
            id="receiptNumber"
            value={receiptData.receiptNumber}
            onChange={(e) => setReceiptData({ ...receiptData, receiptNumber: e.target.value })}
          />
        </div>
        
        <div className="space-y-2">
          <Label htmlFor="paymentDate">Data do Pagamento</Label>
          <Input
            id="paymentDate"
            type="date"
            value={receiptData.paymentDate}
            onChange={(e) => setReceiptData({ ...receiptData, paymentDate: e.target.value })}
          />
        </div>
      </div>

      <div className="space-y-2">
        <Label htmlFor="amount">Valor Recebido (R$)</Label>
        <Input
          id="amount"
          type="number"
          step="0.01"
          value={receiptData.amount}
          onChange={(e) => setReceiptData({ ...receiptData, amount: parseFloat(e.target.value) || 0 })}
        />
        <p className="text-sm text-muted-foreground italic">
          {numberToWords(receiptData.amount)}
        </p>
      </div>

      <div className="space-y-2">
        <Label htmlFor="paymentMethod">Forma de Pagamento</Label>
        <Select
          value={receiptData.paymentMethod}
          onValueChange={(value: any) => setReceiptData({ ...receiptData, paymentMethod: value })}
        >
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="dinheiro">Dinheiro</SelectItem>
            <SelectItem value="pix">PIX</SelectItem>
            <SelectItem value="transferencia">Transferência Bancária</SelectItem>
            <SelectItem value="cheque">Cheque</SelectItem>
            <SelectItem value="cartao">Cartão de Crédito/Débito</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div className="space-y-2">
        <Label htmlFor="description">Descrição do Serviço/Produto</Label>
        <Textarea
          id="description"
          value={receiptData.description}
          onChange={(e) => setReceiptData({ ...receiptData, description: e.target.value })}
          rows={3}
          placeholder="Descreva o serviço ou produto referente a este pagamento"
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="observations">Observações (opcional)</Label>
        <Textarea
          id="observations"
          value={receiptData.observations}
          onChange={(e) => setReceiptData({ ...receiptData, observations: e.target.value })}
          rows={2}
          placeholder="Informações adicionais"
        />
      </div>

      <div className="space-y-3 border rounded-lg p-4">
        <div className="flex items-center gap-2 font-semibold">
          <Building2 className="w-4 h-4 text-primary" />
          Assinatura do Recebedor (Empresa)
        </div>
        <SignaturePad
          value={companySignature}
          onChange={setCompanySignature}
          height={150}
          signatureType="company"
          showSavedSignatures={true}
        />
        <p className="text-xs text-muted-foreground">
          A assinatura será inserida automaticamente no PDF do recibo.
        </p>
      </div>

      <div className="border rounded-lg p-4 bg-muted/30">
        <h4 className="font-semibold mb-2">Prévia do Recibo</h4>
        <div className="text-sm space-y-1">
          <p><strong>Recibo Nº:</strong> {receiptData.receiptNumber}</p>
          <p><strong>Valor:</strong> R$ {receiptData.amount.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</p>
          <p><strong>Recebedor:</strong> {company.name}</p>
          <p><strong>Pagador:</strong> {quoteData.client_name}</p>
          <p><strong>Forma de Pagamento:</strong> {getPaymentMethodLabel(receiptData.paymentMethod)}</p>
        </div>
      </div>

      <div className="flex gap-2">
        <Button onClick={generateReceiptPDF} className="flex-1">
          <Download className="h-4 w-4 mr-2" />
          Baixar Recibo (PDF)
        </Button>
        <Button variant="outline" onClick={generateReceiptPDF}>
          <Printer className="h-4 w-4 mr-2" />
          Imprimir
        </Button>
      </div>
    </div>
  );
};
