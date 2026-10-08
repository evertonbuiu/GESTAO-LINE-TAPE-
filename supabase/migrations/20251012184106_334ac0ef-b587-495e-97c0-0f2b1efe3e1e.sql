-- Remover as 3 despesas duplicadas de "vale Zé Reinaldo" de 11/10/2025
DELETE FROM public.event_expenses 
WHERE id IN (
  '17e9b85f-f477-4285-8bda-d8a10b016b5d',
  '7cf70b89-04be-4ea9-b2e7-2362ec6d424d',
  'bc525ab3-b468-4eb7-be94-e8784f6dea96'
);