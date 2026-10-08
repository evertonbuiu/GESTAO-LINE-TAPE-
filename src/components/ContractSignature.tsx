import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import SignaturePad from "@/components/ui/SignaturePad";
import { FileText, Users, Building2 } from "lucide-react";

interface ContractSignatureProps {
  companySignature?: string;
  onCompanySignatureChange: (signature?: string) => void;
}

export function ContractSignature({
  companySignature,
  onCompanySignatureChange,
}: ContractSignatureProps) {
  return (
    <Card className="shadow-card border-border/60">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-primary">
          <FileText className="w-6 h-6" />
          Assinatura do Contrato
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Assinatura da Empresa */}
        <div className="space-y-4">
          <div className="flex items-center gap-2 text-lg font-semibold">
            <Building2 className="w-5 h-5 text-primary" />
            Assinatura da Empresa
          </div>
          
          <SignaturePad
            value={companySignature}
            onChange={onCompanySignatureChange}
            height={150}
            signatureType="company"
            showSavedSignatures={true}
          />
          
          <div className="text-center">
            <div className="w-80 mx-auto border-t-2 border-border mb-2"></div>
            <p className="text-sm font-medium">Representante Legal da Empresa</p>
            <p className="text-xs text-muted-foreground">(Nome, CPF e Data)</p>
          </div>
        </div>

        {/* Instruções */}
        <div className="bg-muted/50 p-4 rounded-lg">
          <p className="text-sm font-medium mb-2">Instruções:</p>
          <ul className="text-xs text-muted-foreground space-y-1">
            <li>• Desenhe sua assinatura no campo acima</li>
            <li>• Use "Remover" para limpar a assinatura</li>
            <li>• Use "Upload imagem" para carregar uma assinatura</li>
            <li>• Use "Assinaturas Salvas" para acessar suas assinaturas do banco de dados</li>
            <li>• Use "Salvar Atual" para guardar a assinatura atual no banco de dados</li>
          </ul>
        </div>
      </CardContent>
    </Card>
  );
}