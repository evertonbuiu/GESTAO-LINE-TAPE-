export interface ContractTerms {
  paymentTerms: string;
  deliveryTerms: string;
  cancellationPolicy: string;
  warrantyTerms: string;
  additionalTerms: string;
}

export interface BankAccountData {
  bankName: string;
  accountHolder: string;
  accountNumber: string;
  accountAgency: string;
  accountDocument: string;
  pixKey: string;
}
