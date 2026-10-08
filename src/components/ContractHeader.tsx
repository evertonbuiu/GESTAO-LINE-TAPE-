import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Building2, FileText, Calendar, MapPin, User, Package } from "lucide-react";
import { formatPhone, handlePhoneInput } from '@/lib/utils';

interface Product {
  id: string;
  name: string;
  description?: string;
  quantity: number;
  unitPrice: number;
  subtotal: number;
  image?: string;
}

interface ContractHeaderProps {
  contractNumber: string;
  budgetNumber: string;
  companyName: string;
  companyAddress: string;
  companyPhone: string;
  companyEmail: string;
  companyDocument: string;
  clientName: string;
  clientEmail: string;
  clientDocument: string;
  clientAddress: string;
  clientPhone: string;
  eventDate: string;
  eventLocation: string;
  initialSetupDate: string;
  decorator: string;
  technicalResponsible: string;
  serviceDescription: string;
  products: Product[];
  onCompanyUpdate: (field: string, value: string) => void;
  onClientUpdate: (field: string, value: string) => void;
}

export function ContractHeader({
  contractNumber,
  budgetNumber,
  companyName,
  companyAddress,
  companyPhone,
  companyEmail,
  companyDocument,
  clientName,
  clientEmail,
  clientDocument,
  clientAddress,
  clientPhone,
  eventDate,
  eventLocation,
  initialSetupDate,
  decorator,
  technicalResponsible,
  serviceDescription,
  products,
  onCompanyUpdate,
  onClientUpdate,
}: ContractHeaderProps) {
  return (
    <Card className="shadow-card border-border/60">
      <CardContent className="p-8">
        {/* Company and Contract Info */}
        <div className="flex justify-between items-start mb-8">
          <div className="space-y-3">
            <div className="flex items-center gap-2 text-primary">
              <Building2 className="w-5 h-5" />
              <Input
                value={companyName}
                onChange={(e) => onCompanyUpdate('companyName', e.target.value)}
                className="text-xl font-bold border-none p-0 h-auto bg-transparent focus-visible:ring-0"
                placeholder="Nome da Empresa"
              />
            </div>
            <Input
              value={companyAddress}
              onChange={(e) => onCompanyUpdate('companyAddress', e.target.value)}
              className="text-sm text-muted-foreground border-none p-0 h-auto bg-transparent focus-visible:ring-0"
              placeholder="Endereço da empresa"
            />
            <div className="flex gap-4">
                <Input
                  value={companyPhone}
                  onChange={(e) => {
                    const formatted = handlePhoneInput(e.target.value);
                    onCompanyUpdate('companyPhone', formatted);
                  }}
                  className="text-sm text-muted-foreground border-none p-0 h-auto bg-transparent focus-visible:ring-0 w-40"
                  placeholder="Telefone"
                />
              <Input
                value={companyEmail}
                onChange={(e) => onCompanyUpdate('companyEmail', e.target.value)}
                className="text-sm text-muted-foreground border-none p-0 h-auto bg-transparent focus-visible:ring-0"
                placeholder="E-mail"
              />
            </div>
            <Input
              value={companyDocument}
              onChange={(e) => onCompanyUpdate('companyDocument', e.target.value)}
              className="text-sm text-muted-foreground border-none p-0 h-auto bg-transparent focus-visible:ring-0 w-48"
              placeholder="CNPJ"
            />
          </div>
          
          <div className="text-right space-y-2">
            <div className="flex items-center gap-2 text-primary">
              <FileText className="w-5 h-5" />
              <span className="text-xl font-bold">CONTRATO Nº {contractNumber}</span>
            </div>
            <p className="text-sm text-muted-foreground">Baseado no Orçamento #{budgetNumber}</p>
            <p className="text-sm text-muted-foreground">
              Data: {new Date().toLocaleDateString('pt-BR')}
            </p>
          </div>
        </div>

        {/* Client Information */}
        <div className="border-t border-border/60 pt-6">
          <h3 className="text-lg font-semibold mb-4 flex items-center gap-2 text-primary">
            <User className="w-5 h-5" />
            Dados do Contratante
          </h3>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-4">
              <div>
                <Label htmlFor="client-name">Nome/Razão Social</Label>
                <Input
                  id="client-name"
                  value={clientName}
                  onChange={(e) => onClientUpdate('clientName', e.target.value)}
                  placeholder="Nome do cliente"
                />
              </div>
              
              <div>
                <Label htmlFor="client-document">CPF/CNPJ</Label>
                <Input
                  id="client-document"
                  value={clientDocument}
                  onChange={(e) => onClientUpdate('clientDocument', e.target.value)}
                  placeholder="000.000.000-00"
                />
              </div>
              
              <div>
                <Label htmlFor="client-email">E-mail</Label>
                <Input
                  id="client-email"
                  value={clientEmail}
                  onChange={(e) => onClientUpdate('clientEmail', e.target.value)}
                  placeholder="cliente@email.com"
                />
              </div>
              
              <div>
                <Label htmlFor="client-phone">Telefone</Label>
                <Input
                  id="client-phone"
                  value={clientPhone}
                  onChange={(e) => {
                    const formatted = handlePhoneInput(e.target.value);
                    onClientUpdate('clientPhone', formatted);
                  }}
                  placeholder="(11) 99999-9999"
                />
              </div>
            </div>
            
            <div className="space-y-4">
              <div>
                <Label htmlFor="client-address">Endereço Completo</Label>
                <Textarea
                  id="client-address"
                  value={clientAddress}
                  onChange={(e) => onClientUpdate('clientAddress', e.target.value)}
                  placeholder="Rua, número, bairro, cidade, CEP"
                  rows={3}
                />
              </div>
              
              <div>
                <Label htmlFor="event-date" className="flex items-center gap-2">
                  <Calendar className="w-4 h-4" />
                  Data do Evento
                </Label>
                <Input
                  id="event-date"
                  type="date"
                  value={eventDate}
                  onChange={(e) => onClientUpdate('eventDate', e.target.value)}
                />
              </div>
              
              <div>
                <Label htmlFor="event-location" className="flex items-center gap-2">
                  <MapPin className="w-4 h-4" />
                  Local do Evento
                </Label>
                <Input
                  id="event-location"
                  value={eventLocation}
                  onChange={(e) => onClientUpdate('eventLocation', e.target.value)}
                  placeholder="Endereço do evento"
                />
               </div>
               
               <div>
                 <Label htmlFor="initial-setup-date" className="flex items-center gap-2">
                   <Calendar className="w-4 h-4" />
                   Dia Inicial de Montagem
                 </Label>
                 <Input
                   id="initial-setup-date"
                   type="date"
                   value={initialSetupDate}
                   onChange={(e) => onClientUpdate('initialSetupDate', e.target.value)}
                 />
               </div>
               
               <div>
                <Label htmlFor="decorator">Decorador Responsável</Label>
                <Input
                  id="decorator"
                  value={decorator}
                  onChange={(e) => onClientUpdate('decorator', e.target.value)}
                  placeholder="Nome do decorador"
                 />
               </div>
               
               <div>
                 <Label htmlFor="technicalResponsible">Responsável Técnico</Label>
                 <Input
                   id="technicalResponsible"
                   value={technicalResponsible}
                   onChange={(e) => onClientUpdate('technicalResponsible', e.target.value)}
                   placeholder="Nome do responsável técnico"
                 />
               </div>
             </div>
          </div>
          
          <div className="mt-6 space-y-4">
            <Label htmlFor="service-description">Descrição dos Serviços</Label>
            <Textarea
              id="service-description"
              value={serviceDescription}
              onChange={(e) => onClientUpdate('serviceDescription', e.target.value)}
              placeholder="Descreva detalhadamente os serviços de decoração que serão prestados..."
              rows={4}
            />
            
            {/* Products Table */}
            {products.length > 0 && (
              <div className="mt-4">
                <h4 className="flex items-center gap-2 font-medium text-primary mb-3">
                  <Package className="w-4 h-4" />
                  Produtos Inclusos no Serviço
                </h4>
                
                <div className="border border-border/60 rounded-lg overflow-hidden">
                  <table className="w-full">
                    <thead>
                      <tr className="bg-muted/50 border-b border-border/60">
                        <th className="text-left p-3 text-sm font-medium text-muted-foreground">Imagem</th>
                        <th className="text-left p-3 text-sm font-medium text-muted-foreground">Produto</th>
                        <th className="text-center p-3 text-sm font-medium text-muted-foreground">Qtd</th>
                        <th className="text-right p-3 text-sm font-medium text-muted-foreground">Valor Unit.</th>
                        <th className="text-right p-3 text-sm font-medium text-muted-foreground">Subtotal</th>
                      </tr>
                    </thead>
                    <tbody>
                      {products.map((product) => (
                        <tr key={product.id} className="border-b border-border/30 last:border-b-0">
                          <td className="p-3">
                            <div className="w-12 h-12 bg-muted/30 rounded border border-border/40 flex items-center justify-center overflow-hidden">
                              {product.image ? (
                                <img 
                                  src={product.image} 
                                  alt={product.name}
                                  className="w-full h-full object-cover"
                                />
                              ) : (
                                <Package className="w-5 h-5 text-muted-foreground" />
                              )}
                            </div>
                          </td>
                          <td className="p-3">
                            <div>
                              <p className="font-medium text-sm">{product.name}</p>
                              {product.description && (
                                <p className="text-xs text-muted-foreground mt-1">{product.description}</p>
                              )}
                            </div>
                          </td>
                          <td className="p-3 text-center">
                            <span className="text-sm font-medium">{product.quantity}</span>
                          </td>
                          <td className="p-3 text-right">
                            <span className="text-sm font-medium">R$ {product.unitPrice.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                          </td>
                          <td className="p-3 text-right">
                            <span className="text-sm font-medium">R$ {product.subtotal.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}