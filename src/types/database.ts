export type UserRole = 'admin' | 'vendeur' | 'comptable' | 'consultation';

export interface Profile {
  id: string;
  email: string;
  nom_complet: string;
  role: UserRole;
  telephone?: string;
  actif: boolean;
  created_at: string;
  updated_at: string;
}

export interface Entreprise {
  id: string;
  nom: string;
  raison_sociale?: string;
  ninea?: string;
  rc?: string;
  adresse: string;
  telephone: string;
  telephone_fixe?: string;
  email: string;
  site_web?: string;
  logo_url?: string;
  cachet_url?: string;
  signature_url?: string;
  conditions_generales?: string;
  mentions_legales?: string;
  coordonnees_bancaires?: string;
  tva_defaut: number;
  prefixe_devis: string;
  prefixe_facture: string;
  devise: string;
  created_at: string;
  updated_at: string;
}

export interface Client {
  id: string;
  nom: string;
  raison_sociale?: string;
  ninea?: string;
  rc?: string;
  adresse?: string;
  telephone?: string;
  email?: string;
  notes?: string;
  created_at: string;
  updated_at: string;
}

export interface Categorie {
  id: string;
  nom: string;
  description?: string;
  created_at: string;
}

export interface Produit {
  id: string;
  reference: string;
  designation: string;
  categorie_id?: string;
  categorie?: Categorie;
  description?: string;
  photo_url?: string;
  prix_achat: number;
  prix_vente: number;
  tva: number;
  stock: number;
  stock_alerte: number;
  actif: boolean;
  created_at: string;
  updated_at: string;
}

export type StatutDevis = 'brouillon' | 'envoye' | 'accepte' | 'refuse' | 'expire';

export interface Devis {
  id: string;
  numero: string;
  client_id: string;
  client?: Client;
  date_devis: string;
  date_validite: string;
  statut: StatutDevis;
  sous_total: number;
  remise_globale: number;
  tva_total: number;
  total_ttc: number;
  conditions_paiement?: string;
  notes?: string;
  facture_id?: string;
  created_by: string;
  created_at: string;
  updated_at: string;
  lignes?: LigneDevis[];
}

export interface LigneDevis {
  id: string;
  devis_id: string;
  produit_id: string;
  produit?: Produit;
  designation: string;
  quantite: number;
  prix_unitaire: number;
  remise: number;
  tva: number;
  total_ht: number;
  total_ttc: number;
}

export type StatutFacture = 'brouillon' | 'envoyee' | 'payee_partiellement' | 'payee' | 'annulee';

export interface Facture {
  id: string;
  numero: string;
  client_id: string;
  client?: Client;
  devis_id?: string;
  date_facture: string;
  date_echeance: string;
  statut: StatutFacture;
  sous_total: number;
  remise_globale: number;
  tva_total: number;
  total_ttc: number;
  montant_paye: number;
  reste_a_payer: number;
  conditions_paiement?: string;
  notes?: string;
  est_avoir: boolean;
  facture_origine_id?: string;
  created_by: string;
  created_at: string;
  updated_at: string;
  lignes?: LigneFacture[];
  paiements?: Paiement[];
}

export interface LigneFacture {
  id: string;
  facture_id: string;
  produit_id: string;
  produit?: Produit;
  designation: string;
  quantite: number;
  prix_unitaire: number;
  remise: number;
  tva: number;
  total_ht: number;
  total_ttc: number;
}

export type ModePaiement = 'especes' | 'virement' | 'cheque' | 'mobile_money' | 'carte' | 'autre';

export interface Paiement {
  id: string;
  facture_id: string;
  montant: number;
  date_paiement: string;
  mode_paiement: ModePaiement;
  reference?: string;
  notes?: string;
  created_by: string;
  created_at: string;
}

export type TypeOperation = 'entree' | 'sortie';

export interface CategorieCompta {
  id: string;
  nom: string;
  type: TypeOperation;
  description?: string;
  created_at: string;
}

export interface OperationCompta {
  id: string;
  type: TypeOperation;
  categorie_id: string;
  categorie?: CategorieCompta;
  montant: number;
  date_operation: string;
  description: string;
  reference?: string;
  mode_paiement: ModePaiement;
  compte: 'caisse' | 'banque';
  facture_id?: string;
  created_by: string;
  created_at: string;
  updated_at: string;
}

export interface JournalConnexion {
  id: string;
  user_id: string;
  email: string;
  action: string;
  ip_address?: string;
  created_at: string;
}
