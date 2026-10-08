-- Create table for user theme preferences
CREATE TABLE public.user_theme_preferences (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  theme TEXT NOT NULL DEFAULT 'dark',
  color_scheme TEXT NOT NULL DEFAULT 'blue',
  custom_colors JSONB,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  CONSTRAINT fk_user FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE
);

-- Enable RLS
ALTER TABLE public.user_theme_preferences ENABLE ROW LEVEL SECURITY;

-- Create policies
CREATE POLICY "Users can view own theme preferences"
  ON public.user_theme_preferences
  FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can update own theme preferences"
  ON public.user_theme_preferences
  FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can create own theme preferences"
  ON public.user_theme_preferences
  FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- Create function to handle timestamp updates
CREATE TRIGGER update_user_theme_preferences_updated_at
  BEFORE UPDATE ON public.user_theme_preferences
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();