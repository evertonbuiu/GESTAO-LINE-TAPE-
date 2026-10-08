-- Remove duplicate bank_transaction created by old code before the fix
-- Keep only the trigger-generated "Vale - " transaction
DELETE FROM bank_transactions 
WHERE id = '72499670-2f04-4312-a3e1-85b4373d62b3';