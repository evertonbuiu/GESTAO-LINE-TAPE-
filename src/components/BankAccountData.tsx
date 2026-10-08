import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { BankAccountData as BankAccountDataType } from "@/types/contract";
import { Building2, User, Hash, CreditCard, Key, FileText, BookMarked } from "lucide-react";

interface SavedBankAccount {
  id: string;
  name: string;
  bank_name: string | null;
  account_holder: string | null;
  account_number: string | null;
  account_agency: string | null;
  account_document: string | null;
  pix_key: string | null;
}

interface BankAccountDataProps {
  data: BankAccountDataType;
  onDataUpdate: (field: keyof BankAccountDataType, value: string) => void;
  savedBankAccounts?: SavedBankAccount[];
  selectedBankAccountId?: string;
  onSelectBankAccount?: (accountId: string) => void;
}

export function BankAccountData({ 
  data, 
  onDataUpdate,
  savedBankAccounts = [],
  selectedBankAccountId = '',
  onSelectBankAccount
}: BankAccountDataProps) {
  
  const handleSelectAccount = (accountId: string) => {
    if (onSelectBankAccount) {
      onSelectBankAccount(accountId);
    }
    
    const selectedAccount = savedBankAccounts.find(acc => acc.id === accountId);
    if (selectedAccount) {
      onDataUpdate('bankName', selectedAccount.bank_name || '');
      onDataUpdate('accountHolder', selectedAccount.account_holder || '');
      onDataUpdate('accountNumber', selectedAccount.account_number || '');
      onDataUpdate('accountAgency', selectedAccount.account_agency || '');
      onDataUpdate('accountDocument', selectedAccount.account_document || '');
      onDataUpdate('pixKey', selectedAccount.pix_key || '');
    }
  };

  return (
    <Card className="shadow-card border-border/60">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-professional">
          <Building2 className="w-5 h-5" />
          Dados Bancários para Pagamento
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Seletor de contas salvas */}
        {savedBankAccounts.length > 0 && (
          <div className="space-y-2 pb-4 border-b border-border/40">
            <Label className="flex items-center gap-2 text-sm font-medium text-professional">
              <BookMarked className="w-4 h-4" />
              Selecionar Conta Salva
            </Label>
            <Select
              value={selectedBankAccountId}
              onValueChange={handleSelectAccount}
            >
              <SelectTrigger className="border-border/60 focus:border-primary">
                <SelectValue placeholder="Escolha uma conta salva..." />
              </SelectTrigger>
              <SelectContent>
                {savedBankAccounts.map((account) => (
                  <SelectItem key={account.id} value={account.id}>
                    {account.name} {account.bank_name ? `(${account.bank_name})` : ''}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        )}

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label 
              htmlFor="bankName" 
              className="flex items-center gap-2 text-sm font-medium text-professional"
            >
              <Building2 className="w-4 h-4" />
              Nome do Banco
            </Label>
            <Input
              id="bankName"
              value={data.bankName}
              onChange={(e) => onDataUpdate('bankName', e.target.value)}
              placeholder="Ex: Banco do Brasil, Caixa, Itaú..."
              className="border-border/60 focus:border-primary"
            />
          </div>

          <div className="space-y-2">
            <Label 
              htmlFor="accountHolder" 
              className="flex items-center gap-2 text-sm font-medium text-professional"
            >
              <User className="w-4 h-4" />
              Titular da Conta
            </Label>
            <Input
              id="accountHolder"
              value={data.accountHolder}
              onChange={(e) => onDataUpdate('accountHolder', e.target.value)}
              placeholder="Nome completo do titular"
              className="border-border/60 focus:border-primary"
            />
          </div>

          <div className="space-y-2">
            <Label 
              htmlFor="accountAgency" 
              className="flex items-center gap-2 text-sm font-medium text-professional"
            >
              <Hash className="w-4 h-4" />
              Agência
            </Label>
            <Input
              id="accountAgency"
              value={data.accountAgency}
              onChange={(e) => onDataUpdate('accountAgency', e.target.value)}
              placeholder="Ex: 1234-5"
              className="border-border/60 focus:border-primary"
            />
          </div>

          <div className="space-y-2">
            <Label 
              htmlFor="accountNumber" 
              className="flex items-center gap-2 text-sm font-medium text-professional"
            >
              <CreditCard className="w-4 h-4" />
              Número da Conta
            </Label>
            <Input
              id="accountNumber"
              value={data.accountNumber}
              onChange={(e) => onDataUpdate('accountNumber', e.target.value)}
              placeholder="Ex: 12345-6"
              className="border-border/60 focus:border-primary"
            />
          </div>

          <div className="space-y-2">
            <Label 
              htmlFor="accountDocument" 
              className="flex items-center gap-2 text-sm font-medium text-professional"
            >
              <FileText className="w-4 h-4" />
              CPF/CNPJ do Titular
            </Label>
            <Input
              id="accountDocument"
              value={data.accountDocument}
              onChange={(e) => onDataUpdate('accountDocument', e.target.value)}
              placeholder="000.000.000-00 ou 00.000.000/0000-00"
              className="border-border/60 focus:border-primary"
            />
          </div>

          <div className="space-y-2">
            <Label 
              htmlFor="pixKey" 
              className="flex items-center gap-2 text-sm font-medium text-professional"
            >
              <Key className="w-4 h-4" />
              Chave PIX
            </Label>
            <Input
              id="pixKey"
              value={data.pixKey}
              onChange={(e) => onDataUpdate('pixKey', e.target.value)}
              placeholder="CPF, e-mail, telefone ou chave aleatória"
              className="border-border/60 focus:border-primary"
            />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
