-- =====================================================
-- SCHEMA COMPLET - IMPEX GERMANY SENEGAL
-- Application de gestion commerciale et comptable
-- =====================================================

-- Extension UUID
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- =====================================================
-- TABLE: profiles (liée à auth.users)
-- =====================================================
CREATE TABLE profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT NOT NULL,
  nom_complet TEXT NOT NULL,
  role TEXT NOT NULL DEFAULT 'vendeur' CHECK (role IN ('admin', 'vendeur', 'comptable', 'consultation')),
  telephone TEXT,
  actif BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Trigger pour créer automatiquement un profil à l'inscription
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, email, nom_complet, role)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'nom_complet', NEW.email),
    COALESCE(NEW.raw_user_meta_data->>'role', 'vendeur')
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- =====================================================
-- TABLE: entreprise (paramètres de l'entreprise)
-- =====================================================
CREATE TABLE entreprise (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  nom TEXT NOT NULL,
  raison_sociale TEXT,
  ninea TEXT,
  rc TEXT,
  adresse TEXT NOT NULL,
  telephone TEXT NOT NULL,
  telephone_fixe TEXT,
  email TEXT NOT NULL,
  site_web TEXT,
  logo_url TEXT,
  cachet_url TEXT,
  signature_url TEXT,
  conditions_generales TEXT,
  mentions_legales TEXT,
  coordonnees_bancaires TEXT,
  tva_defaut NUMERIC(5,2) DEFAULT 18.00,
  prefixe_devis TEXT DEFAULT 'DEV',
  prefixe_facture TEXT DEFAULT 'FAC',
  devise TEXT DEFAULT 'FCFA',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- =====================================================
-- TABLE: clients
-- =====================================================
CREATE TABLE clients (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  nom TEXT NOT NULL,
  raison_sociale TEXT,
  ninea TEXT,
  rc TEXT,
  adresse TEXT,
  telephone TEXT,
  email TEXT,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- =====================================================
-- TABLE: categories (catégories de produits)
-- =====================================================
CREATE TABLE categories (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  nom TEXT NOT NULL UNIQUE,
  description TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- =====================================================
-- TABLE: produits
-- =====================================================
CREATE TABLE produits (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  reference TEXT NOT NULL UNIQUE,
  designation TEXT NOT NULL,
  categorie_id UUID REFERENCES categories(id) ON DELETE SET NULL,
  description TEXT,
  photo_url TEXT,
  prix_achat NUMERIC(12,2) DEFAULT 0,
  prix_vente NUMERIC(12,2) NOT NULL,
  tva NUMERIC(5,2) DEFAULT 18.00,
  stock INTEGER DEFAULT 0,
  stock_alerte INTEGER DEFAULT 5,
  actif BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- =====================================================
-- TABLE: devis
-- =====================================================
CREATE TABLE devis (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  numero TEXT NOT NULL UNIQUE,
  client_id UUID NOT NULL REFERENCES clients(id) ON DELETE RESTRICT,
  date_devis DATE NOT NULL DEFAULT CURRENT_DATE,
  date_validite DATE NOT NULL,
  statut TEXT NOT NULL DEFAULT 'brouillon' CHECK (statut IN ('brouillon', 'envoye', 'accepte', 'refuse', 'expire')),
  sous_total NUMERIC(14,2) DEFAULT 0,
  remise_globale NUMERIC(14,2) DEFAULT 0,
  tva_total NUMERIC(14,2) DEFAULT 0,
  total_ttc NUMERIC(14,2) DEFAULT 0,
  conditions_paiement TEXT,
  notes TEXT,
  facture_id UUID,
  created_by UUID NOT NULL REFERENCES profiles(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- =====================================================
-- TABLE: lignes_devis
-- =====================================================
CREATE TABLE lignes_devis (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  devis_id UUID NOT NULL REFERENCES devis(id) ON DELETE CASCADE,
  produit_id UUID NOT NULL REFERENCES produits(id),
  designation TEXT NOT NULL,
  quantite INTEGER NOT NULL DEFAULT 1,
  prix_unitaire NUMERIC(12,2) NOT NULL,
  remise NUMERIC(5,2) DEFAULT 0,
  tva NUMERIC(5,2) DEFAULT 18.00,
  total_ht NUMERIC(14,2) NOT NULL,
  total_ttc NUMERIC(14,2) NOT NULL
);

-- =====================================================
-- TABLE: factures
-- =====================================================
CREATE TABLE factures (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  numero TEXT NOT NULL UNIQUE,
  client_id UUID NOT NULL REFERENCES clients(id) ON DELETE RESTRICT,
  devis_id UUID REFERENCES devis(id),
  date_facture DATE NOT NULL DEFAULT CURRENT_DATE,
  date_echeance DATE NOT NULL,
  statut TEXT NOT NULL DEFAULT 'brouillon' CHECK (statut IN ('brouillon', 'envoyee', 'payee_partiellement', 'payee', 'annulee')),
  sous_total NUMERIC(14,2) DEFAULT 0,
  remise_globale NUMERIC(14,2) DEFAULT 0,
  tva_total NUMERIC(14,2) DEFAULT 0,
  total_ttc NUMERIC(14,2) DEFAULT 0,
  montant_paye NUMERIC(14,2) DEFAULT 0,
  reste_a_payer NUMERIC(14,2) DEFAULT 0,
  conditions_paiement TEXT,
  notes TEXT,
  est_avoir BOOLEAN DEFAULT false,
  facture_origine_id UUID REFERENCES factures(id),
  created_by UUID NOT NULL REFERENCES profiles(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Mettre à jour devis avec la référence facture
ALTER TABLE devis ADD CONSTRAINT fk_devis_facture FOREIGN KEY (facture_id) REFERENCES factures(id);

-- =====================================================
-- TABLE: lignes_factures
-- =====================================================
CREATE TABLE lignes_factures (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  facture_id UUID NOT NULL REFERENCES factures(id) ON DELETE CASCADE,
  produit_id UUID NOT NULL REFERENCES produits(id),
  designation TEXT NOT NULL,
  quantite INTEGER NOT NULL DEFAULT 1,
  prix_unitaire NUMERIC(12,2) NOT NULL,
  remise NUMERIC(5,2) DEFAULT 0,
  tva NUMERIC(5,2) DEFAULT 18.00,
  total_ht NUMERIC(14,2) NOT NULL,
  total_ttc NUMERIC(14,2) NOT NULL
);

-- =====================================================
-- TABLE: paiements
-- =====================================================
CREATE TABLE paiements (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  facture_id UUID NOT NULL REFERENCES factures(id) ON DELETE CASCADE,
  montant NUMERIC(14,2) NOT NULL,
  date_paiement DATE NOT NULL DEFAULT CURRENT_DATE,
  mode_paiement TEXT NOT NULL DEFAULT 'especes' CHECK (mode_paiement IN ('especes', 'virement', 'cheque', 'mobile_money', 'carte', 'autre')),
  reference TEXT,
  notes TEXT,
  created_by UUID NOT NULL REFERENCES profiles(id),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Trigger pour mettre à jour le montant payé et le statut de la facture
CREATE OR REPLACE FUNCTION update_facture_paiement()
RETURNS TRIGGER AS $$
DECLARE
  total_paye NUMERIC(14,2);
  facture_total NUMERIC(14,2);
BEGIN
  SELECT COALESCE(SUM(montant), 0) INTO total_paye
  FROM paiements WHERE facture_id = COALESCE(NEW.facture_id, OLD.facture_id);

  SELECT total_ttc INTO facture_total
  FROM factures WHERE id = COALESCE(NEW.facture_id, OLD.facture_id);

  UPDATE factures SET
    montant_paye = total_paye,
    reste_a_payer = facture_total - total_paye,
    statut = CASE
      WHEN total_paye >= facture_total THEN 'payee'
      WHEN total_paye > 0 THEN 'payee_partiellement'
      ELSE statut
    END,
    updated_at = NOW()
  WHERE id = COALESCE(NEW.facture_id, OLD.facture_id);

  RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER after_paiement_change
  AFTER INSERT OR UPDATE OR DELETE ON paiements
  FOR EACH ROW EXECUTE FUNCTION update_facture_paiement();

-- =====================================================
-- TABLE: categories_compta
-- =====================================================
CREATE TABLE categories_compta (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  nom TEXT NOT NULL,
  type TEXT NOT NULL CHECK (type IN ('entree', 'sortie')),
  description TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- =====================================================
-- TABLE: operations_compta
-- =====================================================
CREATE TABLE operations_compta (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  type TEXT NOT NULL CHECK (type IN ('entree', 'sortie')),
  categorie_id UUID NOT NULL REFERENCES categories_compta(id),
  montant NUMERIC(14,2) NOT NULL,
  date_operation DATE NOT NULL DEFAULT CURRENT_DATE,
  description TEXT NOT NULL,
  reference TEXT,
  mode_paiement TEXT NOT NULL DEFAULT 'especes' CHECK (mode_paiement IN ('especes', 'virement', 'cheque', 'mobile_money', 'carte', 'autre')),
  compte TEXT NOT NULL DEFAULT 'caisse' CHECK (compte IN ('caisse', 'banque')),
  facture_id UUID REFERENCES factures(id),
  created_by UUID NOT NULL REFERENCES profiles(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- =====================================================
-- TABLE: journal_connexions
-- =====================================================
CREATE TABLE journal_connexions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES profiles(id),
  email TEXT NOT NULL,
  action TEXT NOT NULL,
  ip_address TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- =====================================================
-- SEQUENCES pour la numérotation
-- =====================================================
CREATE SEQUENCE IF NOT EXISTS seq_devis START 1;
CREATE SEQUENCE IF NOT EXISTS seq_factures START 1;

-- =====================================================
-- ROW LEVEL SECURITY (RLS)
-- =====================================================
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE entreprise ENABLE ROW LEVEL SECURITY;
ALTER TABLE clients ENABLE ROW LEVEL SECURITY;
ALTER TABLE categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE produits ENABLE ROW LEVEL SECURITY;
ALTER TABLE devis ENABLE ROW LEVEL SECURITY;
ALTER TABLE lignes_devis ENABLE ROW LEVEL SECURITY;
ALTER TABLE factures ENABLE ROW LEVEL SECURITY;
ALTER TABLE lignes_factures ENABLE ROW LEVEL SECURITY;
ALTER TABLE paiements ENABLE ROW LEVEL SECURITY;
ALTER TABLE categories_compta ENABLE ROW LEVEL SECURITY;
ALTER TABLE operations_compta ENABLE ROW LEVEL SECURITY;
ALTER TABLE journal_connexions ENABLE ROW LEVEL SECURITY;

-- Politiques RLS : accès authentifié pour toutes les tables
CREATE POLICY "profiles_select" ON profiles FOR SELECT USING (auth.role() = 'authenticated');
CREATE POLICY "profiles_update_own" ON profiles FOR UPDATE USING (auth.uid() = id);
CREATE POLICY "profiles_update_admin" ON profiles FOR UPDATE USING (
  (SELECT raw_user_meta_data->>'role' FROM auth.users WHERE id = auth.uid()) = 'admin'
);
CREATE POLICY "profiles_insert" ON profiles FOR INSERT WITH CHECK (auth.role() = 'authenticated');
CREATE POLICY "profiles_delete_admin" ON profiles FOR DELETE USING (
  (SELECT raw_user_meta_data->>'role' FROM auth.users WHERE id = auth.uid()) = 'admin'
);

CREATE POLICY "Authenticated users full access entreprise" ON entreprise FOR ALL USING (auth.role() = 'authenticated');

CREATE POLICY "Authenticated users full access clients" ON clients FOR ALL USING (auth.role() = 'authenticated');

CREATE POLICY "Authenticated users full access categories" ON categories FOR ALL USING (auth.role() = 'authenticated');

CREATE POLICY "Authenticated users full access produits" ON produits FOR ALL USING (auth.role() = 'authenticated');

CREATE POLICY "Authenticated users full access devis" ON devis FOR ALL USING (auth.role() = 'authenticated');

CREATE POLICY "Authenticated users full access lignes_devis" ON lignes_devis FOR ALL USING (auth.role() = 'authenticated');

CREATE POLICY "Authenticated users full access factures" ON factures FOR ALL USING (auth.role() = 'authenticated');

CREATE POLICY "Authenticated users full access lignes_factures" ON lignes_factures FOR ALL USING (auth.role() = 'authenticated');

CREATE POLICY "Authenticated users full access paiements" ON paiements FOR ALL USING (auth.role() = 'authenticated');

CREATE POLICY "Authenticated users full access categories_compta" ON categories_compta FOR ALL USING (auth.role() = 'authenticated');

CREATE POLICY "Authenticated users full access operations_compta" ON operations_compta FOR ALL USING (auth.role() = 'authenticated');

CREATE POLICY "Authenticated users full access journal" ON journal_connexions FOR ALL USING (auth.role() = 'authenticated');

-- =====================================================
-- STORAGE BUCKET
-- =====================================================
INSERT INTO storage.buckets (id, name, public) VALUES ('documents', 'documents', true)
ON CONFLICT (id) DO NOTHING;

CREATE POLICY "Authenticated users can upload documents" ON storage.objects
  FOR INSERT WITH CHECK (bucket_id = 'documents' AND auth.role() = 'authenticated');

CREATE POLICY "Anyone can view documents" ON storage.objects
  FOR SELECT USING (bucket_id = 'documents');

CREATE POLICY "Authenticated users can delete documents" ON storage.objects
  FOR DELETE USING (bucket_id = 'documents' AND auth.role() = 'authenticated');

-- =====================================================
-- DONNÉES INITIALES
-- =====================================================

-- Entreprise par défaut
INSERT INTO entreprise (nom, adresse, telephone, email, tva_defaut, prefixe_devis, prefixe_facture, devise) VALUES
('Impex Germany Senegal', 'Nguékhokh, Route de Nguaparou, Sénégal', '+221 XX XXX XX XX', 'contact@impexgermany.sn', 18.00, 'DEV', 'FAC', 'FCFA');

-- Catégories de produits
INSERT INTO categories (nom, description) VALUES
('Salons', 'Canapés, fauteuils, tables basses'),
('Chambres', 'Lits, armoires, commodes, tables de nuit'),
('Salles à manger', 'Tables, chaises, buffets, vitrines'),
('Bureaux', 'Bureaux, chaises de bureau, étagères'),
('Cuisines', 'Meubles de cuisine, rangements'),
('Extérieur', 'Mobilier de jardin et terrasse'),
('Décoration', 'Miroirs, cadres, luminaires, tapis'),
('Rangement', 'Étagères, placards, commodes');

-- Catégories comptables
INSERT INTO categories_compta (nom, type, description) VALUES
('Vente de meubles', 'entree', 'Encaissements des ventes de meubles'),
('Autres recettes', 'entree', 'Autres sources de revenus'),
('Achat marchandises', 'sortie', 'Achat de meubles auprès des fournisseurs'),
('Loyer', 'sortie', 'Loyer du magasin'),
('Salaires', 'sortie', 'Salaires des employés'),
('Fournitures', 'sortie', 'Fournitures de bureau et consommables'),
('Transport', 'sortie', 'Frais de transport et livraison'),
('Electricité / Eau', 'sortie', 'Charges d''électricité et d''eau'),
('Téléphone / Internet', 'sortie', 'Frais de communication'),
('Impôts et taxes', 'sortie', 'Impôts, taxes et contributions'),
('Divers', 'sortie', 'Dépenses diverses');
