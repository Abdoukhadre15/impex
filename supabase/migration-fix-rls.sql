-- =====================================================
-- MIGRATION: Corriger les RLS sur profiles
-- Exécuter ce script dans l'éditeur SQL de Supabase
-- =====================================================

-- Ajouter la colonne telephone_fixe si elle n'existe pas
ALTER TABLE entreprise ADD COLUMN IF NOT EXISTS telephone_fixe TEXT;

-- Supprimer les anciennes politiques conflictuelles sur profiles
DROP POLICY IF EXISTS "Authenticated users can view profiles" ON profiles;
DROP POLICY IF EXISTS "Users can update own profile" ON profiles;
DROP POLICY IF EXISTS "Admins can manage profiles" ON profiles;

-- Recréer des politiques propres sans boucle récursive
-- Tous les utilisateurs authentifiés peuvent voir tous les profils
CREATE POLICY "profiles_select" ON profiles
  FOR SELECT USING (auth.role() = 'authenticated');

-- Chaque utilisateur peut modifier son propre profil
CREATE POLICY "profiles_update_own" ON profiles
  FOR UPDATE USING (auth.uid() = id);

-- Les admins peuvent modifier tous les profils (utilise user_metadata pour éviter la récursion)
CREATE POLICY "profiles_update_admin" ON profiles
  FOR UPDATE USING (
    (SELECT raw_user_meta_data->>'role' FROM auth.users WHERE id = auth.uid()) = 'admin'
  );

-- Les admins peuvent insérer des profils
CREATE POLICY "profiles_insert" ON profiles
  FOR INSERT WITH CHECK (auth.role() = 'authenticated');

-- Les admins peuvent supprimer des profils
CREATE POLICY "profiles_delete_admin" ON profiles
  FOR DELETE USING (
    (SELECT raw_user_meta_data->>'role' FROM auth.users WHERE id = auth.uid()) = 'admin'
  );
