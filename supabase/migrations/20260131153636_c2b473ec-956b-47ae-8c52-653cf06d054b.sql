-- Create table for NFS-e (Nota Fiscal de Serviço Eletrônica) records
CREATE TABLE public.nfse_invoices (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  invoice_number VARCHAR(20),
  rps_number VARCHAR(20) NOT NULL,
  rps_series VARCHAR(10) DEFAULT 'RPS',
  rps_type INTEGER DEFAULT 1,
  
  -- Status
  status VARCHAR(30) NOT NULL DEFAULT 'rps_generated',
  -- Possible: rps_generated, pending_transmission, transmitted, authorized, cancelled, rejected
  
  -- Dates
  issue_date TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  competence_date DATE NOT NULL DEFAULT CURRENT_DATE,
  transmitted_at TIMESTAMP WITH TIME ZONE,
  authorized_at TIMESTAMP WITH TIME ZONE,
  cancelled_at TIMESTAMP WITH TIME ZONE,
  
  -- Service Provider (Company)
  provider_cnpj VARCHAR(18) NOT NULL,
  provider_im VARCHAR(20), -- Inscrição Municipal
  provider_name VARCHAR(200) NOT NULL,
  provider_address VARCHAR(300),
  provider_city_code VARCHAR(10) DEFAULT '5208707', -- Goiânia IBGE code
  provider_state VARCHAR(2) DEFAULT 'GO',
  
  -- Service Taker (Client)
  taker_type VARCHAR(2) DEFAULT '2', -- 1=CNPJ, 2=CPF
  taker_document VARCHAR(18) NOT NULL,
  taker_name VARCHAR(200) NOT NULL,
  taker_email VARCHAR(150),
  taker_phone VARCHAR(20),
  taker_address VARCHAR(300),
  taker_city_code VARCHAR(10),
  taker_state VARCHAR(2),
  taker_cep VARCHAR(10),
  
  -- Service Details
  service_code VARCHAR(20) NOT NULL, -- Código do serviço municipal
  cnae_code VARCHAR(10), -- CNAE
  service_description TEXT NOT NULL,
  
  -- Values
  service_value NUMERIC(15,2) NOT NULL,
  deduction_value NUMERIC(15,2) DEFAULT 0,
  base_calculation NUMERIC(15,2) NOT NULL,
  iss_rate NUMERIC(5,2) DEFAULT 5.00,
  iss_value NUMERIC(15,2) NOT NULL,
  pis_value NUMERIC(15,2) DEFAULT 0,
  cofins_value NUMERIC(15,2) DEFAULT 0,
  inss_value NUMERIC(15,2) DEFAULT 0,
  ir_value NUMERIC(15,2) DEFAULT 0,
  csll_value NUMERIC(15,2) DEFAULT 0,
  other_retentions NUMERIC(15,2) DEFAULT 0,
  discount_unconditioned NUMERIC(15,2) DEFAULT 0,
  discount_conditioned NUMERIC(15,2) DEFAULT 0,
  net_value NUMERIC(15,2) NOT NULL,
  
  -- ISS Retention
  iss_retention BOOLEAN DEFAULT false,
  iss_retention_responsible INTEGER DEFAULT 1, -- 1=Prestador, 2=Tomador
  
  -- Fiscal info
  nature_operation INTEGER DEFAULT 1, -- 1=Tributação no município
  special_regime INTEGER DEFAULT 6, -- 6=MEI/Microempresa
  simple_national BOOLEAN DEFAULT true,
  cultural_incentive BOOLEAN DEFAULT false,
  
  -- XML/Protocol
  xml_rps TEXT,
  xml_nfse TEXT,
  protocol_number VARCHAR(50),
  verification_code VARCHAR(50),
  nfse_link VARCHAR(500),
  
  -- Error handling
  error_code VARCHAR(20),
  error_message TEXT,
  
  -- References
  event_id UUID REFERENCES public.events(id) ON DELETE SET NULL,
  quote_id UUID REFERENCES public.external_quotes(id) ON DELETE SET NULL,
  contract_id UUID REFERENCES public.event_contracts(id) ON DELETE SET NULL,
  
  -- Audit
  created_by UUID,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create table for certificate storage reference
CREATE TABLE public.nfse_certificates (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  certificate_name VARCHAR(200) NOT NULL,
  certificate_type VARCHAR(10) DEFAULT 'A1',
  valid_from TIMESTAMP WITH TIME ZONE,
  valid_until TIMESTAMP WITH TIME ZONE,
  issuer VARCHAR(200),
  subject_cn VARCHAR(200),
  is_active BOOLEAN DEFAULT true,
  storage_path VARCHAR(500), -- Reference to secure storage
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create table for NFS-e configuration
CREATE TABLE public.nfse_config (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  municipality_code VARCHAR(10) NOT NULL DEFAULT '5208707',
  municipality_name VARCHAR(100) DEFAULT 'Goiânia',
  state VARCHAR(2) DEFAULT 'GO',
  webservice_url VARCHAR(500) DEFAULT 'https://nfse.goiania.go.gov.br/ws/nfse.asmx',
  webservice_url_homolog VARCHAR(500) DEFAULT 'https://nfseh.goiania.go.gov.br/ws/nfse.asmx',
  abrasf_version VARCHAR(10) DEFAULT '2.04',
  environment VARCHAR(20) DEFAULT 'homologacao', -- homologacao or producao
  default_service_code VARCHAR(20),
  default_cnae VARCHAR(10),
  default_iss_rate NUMERIC(5,2) DEFAULT 5.00,
  last_rps_number INTEGER DEFAULT 0,
  rps_series VARCHAR(10) DEFAULT 'RPS',
  active_certificate_id UUID REFERENCES public.nfse_certificates(id),
  is_configured BOOLEAN DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create indexes
CREATE INDEX idx_nfse_invoices_status ON public.nfse_invoices(status);
CREATE INDEX idx_nfse_invoices_issue_date ON public.nfse_invoices(issue_date);
CREATE INDEX idx_nfse_invoices_rps_number ON public.nfse_invoices(rps_number);
CREATE INDEX idx_nfse_invoices_invoice_number ON public.nfse_invoices(invoice_number);
CREATE INDEX idx_nfse_invoices_taker_document ON public.nfse_invoices(taker_document);
CREATE INDEX idx_nfse_invoices_event_id ON public.nfse_invoices(event_id);

-- Enable RLS
ALTER TABLE public.nfse_invoices ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.nfse_certificates ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.nfse_config ENABLE ROW LEVEL SECURITY;

-- Create RLS policies
CREATE POLICY "Authenticated users can view invoices" 
ON public.nfse_invoices 
FOR SELECT 
USING (auth.role() = 'authenticated');

CREATE POLICY "Authenticated users can insert invoices" 
ON public.nfse_invoices 
FOR INSERT 
WITH CHECK (auth.role() = 'authenticated');

CREATE POLICY "Authenticated users can update invoices" 
ON public.nfse_invoices 
FOR UPDATE 
USING (auth.role() = 'authenticated');

CREATE POLICY "Authenticated users can delete invoices" 
ON public.nfse_invoices 
FOR DELETE 
USING (auth.role() = 'authenticated');

CREATE POLICY "Authenticated users can view certificates" 
ON public.nfse_certificates 
FOR SELECT 
USING (auth.role() = 'authenticated');

CREATE POLICY "Authenticated users can manage certificates" 
ON public.nfse_certificates 
FOR ALL 
USING (auth.role() = 'authenticated');

CREATE POLICY "Authenticated users can view config" 
ON public.nfse_config 
FOR SELECT 
USING (auth.role() = 'authenticated');

CREATE POLICY "Authenticated users can manage config" 
ON public.nfse_config 
FOR ALL 
USING (auth.role() = 'authenticated');

-- Create trigger for updated_at
CREATE TRIGGER update_nfse_invoices_updated_at
BEFORE UPDATE ON public.nfse_invoices
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_nfse_certificates_updated_at
BEFORE UPDATE ON public.nfse_certificates
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_nfse_config_updated_at
BEFORE UPDATE ON public.nfse_config
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Insert default configuration for Goiânia
INSERT INTO public.nfse_config (
  municipality_code,
  municipality_name,
  state,
  default_service_code,
  default_cnae,
  default_iss_rate
) VALUES (
  '5208707',
  'Goiânia',
  'GO',
  '14.05', -- Serviços de locação
  '7729300', -- Locação de equipamentos
  5.00
);