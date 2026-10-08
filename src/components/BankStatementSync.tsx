import React, { useMemo, useRef, useState } from 'react';
import { suggestMatches, type Suggestion, type ReconcilableEntry } from '@/lib/reconciliation';
import {
  buildImportFingerprint,
  dedupeByFingerprint,
  getFileExtension,
  parseOfx,
  summarizeImport,
  validateStatementFile,
} from '@/lib/bankStatementImport';

import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { Upload, Check, X, AlertCircle, Plus, FileText } from "lucide-react";
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { Checkbox } from "@/components/ui/checkbox";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import * as XLSX from 'xlsx';
import { ImportTransactionDialog } from './ImportTransactionDialog';
import { useCompanySettings } from '@/hooks/useCompanySettings';
import { useLogo } from '@/hooks/useLogo';

interface BankTransaction {
  date: string;
  description: string;
  amount: number;
  type: 'income' | 'expense';
  category?: string;
  /** Saldo após a transação (quando disponível no extrato, ex: C6) */
  balanceAfter?: number;
  /** Identificador único do lançamento no extrato OFX (FITID). */
  fitId?: string | null;
}

interface SystemTransaction {
  id: string;
  date: string;
  description: string;
  amount: number;
  type: 'income' | 'expense';
  category?: string;
  /** Saldo após a transação (calculado ou vindo do campo balance_after) */
  balanceAfter?: number;
}

interface ReconciliationRow {
  imported: BankTransaction | null;
  system: SystemTransaction | null;
  matched: boolean;
}

interface BankStatementSyncProps {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  account: {
    id: string;
    name: string;
    balance: number;
    type: 'checking' | 'savings' | 'cash';
  };
  onSyncComplete: () => void;
  onDataRefresh?: () => void | Promise<void>;
}

export const BankStatementSync: React.FC<BankStatementSyncProps> = ({
  isOpen,
  onOpenChange,
  account,
  onSyncComplete,
  onDataRefresh
}) => {
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [parsedTransactions, setParsedTransactions] = useState<BankTransaction[]>([]);
  const [systemTransactions, setSystemTransactions] = useState<SystemTransaction[]>([]);
  const [reconciliationData, setReconciliationData] = useState<ReconciliationRow[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const [isImporting, setIsImporting] = useState(false);
  const [isLoadingSystem, setIsLoadingSystem] = useState(false);
  const [step, setStep] = useState<'upload' | 'preview' | 'reconciliation' | 'complete'>('upload');
  const [selectedForImport, setSelectedForImport] = useState<Set<number>>(new Set());
  const [isImportingSelected, setIsImportingSelected] = useState(false);
  const [isImportDialogOpen, setIsImportDialogOpen] = useState(false);
  const suppressParentCloseRef = useRef(false);
  const { toast } = useToast();
  const { settings: companySettings } = useCompanySettings();
  const { logoUrl } = useLogo();

  /**
   * Sugestões assistidas de conciliação: cruzam linhas só do extrato com linhas
   * só do sistema por valor, data e descrição. Nunca confirmam sozinhas.
   */
  const reconciliationSuggestions = useMemo(() => {
    const onlySystem: ReconcilableEntry[] = reconciliationData
      .filter((r) => !r.imported && r.system)
      .map((r) => ({
        id: r.system!.id,
        description: r.system!.description,
        amount: Math.abs(r.system!.amount),
        date: r.system!.date,
        type: r.system!.type,
      }));

    if (onlySystem.length === 0) return [];

    const results: Array<{
      rowIndex: number;
      imported: BankTransaction;
      suggestion: Suggestion<ReconcilableEntry>;
    }> = [];

    reconciliationData.forEach((row, rowIndex) => {
      if (!row.imported || row.system) return;
      const source: ReconcilableEntry = {
        id: `imported-${rowIndex}`,
        description: row.imported.description,
        amount: Math.abs(row.imported.amount),
        date: row.imported.date,
        type: row.imported.type,
      };
      suggestMatches(source, onlySystem, { limit: 1, minScore: 45 }).forEach((suggestion) =>
        results.push({ rowIndex, imported: row.imported!, suggestion }),
      );
    });

    return results.sort((a, b) => b.suggestion.score - a.suggestion.score).slice(0, 20);
  }, [reconciliationData]);

  /** Vinculação manual de uma sugestão (o usuário confirma). */
  const linkSuggestion = (rowIndex: number, systemId: string) => {
    setReconciliationData((prev) => {
      const target = prev[rowIndex];
      const systemRowIndex = prev.findIndex((r) => !r.imported && r.system?.id === systemId);
      if (!target?.imported || systemRowIndex < 0) return prev;
      const systemRow = prev[systemRowIndex];
      return prev
        .map((row, i) =>
          i === rowIndex ? { imported: target.imported, system: systemRow.system, matched: true } : row,
        )
        .filter((_, i) => i !== systemRowIndex);
    });
    toast({ title: 'Lançamento vinculado', description: 'Conciliação confirmada manualmente.' });
  };


  const handleFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    const check = validateStatementFile(file);
    if (!check.ok) {
      event.target.value = '';
      setSelectedFile(null);
      setParsedTransactions([]);
      toast({ title: 'Arquivo inválido', description: check.error, variant: 'destructive' });
      return;
    }
    setSelectedFile(file);
    setParsedTransactions([]);
    setStep('upload');
  };

  const processFile = async () => {
    const fileCheck = validateStatementFile(selectedFile);
    if (!fileCheck.ok) {
      toast({ title: 'Erro', description: fileCheck.error, variant: 'destructive' });
      return;
    }

    setIsProcessing(true);
    const extension = getFileExtension(selectedFile!.name);

    try {
      const reader = new FileReader();
      reader.onload = (e) => {
        const data = e.target?.result;
        if (!data) {
          setIsProcessing(false);
          toast({
            title: "Erro",
            description: "Não foi possível ler o arquivo",
            variant: "destructive"
          });
          return;
        }

        const transactions: BankTransaction[] = [];
        const errors: string[] = [];

        if (extension === '.ofx') {
          // Extrato OFX real: lê apenas blocos STMTTRN.
          const result = parseOfx(data as string);
          result.transactions.forEach((t) => {
            transactions.push({
              date: t.date,
              description: t.description,
              amount: t.amount,
              type: t.type,
              category: categorizeTransaction(t.description),
              fitId: t.fitId ?? null,
            });
          });
          if (result.discarded > 0) {
            errors.push(`${result.discarded} lançamento(s) descartado(s) por data/valor inválidos`);
          }
          if (result.transactions.length === 0 && result.errors.length > 0) {
            errors.push(result.errors[0]);
          }
        } else if (extension === '.csv') {

          // Process CSV
          const text = data as string;
          const lines = text.split('\n').filter(line => line.trim());
          
          if (lines.length < 2) {
            errors.push("Arquivo CSV deve ter pelo menos 2 linhas (cabeçalho + dados)");
          } else {
            const headers = lines[0]?.toLowerCase().split(';').map(h => h.trim().replace(/"/g, '')) || [];
            console.log('CSV Headers encontrados:', headers);
            
            // Find column indices with better detection
            const dateIndex = headers.findIndex(h => 
              h.includes('data') || h.includes('date') || h.includes('dt') || 
              h.includes('vencimento') || h.includes('movimento')
            );
            const descriptionIndex = headers.findIndex(h => 
              h.includes('descrição') || h.includes('description') || h.includes('histórico') ||
              h.includes('descricao') || h.includes('lancamento') || h.includes('documento')
            );
            const amountIndex = headers.findIndex(h => 
              h.includes('valor') || h.includes('amount') || h.includes('quantia') ||
              h.includes('débito') || h.includes('crédito') || h.includes('saldo')
            );

            console.log('Índices encontrados - Data:', dateIndex, 'Descrição:', descriptionIndex, 'Valor:', amountIndex);

            if (dateIndex === -1 || descriptionIndex === -1 || amountIndex === -1) {
              errors.push("Não foi possível identificar as colunas necessárias (Data, Descrição, Valor)");
            } else {
              for (let i = 1; i < lines.length; i++) {
                const values = lines[i].split(';').map(v => v.trim().replace(/"/g, ''));
                if (values.length > Math.max(dateIndex, descriptionIndex, amountIndex)) {
                  const dateStr = values[dateIndex];
                  const description = values[descriptionIndex];
                  const amountStr = values[amountIndex];

                  if (dateStr && description && amountStr) {
                    const cleanAmount = amountStr.replace(/[^\d,.-]/g, '');
                    const amount = parseFloat(cleanAmount.replace(',', '.'));
                    
                    if (!isNaN(amount)) {
                      transactions.push({
                        date: formatDateToISO(dateStr),
                        description: description.substring(0, 200), // Limit description length
                        amount: Math.abs(amount),
                        type: amount >= 0 ? 'income' : 'expense',
                        category: categorizeTransaction(description)
                      });
                    }
                  }
                }
              }
            }
          }
        } else if (extension === '.xlsx' || extension === '.xls') {
          // Process Excel
          try {
            const workbook = XLSX.read(data, { type: 'binary' });
            const sheetName = workbook.SheetNames[0];
            const worksheet = workbook.Sheets[sheetName];

            // Some bank exports (ex: Itaú) may generate a truncated worksheet "!ref"
            // which causes sheet_to_json to read only a small part of the table.
            // Expand the range by scanning all populated cells.
            const originalRef = (worksheet as any)['!ref'];
            let maxRow = 0;
            let maxCol = 0;
            for (const addr of Object.keys(worksheet)) {
              if (addr.startsWith('!')) continue;
              const { r, c } = XLSX.utils.decode_cell(addr);
              if (r > maxRow) maxRow = r;
              if (c > maxCol) maxCol = c;
            }
            const expandedRef = XLSX.utils.encode_range({
              s: { r: 0, c: 0 },
              e: { r: maxRow, c: maxCol },
            });
            (worksheet as any)['!ref'] = expandedRef;
            console.log('Excel sheet:', sheetName, 'original !ref:', originalRef, 'expanded !ref:', expandedRef);

            const jsonData = XLSX.utils.sheet_to_json(worksheet, { header: 1, raw: false }) as any[][];

            console.log('Excel data length:', jsonData.length);

            if (jsonData.length < 2) {
              errors.push("Arquivo Excel deve ter pelo menos 2 linhas (cabeçalho + dados)");
            } else {
              // Detect bank format based on headers
              let bankFormat: 'itau' | 'c6' | 'standard' = 'standard';
              let headerRowIndex = 0;
              
              // Search for bank format indicators in first 15 rows
              for (let i = 0; i < Math.min(15, jsonData.length); i++) {
                const row = jsonData[i];
                if (row && row.length > 0) {
                  const rowStr = row.map(c => c?.toString().toLowerCase().trim() || '').join(' ');
                  const firstCell = row[0]?.toString().toLowerCase().trim() || '';
                  
                  // Check for C6 Bank format: "Data Lançamento", "Data Contábil", "Título", "Descrição", "Entrada(R$)", "Saída(R$)", "Saldo do Dia(R$)"
                  if (rowStr.includes('data lançamento') || rowStr.includes('data lancamento')) {
                    if (rowStr.includes('entrada') && rowStr.includes('saída')) {
                      bankFormat = 'c6';
                      headerRowIndex = i;
                      console.log('C6 Bank format detected at row', i);
                      break;
                    }
                  }
                  
                  // Check for Itaú format
                  if (firstCell === 'data') {
                    if (rowStr.includes('lançamento') || rowStr.includes('lancamento')) {
                      if (!rowStr.includes('entrada') && !rowStr.includes('saída')) {
                        bankFormat = 'itau';
                        headerRowIndex = i;
                        console.log('Itaú format detected at row', i);
                        break;
                      }
                    }
                  }
                }
              }

              if (bankFormat === 'c6') {
                // Process C6 Bank format
                // Columns: Data Lançamento (0), Data Contábil (1), Título (2), Descrição (3), Entrada(R$) (4), Saída(R$) (5), Saldo do Dia(R$) (6)
                const headers = (jsonData[headerRowIndex] as string[]).map(h => h?.toString().toLowerCase().trim() || '');
                console.log('C6 Bank Headers:', headers);
                
                const dateIndex = 0; // Data Lançamento
                const tituloIndex = 2; // Título
                const descriptionIndex = 3; // Descrição
                const entradaIndex = headers.findIndex(h => h.includes('entrada'));
                const saidaIndex = headers.findIndex(h => h.includes('saída') || h.includes('saida'));
                const saldoIndex = headers.findIndex(h => h.includes('saldo'));
                
                console.log('C6 Índices - Data:', dateIndex, 'Título:', tituloIndex, 'Descrição:', descriptionIndex, 'Entrada:', entradaIndex, 'Saída:', saidaIndex, 'Saldo:', saldoIndex);

                for (let i = headerRowIndex + 1; i < jsonData.length; i++) {
                  const row = jsonData[i];
                  if (row && row.length > 0) {
                    const dateStr = row[dateIndex]?.toString().trim();
                    const titulo = row[tituloIndex]?.toString().trim() || '';
                    const descricao = row[descriptionIndex]?.toString().trim() || '';
                    const entradaRaw = row[entradaIndex];
                    const saidaRaw = row[saidaIndex];
                    const saldoRaw = saldoIndex >= 0 ? row[saldoIndex] : '';

                    // Skip rows without date
                    if (!dateStr) continue;
                    
                    // Combine título and descrição for better description
                    const fullDescription = titulo ? `${titulo} - ${descricao}`.substring(0, 200) : descricao.substring(0, 200);
                    
                    // Helper to parse monetary values with different formats
                    // Handles: "1,730.46" (US), "1.730,46" (BR), "-604.11", "604,11"
                    const parseMonetaryValue = (raw: any): number => {
                      if (raw === null || raw === undefined || raw === '') return 0;
                      if (typeof raw === 'number') return Math.abs(raw);
                      
                      const str = raw.toString().trim();
                      // Remove currency symbols and spaces
                      let clean = str.replace(/[R$\s]/g, '');
                      
                      // Detect format: check if comma is used as decimal separator
                      // If format is "1.234,56" (BR) - dot is thousands, comma is decimal
                      // If format is "1,234.56" (US) - comma is thousands, dot is decimal
                      const lastComma = clean.lastIndexOf(',');
                      const lastDot = clean.lastIndexOf('.');
                      
                      if (lastComma > lastDot) {
                        // Brazilian format: 1.234,56 -> remove dots, replace comma with dot
                        clean = clean.replace(/\./g, '').replace(',', '.');
                      } else if (lastDot > lastComma) {
                        // US format: 1,234.56 -> remove commas
                        clean = clean.replace(/,/g, '');
                      } else if (lastComma !== -1 && lastDot === -1) {
                        // Only comma, no dot: 1234,56 -> treat comma as decimal
                        clean = clean.replace(',', '.');
                      }
                      // If only dots, keep as is (already decimal format)
                      
                      const value = parseFloat(clean) || 0;
                      return Math.abs(value);
                    };

                    // Parse entrada (income)
                    const entrada = parseMonetaryValue(entradaRaw);
                    
                    // Parse saída (expense)
                    const saida = parseMonetaryValue(saidaRaw);

                    // Parse saldo (balance after transaction/day) when present
                    let balanceAfter: number | undefined = undefined;
                    if (saldoRaw !== null && saldoRaw !== undefined && saldoRaw !== '') {
                      const parsedSaldo = parseMonetaryValue(saldoRaw);
                      // For balance, we need to preserve the sign if negative
                      if (typeof saldoRaw === 'number') {
                        balanceAfter = saldoRaw;
                      } else {
                        const isNegative = saldoRaw.toString().includes('-');
                        balanceAfter = isNegative ? -parsedSaldo : parsedSaldo;
                      }
                    }
                    
                    console.log('C6 Row:', dateStr, 'Entrada:', entrada, 'Saída:', saida, 'Saldo:', balanceAfter, 'Desc:', fullDescription.substring(0, 50));
                    
                    // Add transaction if there's a value (entrada = income, saída = expense)
                    if (entrada > 0.01) {
                      transactions.push({
                        date: formatDateToISO(dateStr),
                        description: fullDescription,
                        amount: entrada,
                        type: 'income',
                        category: categorizeTransaction(fullDescription),
                        balanceAfter,
                      });
                    } else if (saida > 0.01) {
                      transactions.push({
                        date: formatDateToISO(dateStr),
                        description: fullDescription,
                        amount: saida,
                        type: 'expense',
                        category: categorizeTransaction(fullDescription),
                        balanceAfter,
                      });
                    }
                  }
                }
              } else if (bankFormat === 'itau') {
                // Process Itaú format
                const headers = (jsonData[headerRowIndex] as string[]).map(h => h?.toString().toLowerCase().trim() || '');
                console.log('Itaú Headers:', headers);
                
                // Itaú columns: Data (0), Lançamento (1), Razão Social (2), CPF/CNPJ (3), Valor (R$) (4), Saldo (R$) (5)
                const dateIndex = 0;
                const descriptionIndex = 1;
                const valorIndex = headers.findIndex(h => h.includes('valor'));
                
                console.log('Itaú Índices - Data:', dateIndex, 'Lançamento:', descriptionIndex, 'Valor:', valorIndex);

                // Itaú columns: Data (0), Lançamento (1), Razão Social (2), CPF/CNPJ (3), Valor (R$) (4), Saldo (R$) (5)
                const razaoSocialIndex = headers.findIndex(h => h.includes('razão social') || h.includes('razao social'));
                const cpfCnpjIndex = headers.findIndex(h => h.includes('cpf') || h.includes('cnpj'));
                console.log('Itaú Índices extras - Razão Social:', razaoSocialIndex, 'CPF/CNPJ:', cpfCnpjIndex);

                for (let i = headerRowIndex + 1; i < jsonData.length; i++) {
                  const row = jsonData[i];
                  if (row && row.length > 0) {
                    const dateStr = row[dateIndex]?.toString().trim();
                    const description = row[descriptionIndex]?.toString().trim();
                    const valorStr = row[valorIndex]?.toString().trim();
                    const razaoSocial = razaoSocialIndex >= 0 ? row[razaoSocialIndex]?.toString().trim() : '';
                    const cpfCnpj = cpfCnpjIndex >= 0 ? row[cpfCnpjIndex]?.toString().trim() : '';

                    // Skip rows without proper data or summary rows
                    if (!dateStr || !description) continue;
                    if (description.includes('SALDO EM CONTA') || description.includes('SALDO TOTAL')) continue;
                    
                    // Check if there's a value in the Valor column
                    if (valorStr) {
                      const cleanAmount = valorStr.replace(/[^\d,.-]/g, '');
                      const amount = parseFloat(cleanAmount.replace(',', '.'));
                      
                      if (!isNaN(amount) && amount !== 0) {
                        // Montar descrição completa com razão social e CPF/CNPJ
                        let fullDescription = description;
                        if (razaoSocial) {
                          fullDescription += ` - ${razaoSocial}`;
                        }
                        if (cpfCnpj) {
                          fullDescription += ` (${cpfCnpj})`;
                        }

                        transactions.push({
                          date: formatDateToISO(dateStr),
                          description: fullDescription.substring(0, 300),
                          amount: Math.abs(amount),
                          type: amount >= 0 ? 'income' : 'expense',
                          category: categorizeTransaction(description)
                        });
                      }
                    }
                  }
                }
              } else {
                // Standard Excel format
                const headers = (jsonData[0] as string[]).map(h => h?.toString().toLowerCase().trim() || '');
                console.log('Standard Excel Headers encontrados:', headers);
                
                const dateIndex = headers.findIndex(h => 
                  h.includes('data') || h.includes('date') || h.includes('dt') ||
                  h.includes('vencimento') || h.includes('movimento')
                );
                const descriptionIndex = headers.findIndex(h => 
                  h.includes('descrição') || h.includes('description') || h.includes('histórico') ||
                  h.includes('descricao') || h.includes('lancamento') || h.includes('documento')
                );
                const amountIndex = headers.findIndex(h => 
                  h.includes('valor') || h.includes('amount') || h.includes('quantia') ||
                  h.includes('débito') || h.includes('crédito')
                );

                console.log('Índices encontrados - Data:', dateIndex, 'Descrição:', descriptionIndex, 'Valor:', amountIndex);

                if (dateIndex === -1 || descriptionIndex === -1 || amountIndex === -1) {
                  errors.push("Não foi possível identificar as colunas necessárias (Data, Descrição, Valor)");
                } else {
                  for (let i = 1; i < jsonData.length; i++) {
                    const row = jsonData[i] as any[];
                    if (row && row.length > Math.max(dateIndex, descriptionIndex, amountIndex)) {
                      const dateStr = row[dateIndex]?.toString().trim();
                      const description = row[descriptionIndex]?.toString().trim();
                      const amountStr = row[amountIndex]?.toString().trim();

                      if (dateStr && description && amountStr) {
                        const cleanAmount = amountStr.replace(/[^\d,.-]/g, '');
                        const amount = parseFloat(cleanAmount.replace(',', '.'));
                        
                        if (!isNaN(amount)) {
                          transactions.push({
                            date: formatDateToISO(dateStr),
                            description: description.substring(0, 200),
                            amount: Math.abs(amount),
                            type: amount >= 0 ? 'income' : 'expense',
                            category: categorizeTransaction(description)
                          });
                        }
                      }
                    }
                  }
                }
              }
            }
          } catch (xlsxError) {
            console.error('Erro ao processar Excel:', xlsxError);
            errors.push("Erro ao processar arquivo Excel");
          }
        }

        console.log('Transações processadas:', transactions.length);
        console.log('Errors:', errors);

        setParsedTransactions(transactions);
        setIsProcessing(false);

        if (errors.length > 0) {
          toast({
            title: "Atenção",
            description: `${transactions.length} transações processadas. Problemas: ${errors.join(', ')}`,
            variant: "destructive"
          });
        } else {
          toast({
            title: "Sucesso",
            description: `${transactions.length} transações processadas com sucesso`
          });
        }

        // Always go to preview step, even if no transactions were found
        setStep('preview');
      };

      reader.onerror = () => {
        setIsProcessing(false);
        toast({
          title: "Erro",
          description: "Erro ao ler o arquivo",
          variant: "destructive"
        });
      };

      if (extension === '.csv' || extension === '.ofx') {
        reader.readAsText(selectedFile!, 'UTF-8');
      } else {
        reader.readAsBinaryString(selectedFile!);
      }

    } catch (error) {
      console.error('Erro ao processar arquivo:', error);
      toast({
        title: "Erro",
        description: `Erro ao processar o arquivo: ${error instanceof Error ? error.message : 'Erro desconhecido'}`,
        variant: "destructive"
      });
      setIsProcessing(false);
    }
  };

  const formatDateToISO = (dateStr: string): string => {
    console.log('Formatando data:', dateStr);
    
    // Limpar a string de data
    const cleanDateStr = dateStr.trim();
    
    // Try different date formats - Formato brasileiro prioritário
    const formats = [
      { regex: /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/, order: 'DD/MM/YYYY' }, // DD/MM/YYYY (brasileiro)
      { regex: /^(\d{4})-(\d{1,2})-(\d{1,2})$/, order: 'YYYY-MM-DD' }, // YYYY-MM-DD (ISO)
      { regex: /^(\d{1,2})-(\d{1,2})-(\d{4})$/, order: 'DD-MM-YYYY' }, // DD-MM-YYYY (brasileiro)
      { regex: /^(\d{1,2})\.(\d{1,2})\.(\d{4})$/, order: 'DD.MM.YYYY' }, // DD.MM.YYYY (alemão/europeu)
    ];

    for (const format of formats) {
      const match = cleanDateStr.match(format.regex);
      if (match) {
        let day, month, year;
        
        if (format.order === 'YYYY-MM-DD') {
          [, year, month, day] = match;
        } else {
          // Todos os outros formatos assumem DD/MM/YYYY (formato brasileiro)
          [, day, month, year] = match;
        }
        
        // Validar se a data é válida
        const dayNum = parseInt(day, 10);
        const monthNum = parseInt(month, 10);
        const yearNum = parseInt(year, 10);
        
        if (dayNum >= 1 && dayNum <= 31 && monthNum >= 1 && monthNum <= 12 && yearNum >= 1900) {
          const formattedDate = `${yearNum}-${monthNum.toString().padStart(2, '0')}-${dayNum.toString().padStart(2, '0')}`;
          console.log(`Data convertida de ${cleanDateStr} (${format.order}) para ${formattedDate}`);
          return formattedDate;
        }
      }
    }

    // Tentar parser do JavaScript como último recurso
    const date = new Date(cleanDateStr);
    if (!isNaN(date.getTime())) {
      const isoDate = date.toISOString().split('T')[0];
      console.log(`Data parseada pelo JS de ${cleanDateStr} para ${isoDate}`);
      return isoDate;
    }

    // Se nada funcionar, usar data atual
    const today = new Date().toISOString().split('T')[0];
    console.warn(`Não foi possível converter a data "${cleanDateStr}", usando data atual: ${today}`);
    return today;
  };

  const categorizeTransaction = (description: string): string => {
    const desc = description.toLowerCase();
    
    if (desc.includes('pix') || desc.includes('ted') || desc.includes('transferencia')) {
      return 'Transferências';
    }
    if (desc.includes('saque') || desc.includes('caixa') || desc.includes('atm')) {
      return 'Saques';
    }
    if (desc.includes('compra') || desc.includes('débito') || desc.includes('mastercard') || desc.includes('visa')) {
      return 'Compras';
    }
    if (desc.includes('salário') || desc.includes('salario') || desc.includes('vencimento')) {
      return 'Receitas';
    }
    if (desc.includes('tarifa') || desc.includes('taxa') || desc.includes('anuidade')) {
      return 'Taxas e Tarifas';
    }
    
    return 'Outros';
  };

  /**
   * Gravação idempotente: cada lançamento recebe um fingerprint determinístico
   * (conta + FITID + data + tipo + centavos + descrição normalizada). Os já
   * existentes são ignorados; o índice único parcial protege contra concorrência.
   */
  const importTransactions = async () => {
    if (!account.id || parsedTransactions.length === 0) return;

    setIsImporting(true);

    try {
      const rows = parsedTransactions.map((transaction) => ({
        fingerprint: buildImportFingerprint({
          accountId: account.id,
          fitId: transaction.fitId ?? null,
          date: transaction.date,
          type: transaction.type,
          amount: transaction.amount,
          description: transaction.description,
        }),
        payload: {
          bank_account_id: account.id,
          description: transaction.description,
          amount: transaction.amount,
          transaction_type: transaction.type,
          category: transaction.category || 'Outros',
          transaction_date: transaction.date,
          reference_type: 'statement_import',
        },
      }));

      const existing = new Set<string>();
      const { data: existingRows } = await supabase
        .from('bank_transactions')
        .select('import_fingerprint')
        .eq('bank_account_id', account.id)
        .in('import_fingerprint', rows.map((r) => r.fingerprint));
      ((existingRows ?? []) as Array<{ import_fingerprint: string | null }>).forEach((r) => {
        if (r.import_fingerprint) existing.add(r.import_fingerprint);
      });

      const { toInsert, duplicates } = dedupeByFingerprint(rows, existing);

      let imported = 0;
      if (toInsert.length > 0) {
        const payloads = toInsert.map((r) => ({ ...r.payload, import_fingerprint: r.fingerprint }));
        const { error } = await supabase.from('bank_transactions').insert(payloads as never);
        if (error) {
          // Corrida com outra importação: a unicidade do índice parcial já protegeu.
          if (/duplicate key|unique constraint/i.test(error.message)) {
            toast({
              title: 'Extrato já sincronizado',
              description: 'Os lançamentos já haviam sido gravados.',
            });
            setStep('complete');
            onSyncComplete();
            return;
          }
          throw error;
        }
        imported = toInsert.length;
      }

      toast({
        title: imported === 0 ? 'Extrato já sincronizado' : 'Importação concluída',
        description: summarizeImport(imported, duplicates),
      });

      setStep('complete');
      onSyncComplete();

    } catch (error) {
      console.error('Erro ao importar transações:', error);
      toast({
        title: "Erro",
        description: error instanceof Error ? error.message : "Erro ao importar transações",
        variant: "destructive"
      });
    } finally {
      setIsImporting(false);
    }
  };


  const downloadSampleCSV = () => {
    const csvContent = [
      'Data;Descrição;Valor',
      '01/01/2024;Transferência PIX Recebida - João Silva;1500.00',
      '02/01/2024;Compra Débito - Supermercado XYZ;-250.50',
      '03/01/2024;TED Enviada - Maria Santos;-800.00',
      '05/01/2024;Pagamento Salário;4500.00',
      '10/01/2024;Tarifa Pacote Serviços;-29.90',
      '15/01/2024;Compra Cartão Débito - Posto de Gasolina;-180.00',
      '20/01/2024;PIX Recebido - Cliente ABC LTDA;2300.00',
      '25/01/2024;Saque ATM;-200.00'
    ].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    
    link.setAttribute('href', url);
    link.setAttribute('download', 'modelo_extrato_bancario.csv');
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);

    toast({
      title: "Modelo baixado",
      description: "Arquivo CSV modelo foi baixado com sucesso"
    });
  };

  // Fetch system transactions for the account
  // NOTE: "Sistema" inclui lançamentos já existentes em bank_transactions e também despesas registradas
  // em outras telas (ex: despesas de eventos/empresa) que ainda não viraram bank_transactions.
  const fetchSystemTransactions = async () => {
    setIsLoadingSystem(true);

    const normalizeName = (value: string) => value.trim().toLowerCase();
    const accountNameNorm = normalizeName(account.name);

    try {
      const [bankTxRes, eventExpensesRes, companyExpensesRes] = await Promise.all([
        supabase
          .from('bank_transactions')
          .select('*')
          .eq('bank_account_id', account.id)
          .order('transaction_date', { ascending: false }),

        // Despesas de eventos (salvas por nome da conta)
        supabase
          .from('event_expenses')
          .select('id,event_id,description,category,total_price,expense_date,created_at,expense_bank_account')
          .not('expense_bank_account', 'is', null)
          .neq('expense_bank_account', '')
          .order('expense_date', { ascending: false })
          .limit(1000),

        // Despesas da empresa (salvas por nome da conta)
        supabase
          .from('company_expenses')
          .select('id,description,category,total_price,expense_date,created_at,expense_bank_account')
          .not('expense_bank_account', 'is', null)
          .neq('expense_bank_account', '')
          .order('expense_date', { ascending: false })
          .limit(1000),
      ]);

      if (bankTxRes.error) throw bankTxRes.error;
      if (eventExpensesRes.error) throw eventExpensesRes.error;
      if (companyExpensesRes.error) throw companyExpensesRes.error;

      const bankTxData = bankTxRes.data || [];

      // Para evitar duplicar despesas já sincronizadas em bank_transactions
      const existingRefs = new Set(
        bankTxData
          .filter((t: any) => t.reference_type && t.reference_id)
          .map((t: any) => `${t.reference_type}:${t.reference_id}`)
      );

      const mappedBankTx: SystemTransaction[] = bankTxData.map((t: any) => ({
        id: t.id,
        date: t.transaction_date,
        description: t.description,
        amount: t.amount,
        type: t.transaction_type as 'income' | 'expense',
        category: t.category,
        balanceAfter: typeof t.balance_after === 'number' ? t.balance_after : undefined,
      }));

      const eventExpenses = (eventExpensesRes.data || [])
        .filter((e: any) => normalizeName(e.expense_bank_account || '') === accountNameNorm)
        .filter((e: any) => !existingRefs.has(`expense:${e.id}`))
        .filter((e: any) => typeof e.total_price === 'number' && e.total_price > 0)
        .map((e: any): SystemTransaction => ({
          id: `event_expense:${e.id}`,
          date: e.expense_date ? formatDateToISO(e.expense_date) : formatDateToISO(e.created_at),
          description: e.description || 'Despesa de evento',
          amount: e.total_price,
          type: 'expense',
          category: e.category || 'Despesas Evento',
        }));

      const companyExpenses = (companyExpensesRes.data || [])
        .filter((e: any) => normalizeName(e.expense_bank_account || '') === accountNameNorm)
        // Filtrar despesas da empresa que já existem em bank_transactions (evita duplicação)
        .filter((e: any) => !existingRefs.has(`company_expense:${e.id}`))
        .filter((e: any) => typeof e.total_price === 'number' && e.total_price > 0)
        .map((e: any): SystemTransaction => ({
          id: `company_expense:${e.id}`,
          date: e.expense_date ? formatDateToISO(e.expense_date) : formatDateToISO(e.created_at),
          description: e.description || 'Despesa da empresa',
          amount: e.total_price,
          type: 'expense',
          category: e.category || 'Despesas Empresa',
        }));

      const merged = [...mappedBankTx, ...eventExpenses, ...companyExpenses].sort((a, b) =>
        (b.date || '').localeCompare(a.date || '')
      );

      setSystemTransactions(merged);
      return merged;
    } catch (error) {
      console.error('Erro ao buscar transações do sistema:', error);
      toast({
        title: 'Erro',
        description: 'Erro ao buscar transações do sistema',
        variant: 'destructive',
      });
      return [];
    } finally {
      setIsLoadingSystem(false);
    }
  };

  // Perform reconciliation between imported and system transactions
  // Helper function to check description similarity
  const areDescriptionsSimilar = (desc1: string, desc2: string): boolean => {
    const normalize = (s: string) => s.toLowerCase().trim().replace(/\s+/g, ' ');
    const n1 = normalize(desc1);
    const n2 = normalize(desc2);
    
    // Exact match
    if (n1 === n2) return true;
    
    // One contains the other
    if (n1.includes(n2) || n2.includes(n1)) return true;
    
    // Check first significant words (at least 3 words or 15 chars match)
    const words1 = n1.split(' ').filter(w => w.length > 2);
    const words2 = n2.split(' ').filter(w => w.length > 2);
    
    // Check if first 3 significant words match
    const firstWords1 = words1.slice(0, 3).join(' ');
    const firstWords2 = words2.slice(0, 3).join(' ');
    
    if (firstWords1 && firstWords2 && (firstWords1.startsWith(firstWords2) || firstWords2.startsWith(firstWords1))) {
      return true;
    }
    
    // Check prefix match (first 20 chars)
    if (n1.substring(0, 20) === n2.substring(0, 20) && n1.length >= 15 && n2.length >= 15) {
      return true;
    }
    
    // Detectar transferências entre contas - verificar se ambas descrevem a mesma operação
    // Ex: "Pix enviado para Letra 3D line tape" vs "Transferência para ITAU Letra 3D line tape"
    const transferKeywords = ['pix', 'transferência', 'transferencia', 'ted', 'enviado', 'recebido'];
    const hasTransferKeyword1 = transferKeywords.some(kw => n1.includes(kw));
    const hasTransferKeyword2 = transferKeywords.some(kw => n2.includes(kw));
    
    if (hasTransferKeyword1 && hasTransferKeyword2) {
      // Extrair possíveis nomes de contas/destinos das descrições
      // Palavras significativas com 4+ caracteres que não são palavras comuns
      const commonWords = new Set(['para', 'de', 'pix', 'ted', 'transferência', 'transferencia', 'enviado', 'recebido', 'banco', 'conta', 'line', 'tape']);
      
      const getSignificantWords = (text: string) => 
        text.split(/[\s/-]+/)
          .filter(w => w.length >= 3 && !commonWords.has(w))
          .slice(0, 5);
      
      const sigWords1 = getSignificantWords(n1);
      const sigWords2 = getSignificantWords(n2);
      
      // Se pelo menos 1 palavra significativa aparecer em ambas, considerar match
      const hasCommonWord = sigWords1.some(w1 => 
        sigWords2.some(w2 => w1.includes(w2) || w2.includes(w1))
      );
      
      if (hasCommonWord) {
        return true;
      }
    }
    
    return false;
  };

  const performReconciliation = async () => {
    const sysTxns = await fetchSystemTransactions();
    
    const rows: ReconciliationRow[] = [];
    const usedSystemIds = new Set<string>();
    const usedImportedIndices = new Set<number>();

    // First pass: find matches requiring date + amount (description similarity is optional)
    // Matching por data e valor absoluto - independente da descrição
    parsedTransactions.forEach((imported, idx) => {
      const match = sysTxns.find(sys => {
        if (usedSystemIds.has(sys.id)) return false;

        const sameDate = sys.date === imported.date;
        if (!sameDate) return false;

        // Check amount match (valor absoluto)
        const importedAbsAmount = Math.abs(imported.amount);
        const sysAbsAmount = Math.abs(sys.amount);
        const sameAmount = Math.abs(sysAbsAmount - importedAbsAmount) < 0.01;
        
        // Se data e valor são iguais, considera match
        return sameAmount;
      });

      if (match) {
        usedSystemIds.add(match.id);
        usedImportedIndices.add(idx);
        rows.push({
          imported,
          system: match,
          matched: true
        });
      }
    });

    // Second pass: add unmatched imported
    parsedTransactions.forEach((imported, idx) => {
      if (!usedImportedIndices.has(idx)) {
        rows.push({
          imported,
          system: null,
          matched: false
        });
      }
    });

    // Third pass: add unmatched system transactions
    sysTxns.forEach(sys => {
      if (!usedSystemIds.has(sys.id)) {
        rows.push({
          imported: null,
          system: sys,
          matched: false
        });
      }
    });

    // Sort by date (most recent first)
    rows.sort((a, b) => {
      const dateA = a.imported?.date || a.system?.date || '';
      const dateB = b.imported?.date || b.system?.date || '';
      return dateB.localeCompare(dateA);
    });

    setReconciliationData(rows);
    setStep('reconciliation');
  };

  // Toggle selection for import
  const toggleSelectForImport = (index: number) => {
    setSelectedForImport(prev => {
      const newSet = new Set(prev);
      if (newSet.has(index)) {
        newSet.delete(index);
      } else {
        newSet.add(index);
      }
      return newSet;
    });
  };

  // Select all importable transactions
  const selectAllImportable = () => {
    const importableIndices = reconciliationData
      .map((row, idx) => ({ row, idx }))
      .filter(({ row }) => row.imported && !row.system)
      .map(({ idx }) => idx);
    
    if (selectedForImport.size === importableIndices.length) {
      setSelectedForImport(new Set());
    } else {
      setSelectedForImport(new Set(importableIndices));
    }
  };

  // Get transactions selected for import
  const getSelectedTransactions = () => {
    return Array.from(selectedForImport)
      .map(idx => reconciliationData[idx])
      .filter(row => row.imported && !row.system)
      .map(row => row.imported!);
  };

  // Open import dialog for selected transactions
  const openImportDialog = () => {
    if (selectedForImport.size === 0) {
      toast({
        title: "Atenção",
        description: "Selecione pelo menos uma transação para importar",
        variant: "destructive"
      });
      return;
    }
    setIsImportDialogOpen(true);
  };

  const handleParentOpenChange = (open: boolean) => {
    if (open) return;
    if (isImportDialogOpen || suppressParentCloseRef.current) return;
    handleClose();
  };

  const handleImportDialogOpenChange = (open: boolean) => {
    if (!open) {
      suppressParentCloseRef.current = true;
      window.setTimeout(() => {
        suppressParentCloseRef.current = false;
      }, 350);
    }
    setIsImportDialogOpen(open);
  };

  // Handle import completion - update rows in place without re-sorting/re-scrolling
  const handleImportComplete = async () => {
    // Preserve scroll position of the reconciliation ScrollArea
    const scrollViewport = document.querySelector<HTMLElement>(
      '[data-reconciliation-scroll] [data-radix-scroll-area-viewport]'
    );
    const savedScrollTop = scrollViewport?.scrollTop ?? 0;

    const sysTxns = await fetchSystemTransactions();
    const usedSystemIds = new Set<string>();

    setReconciliationData(prev => {
      // First, preserve already-matched pairs
      prev.forEach(r => {
        if (r.matched && r.system) usedSystemIds.add(r.system.id);
      });

      // Try to match unmatched imported rows against new system txns
      const updated: ReconciliationRow[] = prev.map(row => {
        if (row.matched) return row;
        if (row.imported && !row.system) {
          const match = sysTxns.find(sys => {
            if (usedSystemIds.has(sys.id)) return false;
            if (sys.date !== row.imported!.date) return false;
            return Math.abs(Math.abs(sys.amount) - Math.abs(row.imported!.amount)) < 0.01;
          });
          if (match) {
            usedSystemIds.add(match.id);
            return { imported: row.imported, system: match, matched: true };
          }
        }
        return row;
      });

      // Append any brand-new system-only rows that weren't in the previous list
      const prevSystemIds = new Set(
        prev.map(r => r.system?.id).filter(Boolean) as string[]
      );
      sysTxns.forEach(sys => {
        if (!usedSystemIds.has(sys.id) && !prevSystemIds.has(sys.id)) {
          updated.push({ imported: null, system: sys, matched: false });
        }
      });

      return updated;
    });

    setSelectedForImport(new Set());

    await onDataRefresh?.();

    // Restore scroll position after DOM updates
    requestAnimationFrame(() => {
      if (scrollViewport) scrollViewport.scrollTop = savedScrollTop;
    });

    // Segundo refresh após ~800ms para captar linhas criadas por triggers do banco
    // (ex.: bank_transactions vinculadas a event_expenses/recurring_expense_monthly_payments).
    // Sem isso, os cards de Receitas/Despesas/Resultado podem ficar zerados até
    // uma navegação/remontagem manual.
    window.setTimeout(() => {
      onDataRefresh?.();
    }, 900);
    // Don't call onSyncComplete() here to keep user on reconciliation page

  };

  // Generate PDF for reconciliation
  const generateReconciliationPDF = async () => {
    const doc = new jsPDF({ orientation: 'landscape' });
    
    // Company Header with Logo
    let yPos = 15;
    let textStartX = 14;
    
    // Add logo if available
    if (logoUrl) {
      try {
        const img = new Image();
        img.crossOrigin = 'anonymous';
        await new Promise<void>((resolve, reject) => {
          img.onload = () => resolve();
          img.onerror = () => reject();
          img.src = logoUrl;
        });
        
        // Calculate logo dimensions (max height 20mm)
        const maxHeight = 20;
        const ratio = img.width / img.height;
        const logoHeight = maxHeight;
        const logoWidth = logoHeight * ratio;
        
        doc.addImage(img, 'PNG', 14, 10, logoWidth, logoHeight);
        textStartX = 14 + logoWidth + 5;
      } catch (error) {
        console.error('Error loading logo for PDF:', error);
      }
    }
    
    doc.setFontSize(18);
    doc.setTextColor(59, 130, 246); // Blue
    doc.text(companySettings?.company_name || 'Empresa', textStartX, yPos);
    
    if (companySettings?.tagline) {
      yPos += 6;
      doc.setFontSize(10);
      doc.setTextColor(100, 100, 100);
      doc.text(companySettings.tagline, textStartX, yPos);
    }
    
    // Company contact info on the right
    doc.setFontSize(8);
    doc.setTextColor(80, 80, 80);
    let rightY = 15;
    if (companySettings?.cnpj) {
      doc.text(`CNPJ: ${companySettings.cnpj}`, 280, rightY, { align: 'right' });
      rightY += 4;
    }
    if (companySettings?.phone) {
      doc.text(`Tel: ${companySettings.phone}`, 280, rightY, { align: 'right' });
      rightY += 4;
    }
    if (companySettings?.email) {
      doc.text(`Email: ${companySettings.email}`, 280, rightY, { align: 'right' });
      rightY += 4;
    }
    if (companySettings?.address) {
      doc.text(companySettings.address, 280, rightY, { align: 'right' });
    }
    
    // Separator line
    yPos = logoUrl ? 35 : yPos + 8;
    doc.setDrawColor(200, 200, 200);
    doc.line(14, yPos, 280, yPos);
    
    // Report title
    yPos += 8;
    doc.setFontSize(14);
    doc.setTextColor(0, 0, 0);
    doc.text(`Comparação de Extrato - ${account.name}`, 14, yPos);
    
    yPos += 6;
    doc.setFontSize(10);
    doc.setTextColor(80, 80, 80);
    doc.text(`Data do Relatório: ${new Date().toLocaleDateString('pt-BR')}`, 14, yPos);
    
    // Summary with colors
    yPos += 8;
    const matched = reconciliationData.filter(r => r.matched).length;
    const onlyImported = reconciliationData.filter(r => r.imported && !r.system).length;
    const onlySystem = reconciliationData.filter(r => !r.imported && r.system).length;
    
    doc.setFontSize(9);
    doc.setTextColor(34, 197, 94); // Green
    doc.text(`Coincidentes: ${matched}`, 14, yPos);
    doc.setTextColor(59, 130, 246); // Blue
    doc.text(`Só Extrato: ${onlyImported}`, 70, yPos);
    doc.setTextColor(249, 115, 22); // Orange
    doc.text(`Só Sistema: ${onlySystem}`, 120, yPos);
    
    // Table data with row colors
    const tableData = reconciliationData.map(row => [
      row.imported ? new Date(row.imported.date + 'T12:00:00').toLocaleDateString('pt-BR') : '—',
      row.imported?.description || '—',
      row.imported ? `${row.imported.type === 'expense' ? '-' : ''}R$ ${row.imported.amount.toFixed(2).replace('.', ',')}` : '—',
      row.imported?.balanceAfter !== undefined ? `R$ ${row.imported.balanceAfter.toFixed(2).replace('.', ',')}` : '—',
      row.matched ? '✓ Coincide' : (row.imported && !row.system ? 'Só Extrato' : '—'),
      row.system ? new Date(row.system.date + 'T12:00:00').toLocaleDateString('pt-BR') : '—',
      row.system?.description || '—',
      row.system ? `${row.system.type === 'expense' ? '-' : ''}R$ ${row.system.amount.toFixed(2).replace('.', ',')}` : '—',
      row.system?.balanceAfter !== undefined ? `R$ ${row.system.balanceAfter.toFixed(2).replace('.', ',')}` : '—',
      row.matched ? '✓ Coincide' : (!row.imported && row.system ? 'Só Sistema' : '—'),
    ]);
    
    autoTable(doc, {
      startY: yPos + 5,
      head: [[
        { content: 'Data', styles: { fillColor: [59, 130, 246] } },
        { content: 'Descrição Extrato', styles: { fillColor: [59, 130, 246] } },
        { content: 'Valor', styles: { fillColor: [59, 130, 246] } },
        { content: 'Saldo', styles: { fillColor: [59, 130, 246] } },
        { content: 'Status', styles: { fillColor: [59, 130, 246] } },
        { content: 'Data', styles: { fillColor: [249, 115, 22] } },
        { content: 'Descrição Sistema', styles: { fillColor: [249, 115, 22] } },
        { content: 'Valor', styles: { fillColor: [249, 115, 22] } },
        { content: 'Saldo', styles: { fillColor: [249, 115, 22] } },
        { content: 'Status', styles: { fillColor: [249, 115, 22] } },
      ]],
      body: tableData,
      styles: { fontSize: 7, cellPadding: 2 },
      headStyles: { textColor: 255, fontSize: 7 },
      columnStyles: {
        0: { cellWidth: 16 },
        1: { cellWidth: 40 },
        2: { cellWidth: 22 },
        3: { cellWidth: 22 },
        4: { cellWidth: 18 },
        5: { cellWidth: 16 },
        6: { cellWidth: 40 },
        7: { cellWidth: 22 },
        8: { cellWidth: 22 },
        9: { cellWidth: 18 },
      },
      didParseCell: (data) => {
        if (data.section === 'body') {
          const rowIndex = data.row.index;
          const row = reconciliationData[rowIndex];
          
          // Background color for matched rows
          if (row?.matched) {
            data.cell.styles.fillColor = [220, 252, 231]; // Light green
          }
          
          // Value columns - imported (column 2) and system (column 7)
          if (data.column.index === 2 && row?.imported) {
            if (row.imported.type === 'expense') {
              data.cell.styles.textColor = [220, 38, 38]; // Red
            } else {
              data.cell.styles.textColor = [22, 163, 74]; // Green
            }
          }
          if (data.column.index === 7 && row?.system) {
            if (row.system.type === 'expense') {
              data.cell.styles.textColor = [220, 38, 38]; // Red
            } else {
              data.cell.styles.textColor = [22, 163, 74]; // Green
            }
          }
        }
      },
    });
    
    doc.save(`comparacao_extrato_${account.name}_${new Date().toISOString().split('T')[0]}.pdf`);
    
    toast({
      title: "PDF Gerado",
      description: "O relatório de comparação foi baixado com sucesso",
    });
  };

  const resetDialog = () => {
    setSelectedFile(null);
    setParsedTransactions([]);
    setSystemTransactions([]);
    setReconciliationData([]);
    setSelectedForImport(new Set());
    setStep('upload');
  };

  const handleClose = () => {
    resetDialog();
    onOpenChange(false);
  };

  return (
    <>
    <Dialog open={isOpen} onOpenChange={handleParentOpenChange}>
      <DialogContent
        className="max-w-[95vw] max-h-[95vh] w-[95vw] h-[90vh] overflow-auto"
        onInteractOutside={(e) => e.preventDefault()}
        onEscapeKeyDown={(e) => { if (isImportDialogOpen) e.preventDefault(); }}
      >
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Upload className="h-5 w-5" />
            Sincronizar Extrato Bancário
          </DialogTitle>
        </DialogHeader>

        {step === 'upload' && (
          <div className="space-y-4">
            <div className="p-3 bg-muted rounded-lg">
              <Label className="text-sm text-muted-foreground">Conta Bancária</Label>
              <p className="font-medium">{account.name} ({account.type === 'checking' ? 'Conta Corrente' : account.type === 'savings' ? 'Conta Poupança' : 'Dinheiro'})</p>
            </div>

            <div>
              <Label htmlFor="file">Arquivo do Extrato (.ofx, .csv, .xlsx, .xls — até 10 MB)</Label>
              <Input
                id="file"
                type="file"
                accept=".ofx,.csv,.xlsx,.xls"
                onChange={handleFileSelect}
              />
            </div>

            <div className="p-4 border rounded-lg bg-accent/50">
              <div className="flex items-start gap-2">
                <AlertCircle className="h-4 w-4 mt-0.5 text-muted-foreground" />
                <div className="flex-1">
                  <p className="text-sm font-medium mb-2">
                    Formato do arquivo CSV
                  </p>
                  <p className="text-xs text-muted-foreground mb-2">
                    O arquivo deve conter as colunas: <strong>Data</strong>, <strong>Descrição</strong> e <strong>Valor</strong>
                  </p>
                  <Button 
                    variant="outline" 
                    size="sm"
                    onClick={downloadSampleCSV}
                    className="mt-2"
                  >
                    Baixar Modelo CSV
                  </Button>
                </div>
              </div>
            </div>

            {selectedFile && (
              <div className="p-4 border rounded-lg bg-muted/50">
                <p className="text-sm">
                  <strong>Arquivo:</strong> {selectedFile.name}
                </p>
                <p className="text-sm text-muted-foreground mt-1">
                  Certifique-se que o arquivo contém colunas para Data, Descrição e Valor
                </p>
              </div>
            )}

            <div className="flex gap-2 justify-end">
              <Button variant="outline" onClick={handleClose}>
                Cancelar
              </Button>
              <Button 
                onClick={processFile} 
                disabled={!selectedFile || isProcessing}
              >
                {isProcessing ? "Processando..." : "Processar Arquivo"}
              </Button>
            </div>
          </div>
        )}

        {step === 'preview' && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-semibold">
                Preview das Transações ({parsedTransactions.length})
              </h3>
              <Button variant="outline" onClick={() => setStep('upload')}>
                Voltar
              </Button>
            </div>

            {parsedTransactions.length === 0 ? (
              <div className="text-center py-8 space-y-4">
                <AlertCircle className="h-12 w-12 text-muted-foreground mx-auto" />
                <div>
                  <h4 className="text-lg font-medium">Nenhuma transação encontrada</h4>
                  <p className="text-muted-foreground">
                    Verifique se o arquivo contém as colunas: Data, Descrição e Valor
                  </p>
                  <p className="text-sm text-muted-foreground mt-2">
                    Formatos aceitos: DD/MM/AAAA para datas, valores com vírgula ou ponto decimal
                  </p>
                </div>
                <Button variant="outline" onClick={() => setStep('upload')}>
                  Tentar Outro Arquivo
                </Button>
              </div>
            ) : (
              <>
                <div className="bg-muted/50 p-4 rounded-lg">
                  <p className="text-sm">
                    <strong>Resumo:</strong> {parsedTransactions.length} transações encontradas
                  </p>
                  <p className="text-sm text-muted-foreground">
                    Verifique se os dados estão corretos antes de importar
                  </p>
                </div>

                <ScrollArea className="h-[400px]">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Data</TableHead>
                        <TableHead>Descrição</TableHead>
                        <TableHead>Tipo</TableHead>
                        <TableHead>Categoria</TableHead>
                        <TableHead className="text-right">Valor</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {parsedTransactions.map((transaction, index) => (
                        <TableRow key={index}>
                          <TableCell>
                            {new Date(transaction.date + 'T12:00:00').toLocaleDateString('pt-BR')}
                          </TableCell>
                          <TableCell className="max-w-[200px] truncate" title={transaction.description}>
                            {transaction.description}
                          </TableCell>
                          <TableCell>
                            <Badge variant={transaction.type === 'income' ? 'default' : 'secondary'}>
                              {transaction.type === 'income' ? 'Entrada' : 'Saída'}
                            </Badge>
                          </TableCell>
                          <TableCell>{transaction.category}</TableCell>
                          <TableCell className="text-right">
                            <span className={transaction.type === 'income' ? 'text-green-600' : 'text-red-600'}>
                              R$ {transaction.amount.toFixed(2).replace('.', ',')}
                            </span>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </ScrollArea>

                <div className="flex gap-2 justify-end">
                  <Button variant="outline" onClick={() => setStep('upload')}>
                    Voltar
                  </Button>
                  <Button 
                    variant="secondary"
                    onClick={performReconciliation}
                    disabled={isLoadingSystem}
                  >
                    {isLoadingSystem ? "Carregando..." : "Comparar com Sistema"}
                  </Button>
                </div>
              </>
            )}
          </div>
        )}

        {step === 'reconciliation' && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-semibold">
                Comparação: Importado vs Sistema
              </h3>
              <Button variant="outline" onClick={() => setStep('preview')}>
                Voltar
              </Button>
            </div>

            <div className="grid grid-cols-3 gap-4 text-sm">
              <div className="bg-green-100 dark:bg-green-900/30 p-3 rounded-lg text-center">
                <p className="font-semibold text-green-700 dark:text-green-400">
                  {reconciliationData.filter(r => r.matched).length}
                </p>
                <p className="text-green-600 dark:text-green-500 text-xs">Coincidentes</p>
              </div>
              <div className="bg-blue-100 dark:bg-blue-900/30 p-3 rounded-lg text-center">
                <p className="font-semibold text-blue-700 dark:text-blue-400">
                  {reconciliationData.filter(r => r.imported && !r.system).length}
                </p>
                <p className="text-blue-600 dark:text-blue-500 text-xs">Só no Extrato</p>
              </div>
              <div className="bg-orange-100 dark:bg-orange-900/30 p-3 rounded-lg text-center">
                <p className="font-semibold text-orange-700 dark:text-orange-400">
                  {reconciliationData.filter(r => !r.imported && r.system).length}
                </p>
                <p className="text-orange-600 dark:text-orange-500 text-xs">Só no Sistema</p>
              </div>
            </div>

            {reconciliationSuggestions.length > 0 && (
              <div className="rounded-lg border border-border p-3 space-y-2">
                <div>
                  <p className="text-sm font-semibold">Sugestões de conciliação</p>
                  <p className="text-xs text-muted-foreground">
                    Baseadas em valor, data e descrição. Nada é confirmado automaticamente —
                    revise e vincule manualmente.
                  </p>
                </div>
                <ScrollArea className="max-h-48">
                  <div className="space-y-2 pr-2">
                    {reconciliationSuggestions.map(({ rowIndex, imported, suggestion }) => (
                      <div
                        key={`${rowIndex}-${suggestion.candidate.id}`}
                        className="flex flex-wrap items-center gap-2 rounded border border-border p-2 text-xs"
                      >
                        <div className="min-w-0 flex-1">
                          <p className="truncate font-medium">{imported.description}</p>
                          <p className="text-muted-foreground">
                            Extrato: {new Date(imported.date + 'T12:00:00').toLocaleDateString('pt-BR')} · R${' '}
                            {imported.amount.toFixed(2).replace('.', ',')}
                          </p>
                          <p className="truncate text-muted-foreground">
                            Sistema: {suggestion.candidate.description} ·{' '}
                            {new Date(suggestion.candidate.date + 'T12:00:00').toLocaleDateString('pt-BR')} · R${' '}
                            {suggestion.candidate.amount.toFixed(2).replace('.', ',')}
                          </p>
                          <p className="text-muted-foreground">{suggestion.reasons.join(' · ')}</p>
                        </div>
                        <Badge
                          variant={
                            suggestion.confidence === 'alta'
                              ? 'default'
                              : suggestion.confidence === 'media'
                                ? 'secondary'
                                : 'outline'
                          }
                        >
                          {suggestion.score}% {suggestion.confidence}
                        </Badge>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => linkSuggestion(rowIndex, suggestion.candidate.id)}
                        >
                          Vincular
                        </Button>
                      </div>
                    ))}
                  </div>
                </ScrollArea>
              </div>
            )}



            <ScrollArea className="h-[calc(90vh-280px)]" data-reconciliation-scroll>
              <Table>
                <TableHeader>
                  <TableRow>
                    {/* Coluna Esquerda - Transações Importadas */}
                    <TableHead className="w-[30px] bg-blue-50 dark:bg-blue-900/20">
                      <Checkbox 
                        checked={
                          reconciliationData.filter(r => r.imported && !r.system).length > 0 &&
                          selectedForImport.size === reconciliationData.filter(r => r.imported && !r.system).length
                        }
                        onCheckedChange={selectAllImportable}
                      />
                    </TableHead>
                    <TableHead className="bg-blue-50 dark:bg-blue-900/20">Data</TableHead>
                    <TableHead className="bg-blue-50 dark:bg-blue-900/20">
                      <div className="flex items-center gap-2">
                        <Upload className="h-4 w-4" />
                        Descrição (Importadas)
                      </div>
                    </TableHead>
                    <TableHead className="text-right bg-blue-50 dark:bg-blue-900/20">Valor</TableHead>
                    <TableHead className="text-right bg-blue-50 dark:bg-blue-900/20">Saldo</TableHead>
                    <TableHead className="bg-blue-50 dark:bg-blue-900/20 border-r-2">Status</TableHead>
                    {/* Coluna Direita - Transações do Sistema */}
                    <TableHead className="bg-orange-50 dark:bg-orange-900/20">Data</TableHead>
                    <TableHead className="bg-orange-50 dark:bg-orange-900/20">
                      <div className="flex items-center gap-2">
                        <Check className="h-4 w-4" />
                        Descrição (Sistema)
                      </div>
                    </TableHead>
                    <TableHead className="text-right bg-orange-50 dark:bg-orange-900/20">Valor</TableHead>
                    <TableHead className="text-right bg-orange-50 dark:bg-orange-900/20">Saldo</TableHead>
                    <TableHead className="bg-orange-50 dark:bg-orange-900/20">Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {reconciliationData.map((row, index) => {
                    const canImport = row.imported && !row.system;
                    return (
                      <TableRow 
                        key={index}
                        className={row.matched ? 'bg-green-50 dark:bg-green-900/10' : ''}
                      >
                        {/* Lado Esquerdo - Importadas */}
                        <TableCell className="h-12">
                          {canImport ? (
                            <Checkbox 
                              checked={selectedForImport.has(index)}
                              onCheckedChange={() => toggleSelectForImport(index)}
                            />
                          ) : null}
                        </TableCell>
                        <TableCell className="text-xs whitespace-nowrap h-12">
                          {row.imported 
                            ? new Date(row.imported.date + 'T12:00:00').toLocaleDateString('pt-BR')
                            : '—'
                          }
                        </TableCell>
                        <TableCell className="max-w-[180px] truncate text-sm h-12" title={row.imported?.description}>
                          {row.imported?.description || '—'}
                        </TableCell>
                        <TableCell className="text-right whitespace-nowrap h-12">
                          {row.imported ? (
                            <span className={row.imported.type === 'income' ? 'text-green-600' : 'text-red-600'}>
                              {row.imported.type === 'expense' ? '-' : ''}R$ {row.imported.amount.toFixed(2).replace('.', ',')}
                            </span>
                          ) : '—'}
                        </TableCell>
                        <TableCell className="text-right whitespace-nowrap h-12 text-xs text-muted-foreground">
                          {row.imported?.balanceAfter !== undefined 
                            ? `R$ ${row.imported.balanceAfter.toFixed(2).replace('.', ',')}`
                            : '—'
                          }
                        </TableCell>
                        <TableCell className="border-r-2 h-12">
                          {row.matched && (
                            <Badge variant="outline" className="text-green-600 border-green-600 text-xs">
                              ✓ Coincide
                            </Badge>
                          )}
                          {canImport && selectedForImport.has(index) && (
                            <Badge className="bg-blue-500 text-xs">Selecionada</Badge>
                          )}
                          {canImport && !selectedForImport.has(index) && (
                            <Badge variant="outline" className="text-blue-600 border-blue-600 text-xs">
                              Só Extrato
                            </Badge>
                          )}
                          {!row.imported && (
                            <span className="text-muted-foreground text-xs">—</span>
                          )}
                        </TableCell>
                        {/* Lado Direito - Sistema */}
                        <TableCell className="text-xs whitespace-nowrap h-12">
                          {row.system 
                            ? new Date(row.system.date + 'T12:00:00').toLocaleDateString('pt-BR')
                            : '—'
                          }
                        </TableCell>
                        <TableCell className="max-w-[180px] truncate text-sm h-12" title={row.system?.description}>
                          {row.system?.description || '—'}
                        </TableCell>
                        <TableCell className="text-right whitespace-nowrap h-12">
                          {row.system ? (
                            <span className={row.system.type === 'income' ? 'text-green-600' : 'text-red-600'}>
                              {row.system.type === 'expense' ? '-' : ''}R$ {row.system.amount.toFixed(2).replace('.', ',')}
                            </span>
                          ) : '—'}
                        </TableCell>
                        <TableCell className="text-right whitespace-nowrap h-12 text-xs text-muted-foreground">
                          {row.system?.balanceAfter !== undefined 
                            ? `R$ ${row.system.balanceAfter.toFixed(2).replace('.', ',')}`
                            : '—'
                          }
                        </TableCell>
                        <TableCell className="h-12">
                          {row.matched && (
                            <Badge variant="outline" className="text-green-600 border-green-600 text-xs">
                              ✓ Coincide
                            </Badge>
                          )}
                          {!row.imported && row.system && (
                            <Badge variant="outline" className="text-orange-600 border-orange-600 text-xs">
                              Só Sistema
                            </Badge>
                          )}
                          {!row.system && (
                            <span className="text-muted-foreground text-xs">—</span>
                          )}
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </ScrollArea>

            <div className="flex items-center justify-between">
              <div className="text-sm text-muted-foreground">
                {selectedForImport.size > 0 && (
                  <span className="font-medium text-blue-600">
                    {selectedForImport.size} transação(ões) selecionada(s)
                  </span>
                )}
              </div>
              <div className="flex gap-2">
                <Button variant="outline" onClick={generateReconciliationPDF}>
                  <FileText className="h-4 w-4 mr-2" />
                  PDF
                </Button>
                <Button variant="outline" onClick={() => setStep('preview')}>
                  Voltar ao Preview
                </Button>
                {selectedForImport.size > 0 && (
                  <Button 
                    onClick={openImportDialog}
                    className="bg-blue-600 hover:bg-blue-700"
                  >
                    <Plus className="h-4 w-4 mr-2" />
                    Importar {selectedForImport.size} Selecionada(s)
                  </Button>
                )}
                <Button onClick={handleClose}>
                  Fechar
                </Button>
              </div>
            </div>
          </div>
        )}

        {step === 'complete' && (
          <div className="text-center space-y-4">
            <div className="mx-auto w-16 h-16 bg-green-100 rounded-full flex items-center justify-center">
              <Check className="h-8 w-8 text-green-600" />
            </div>
            <div>
              <h3 className="text-lg font-semibold">Importação Concluída!</h3>
              <p className="text-muted-foreground">
                {parsedTransactions.length} transações foram importadas com sucesso
              </p>
            </div>
            <Button onClick={handleClose}>
              Fechar
            </Button>
          </div>
        )}
      </DialogContent>
    </Dialog>

    {/* Import Transaction Dialog - rendered outside the parent Dialog to prevent closing issues */}
    <ImportTransactionDialog
      isOpen={isImportDialogOpen}
      onOpenChange={handleImportDialogOpenChange}
      transactions={getSelectedTransactions()}
      accountId={account.id}
      onImportComplete={handleImportComplete}
    />
  </>
  );
};
