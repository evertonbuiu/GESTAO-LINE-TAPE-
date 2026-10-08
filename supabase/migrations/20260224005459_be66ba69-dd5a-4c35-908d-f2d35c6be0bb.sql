
-- Inserir transações bancárias para as diárias do João Marcelo e Daniel Batista que estão no extrato do C6 Bank
INSERT INTO bank_transactions (description, amount, transaction_date, transaction_type, bank_account_id, reference_type, reference_id, category)
VALUES 
  ('Diária - JOAO MARCELO CRUZ (15 anos giovanna lenini )', 275, '2026-02-05', 'expense', 'cda74c16-6ac1-4247-b323-6ebe5f22ce71', 'daily_rate', '07973e48-397d-4a61-9de7-fc5aff699ad3', 'Diárias'),
  ('Diária - DANIEL BATISTA (15 anos giovanna lenini )', 275, '2026-02-05', 'expense', 'cda74c16-6ac1-4247-b323-6ebe5f22ce71', 'daily_rate', 'a052c491-459d-4b06-bb0e-48d91504b480', 'Diárias');
