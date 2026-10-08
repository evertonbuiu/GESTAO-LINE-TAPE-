import React from 'react';
import { OpenFinanceConnection } from '@/components/OpenFinanceConnection';

/**
 * Conexão bancária direta do C6 Bank. Credenciais e certificado mTLS ficam
 * somente nas Edge Functions do Supabase.
 */
export const BankRealTimeSync = () => <OpenFinanceConnection />;

export default BankRealTimeSync;
