-- ============================================================
-- SSAT & SAT Vocab Mastery - Complete Supabase Database Schema
-- ============================================================
-- Paste this entire script into your Supabase SQL Editor to set up
-- complete per-user data isolation, tables, RLS policies, and triggers.

-- 1. Profiles Table (extends Supabase auth.users)
CREATE TABLE IF NOT EXISTS public.profiles (
  id UUID REFERENCES auth.users ON DELETE CASCADE PRIMARY KEY,
  username TEXT UNIQUE NOT NULL,
  is_pro BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS is_pro BOOLEAN DEFAULT false;

-- 2. User Word Statuses (Mastered / Review)
CREATE TABLE IF NOT EXISTS public.user_word_statuses (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
  word_name TEXT NOT NULL,
  status TEXT CHECK (status IN ('mastered', 'review')) NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, word_name)
);

-- 3. User Marked (Starred) Words
CREATE TABLE IF NOT EXISTS public.user_marked_words (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
  word_name TEXT NOT NULL,
  marked BOOLEAN DEFAULT true,
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, word_name)
);

-- 4. User Custom Study Sets
CREATE TABLE IF NOT EXISTS public.user_study_sets (
  id UUID PRIMARY KEY,
  user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
  name TEXT NOT NULL,
  word_names TEXT[] NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 5. User Preferences & Settings
CREATE TABLE IF NOT EXISTS public.user_preferences (
  user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE PRIMARY KEY,
  theme TEXT DEFAULT 'light',
  show_default_vocab BOOLEAN DEFAULT true,
  show_sat_vocab BOOLEAN DEFAULT false,
  last_study_mode TEXT DEFAULT 'all',
  last_active_set_id TEXT,
  last_card_index INTEGER DEFAULT 0,
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 6. User Custom Vocabulary (AI-generated or added)
CREATE TABLE IF NOT EXISTS public.user_custom_vocab (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
  word_name TEXT NOT NULL,
  data JSONB NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, word_name)
);

-- 7. User Daily Exercise Progress & Streaks
CREATE TABLE IF NOT EXISTS public.user_daily_progress (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
  date DATE NOT NULL,
  word_names TEXT[] NOT NULL DEFAULT '{}',
  completed BOOLEAN DEFAULT false,
  completed_at TIMESTAMPTZ,
  progress JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, date)
);

-- ============================================================
-- Enable Row Level Security (RLS) on ALL Tables
-- ============================================================
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_word_statuses ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_marked_words ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_study_sets ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_preferences ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_custom_vocab ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_daily_progress ENABLE ROW LEVEL SECURITY;

-- ------------------------------------------------------------
-- RLS Policies for Profiles
-- ------------------------------------------------------------
DROP POLICY IF EXISTS "Users can view own profile" ON public.profiles;
CREATE POLICY "Users can view own profile" ON public.profiles FOR SELECT USING (auth.uid() = id);

DROP POLICY IF EXISTS "Users can insert own profile" ON public.profiles;
CREATE POLICY "Users can insert own profile" ON public.profiles FOR INSERT WITH CHECK (auth.uid() = id);

DROP POLICY IF EXISTS "Users can update own profile" ON public.profiles;
CREATE POLICY "Users can update own profile" ON public.profiles FOR UPDATE USING (auth.uid() = id);

-- ------------------------------------------------------------
-- RLS Policies for Word Statuses
-- ------------------------------------------------------------
DROP POLICY IF EXISTS "Users can view own word statuses" ON public.user_word_statuses;
CREATE POLICY "Users can view own word statuses" ON public.user_word_statuses FOR SELECT USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can insert own word statuses" ON public.user_word_statuses;
CREATE POLICY "Users can insert own word statuses" ON public.user_word_statuses FOR INSERT WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can update own word statuses" ON public.user_word_statuses;
CREATE POLICY "Users can update own word statuses" ON public.user_word_statuses FOR UPDATE USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can delete own word statuses" ON public.user_word_statuses;
CREATE POLICY "Users can delete own word statuses" ON public.user_word_statuses FOR DELETE USING (auth.uid() = user_id);

-- ------------------------------------------------------------
-- RLS Policies for Marked Words
-- ------------------------------------------------------------
DROP POLICY IF EXISTS "Users can view own marked words" ON public.user_marked_words;
CREATE POLICY "Users can view own marked words" ON public.user_marked_words FOR SELECT USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can insert own marked words" ON public.user_marked_words;
CREATE POLICY "Users can insert own marked words" ON public.user_marked_words FOR INSERT WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can update own marked words" ON public.user_marked_words;
CREATE POLICY "Users can update own marked words" ON public.user_marked_words FOR UPDATE USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can delete own marked words" ON public.user_marked_words;
CREATE POLICY "Users can delete own marked words" ON public.user_marked_words FOR DELETE USING (auth.uid() = user_id);

-- ------------------------------------------------------------
-- RLS Policies for Study Sets
-- ------------------------------------------------------------
DROP POLICY IF EXISTS "Users can view own study sets" ON public.user_study_sets;
CREATE POLICY "Users can view own study sets" ON public.user_study_sets FOR SELECT USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can insert own study sets" ON public.user_study_sets;
CREATE POLICY "Users can insert own study sets" ON public.user_study_sets FOR INSERT WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can update own study sets" ON public.user_study_sets;
CREATE POLICY "Users can update own study sets" ON public.user_study_sets FOR UPDATE USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can delete own study sets" ON public.user_study_sets;
CREATE POLICY "Users can delete own study sets" ON public.user_study_sets FOR DELETE USING (auth.uid() = user_id);

-- ------------------------------------------------------------
-- RLS Policies for User Preferences
-- ------------------------------------------------------------
DROP POLICY IF EXISTS "Users can view own preferences" ON public.user_preferences;
CREATE POLICY "Users can view own preferences" ON public.user_preferences FOR SELECT USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can insert own preferences" ON public.user_preferences;
CREATE POLICY "Users can insert own preferences" ON public.user_preferences FOR INSERT WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can update own preferences" ON public.user_preferences;
CREATE POLICY "Users can update own preferences" ON public.user_preferences FOR UPDATE USING (auth.uid() = user_id);

-- ------------------------------------------------------------
-- RLS Policies for Custom Vocab
-- ------------------------------------------------------------
DROP POLICY IF EXISTS "Users can view own custom vocab" ON public.user_custom_vocab;
CREATE POLICY "Users can view own custom vocab" ON public.user_custom_vocab FOR SELECT USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can insert own custom vocab" ON public.user_custom_vocab;
CREATE POLICY "Users can insert own custom vocab" ON public.user_custom_vocab FOR INSERT WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can update own custom vocab" ON public.user_custom_vocab;
CREATE POLICY "Users can update own custom vocab" ON public.user_custom_vocab FOR UPDATE USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can delete own custom vocab" ON public.user_custom_vocab;
CREATE POLICY "Users can delete own custom vocab" ON public.user_custom_vocab FOR DELETE USING (auth.uid() = user_id);

-- ------------------------------------------------------------
-- RLS Policies for Daily Progress
-- ------------------------------------------------------------
DROP POLICY IF EXISTS "Users can view own daily progress" ON public.user_daily_progress;
CREATE POLICY "Users can view own daily progress" ON public.user_daily_progress FOR SELECT USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can insert own daily progress" ON public.user_daily_progress;
CREATE POLICY "Users can insert own daily progress" ON public.user_daily_progress FOR INSERT WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can update own daily progress" ON public.user_daily_progress;
CREATE POLICY "Users can update own daily progress" ON public.user_daily_progress FOR UPDATE USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can delete own daily progress" ON public.user_daily_progress;
CREATE POLICY "Users can delete own daily progress" ON public.user_daily_progress FOR DELETE USING (auth.uid() = user_id);

-- ============================================================
-- Performance Indexes
-- ============================================================
CREATE INDEX IF NOT EXISTS idx_word_statuses_user_id ON public.user_word_statuses(user_id);
CREATE INDEX IF NOT EXISTS idx_marked_words_user_id ON public.user_marked_words(user_id);
CREATE INDEX IF NOT EXISTS idx_study_sets_user_id ON public.user_study_sets(user_id);
CREATE INDEX IF NOT EXISTS idx_custom_vocab_user_id ON public.user_custom_vocab(user_id);
CREATE INDEX IF NOT EXISTS idx_daily_progress_user_id ON public.user_daily_progress(user_id);
CREATE INDEX IF NOT EXISTS idx_daily_progress_date ON public.user_daily_progress(user_id, date);

-- ============================================================
-- Function & Trigger: Automatic Profile & Preferences Creation
-- ============================================================
CREATE OR REPLACE FUNCTION public.handle_new_user() RETURNS TRIGGER AS $$
DECLARE
  base_username TEXT;
  final_username TEXT;
  counter INTEGER := 0;
BEGIN
  -- Extract username from metadata or email
  base_username := COALESCE(
    NEW.raw_user_meta_data->>'username',
    NEW.raw_user_meta_data->>'preferred_username',
    NEW.raw_user_meta_data->>'user_name',
    NEW.raw_user_meta_data->>'name',
    NEW.raw_user_meta_data->>'full_name',
    SPLIT_PART(NEW.email, '@', 1),
    'user'
  );

  -- Clean username string
  base_username := LOWER(REGEXP_REPLACE(base_username, '[^a-zA-Z0-9._]', '', 'g'));
  IF base_username = '' THEN base_username := 'user'; END IF;
  final_username := base_username;

  -- Ensure unique username
  WHILE EXISTS (
    SELECT 1 FROM public.profiles WHERE username = final_username AND id != NEW.id
  ) LOOP
    counter := counter + 1;
    final_username := base_username || counter::TEXT;
  END LOOP;

  -- Insert profile
  INSERT INTO public.profiles (id, username, is_pro)
  VALUES (NEW.id, final_username, false)
  ON CONFLICT (id) DO UPDATE SET username = EXCLUDED.username;

  -- Initialize default preferences
  INSERT INTO public.user_preferences (
    user_id,
    theme,
    show_default_vocab,
    show_sat_vocab,
    last_study_mode,
    last_card_index
  )
  VALUES (NEW.id, 'light', true, false, 'all', 0)
  ON CONFLICT (user_id) DO NOTHING;

  RETURN NEW;
EXCEPTION WHEN OTHERS THEN
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger execution on new user signup
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
AFTER INSERT ON auth.users
FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();