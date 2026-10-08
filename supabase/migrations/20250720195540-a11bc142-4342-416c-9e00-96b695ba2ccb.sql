-- Test update to see if the columns accept data
UPDATE company_settings 
SET 
  address = 'rua 4',
  phone = '62 988343 6154',
  email = 'linetapegyn@gmail.com',
  cnpj = '42.089.948/0001-05',
  website = 'linetapegyn@gmail.com'
WHERE id = 'ac370067-98af-4204-ac10-b571079234af';