-- Limpar registros duplicados da tabela user_theme_preferences
-- Manter apenas o registro mais recente de cada usuário
DELETE FROM user_theme_preferences 
WHERE id NOT IN (
    SELECT DISTINCT ON (user_id) id 
    FROM user_theme_preferences 
    ORDER BY user_id, updated_at DESC
);

-- Adicionar constraint único para evitar duplicatas no futuro
ALTER TABLE user_theme_preferences 
ADD CONSTRAINT unique_user_theme_preferences 
UNIQUE (user_id);