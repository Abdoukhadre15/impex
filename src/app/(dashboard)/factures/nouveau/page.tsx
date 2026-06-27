"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Separator } from "@/components/ui/separator";
import { toast } from "sonner";
import { ArrowLeft, Plus, Trash2, Loader2, Save, FileSignature } from "lucide-react";
import type { Client, Produit, Entreprise } from "@/types/database";
import { formatMontant } from "@/lib/formatters";
import Link from "next/link";

interface LigneForm {
  produit_id: string;
  designation: string;
  quantite: number;
  prix_unitaire: number;
}

export default function NouvelleFacturePage() {
  const router = useRouter();
  const [clients, setClients] = useState<Client[]>([]);
  const [produits, setProduits] = useState<Produit[]>([]);
  const [entreprise, setEntreprise] = useState<Entreprise | null>(null);
  const [clientId, setClientId] = useState("");
  const [dateEcheance, setDateEcheance] = useState("");
  const [conditions, setConditions] = useState("");
  const [notes, setNotes] = useState("");
  const [lignes, setLignes] = useState<LigneForm[]>([]);
  const [tvaGlobale, setTvaGlobale] = useState(18);
  const [remiseGlobale, setRemiseGlobale] = useState(0);
  const [apposerSignature, setApposerSignature] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    const load = async () => {
      const supabase = createClient();
      const [clientsRes, produitsRes, entrepriseRes] = await Promise.all([
        supabase.from("clients").select("*").order("nom"),
        supabase.from("produits").select("*").eq("actif", true).order("designation"),
        supabase.from("entreprise").select("*").single(),
      ]);
      setClients(clientsRes.data ?? []);
      setProduits(produitsRes.data ?? []);
      if (entrepriseRes.data) {
        setEntreprise(entrepriseRes.data);
        setTvaGlobale(entrepriseRes.data.tva_defaut ?? 18);
      }
      const echeance = new Date();
      echeance.setDate(echeance.getDate() + 30);
      setDateEcheance(echeance.toISOString().split("T")[0]);
    };
    load();
  }, []);

  const addLigne = () => {
    setLignes([...lignes, { produit_id: "", designation: "", quantite: 1, prix_unitaire: 0 }]);
  };

  const updateLigne = (index: number, updates: Partial<LigneForm>) => {
    const updated = [...lignes];
    updated[index] = { ...updated[index], ...updates };
    setLignes(updated);
  };

  const selectProduit = (index: number, produitId: string) => {
    const produit = produits.find((p) => p.id === produitId);
    if (produit) {
      updateLigne(index, {
        produit_id: produitId,
        designation: produit.designation,
        prix_unitaire: produit.prix_vente,
      });
    }
  };

  const removeLigne = (index: number) => setLignes(lignes.filter((_, i) => i !== index));

  const totalLigne = (l: LigneForm) => l.quantite * l.prix_unitaire;

  const sousTotal = lignes.reduce((a, l) => a + totalLigne(l), 0);
  const montantRemise = sousTotal * (remiseGlobale / 100);
  const totalApresRemise = sousTotal - montantRemise;
  const montantTva = totalApresRemise * (tvaGlobale / 100);
  const totalTTC = totalApresRemise + montantTva;

  const handleSave = async () => {
    if (!clientId) { toast.error("Sélectionnez un client"); return; }
    if (lignes.length === 0) { toast.error("Ajoutez au moins une ligne"); return; }
    if (lignes.some((l) => !l.designation.trim())) { toast.error("Toutes les lignes doivent avoir une désignation"); return; }

    setSaving(true);
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const { data: ent } = await supabase.from("entreprise").select("prefixe_facture").single();
    const annee = new Date().getFullYear();
    const { count } = await supabase.from("factures").select("id", { count: "exact", head: true });
    const numero = `${ent?.prefixe_facture ?? "FAC"}-${annee}-${String((count ?? 0) + 1).padStart(4, "0")}`;

    const { data: facture, error } = await supabase
      .from("factures")
      .insert([{
        numero,
        client_id: clientId,
        date_facture: new Date().toISOString().split("T")[0],
        date_echeance: dateEcheance,
        sous_total: sousTotal,
        remise_globale: montantRemise,
        tva_total: montantTva,
        total_ttc: totalTTC,
        reste_a_payer: totalTTC,
        conditions_paiement: conditions,
        notes: JSON.stringify({ notes, tva_pourcent: tvaGlobale, remise_pourcent: remiseGlobale, apposer_signature: apposerSignature }),
        created_by: user.id,
      }])
      .select()
      .single();

    if (error || !facture) {
      toast.error("Erreur lors de la création");
      setSaving(false);
      return;
    }

    await supabase.from("lignes_factures").insert(
      lignes.map((l) => ({
        facture_id: facture.id,
        produit_id: l.produit_id || null,
        designation: l.designation,
        quantite: l.quantite,
        prix_unitaire: l.prix_unitaire,
        remise: remiseGlobale,
        tva: tvaGlobale,
        total_ht: totalLigne(l),
        total_ttc: totalLigne(l) * (1 - remiseGlobale / 100) * (1 + tvaGlobale / 100),
      }))
    );

    toast.success(`Facture ${numero} créée`);
    router.push("/factures");
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Link href="/factures">
          <Button variant="ghost" size="icon"><ArrowLeft className="h-5 w-5" /></Button>
        </Link>
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Nouvelle facture</h1>
          <p className="text-muted-foreground">Créer une nouvelle facture</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-6">
          {/* Informations */}
          <Card className="border-0 shadow-sm">
            <CardHeader><CardTitle className="text-lg">Informations</CardTitle></CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Client *</Label>
                  <select
                    value={clientId}
                    onChange={(e) => setClientId(e.target.value)}
                    className="flex h-9 w-full rounded-lg border border-input bg-transparent px-3 py-2 text-sm outline-none focus:border-ring focus:ring-3 focus:ring-ring/50"
                  >
                    <option value="">-- Sélectionner un client --</option>
                    {clients.map((c) => (
                      <option key={c.id} value={c.id}>{c.nom}</option>
                    ))}
                  </select>
                </div>
                <div className="space-y-2">
                  <Label>Date d&apos;échéance</Label>
                  <Input type="date" value={dateEcheance} onChange={(e) => setDateEcheance(e.target.value)} />
                </div>
              </div>
              <div className="space-y-2">
                <Label>Conditions de paiement</Label>
                <Input value={conditions} onChange={(e) => setConditions(e.target.value)} placeholder="Ex: Paiement à 30 jours" />
              </div>
              <div className="space-y-2">
                <Label>Notes</Label>
                <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={2} placeholder="Remarques..." />
              </div>
            </CardContent>
          </Card>

          {/* Lignes */}
          <Card className="border-0 shadow-sm">
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle className="text-lg">Lignes de la facture</CardTitle>
              <Button variant="outline" size="sm" onClick={addLigne}>
                <Plus className="mr-2 h-4 w-4" />Ajouter une ligne
              </Button>
            </CardHeader>
            <CardContent>
              {lignes.length === 0 ? (
                <div className="text-center py-10 text-muted-foreground">
                  <p>Cliquez sur &quot;Ajouter une ligne&quot; pour commencer</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {/* En-tête */}
                  <div className="grid grid-cols-12 gap-2 px-1 text-xs font-medium text-muted-foreground uppercase">
                    <div className="col-span-5">Désignation</div>
                    <div className="col-span-2 text-center">Quantité</div>
                    <div className="col-span-2 text-right">Prix unit.</div>
                    <div className="col-span-2 text-right">Total</div>
                    <div className="col-span-1"></div>
                  </div>
                  <Separator />
                  {lignes.map((ligne, index) => (
                    <div key={index} className="grid grid-cols-12 gap-2 items-center">
                      <div className="col-span-5">
                        <div className="space-y-1">
                          <select
                            value={ligne.produit_id}
                            onChange={(e) => selectProduit(index, e.target.value)}
                            className="flex h-9 w-full rounded-lg border border-input bg-transparent px-2 text-sm outline-none focus:border-ring focus:ring-3 focus:ring-ring/50"
                          >
                            <option value="">-- Produit du catalogue --</option>
                            {produits.map((p) => (
                              <option key={p.id} value={p.id}>{p.designation}</option>
                            ))}
                          </select>
                          <Input
                            value={ligne.designation}
                            onChange={(e) => updateLigne(index, { designation: e.target.value })}
                            placeholder="Ou saisir une désignation libre"
                            className="h-9 text-sm"
                          />
                        </div>
                      </div>
                      <div className="col-span-2">
                        <Input
                          type="number"
                          min={1}
                          value={ligne.quantite}
                          onChange={(e) => updateLigne(index, { quantite: Number(e.target.value) })}
                          className="h-9 text-center"
                        />
                      </div>
                      <div className="col-span-2">
                        <Input
                          type="number"
                          min={0}
                          value={ligne.prix_unitaire}
                          onChange={(e) => updateLigne(index, { prix_unitaire: Number(e.target.value) })}
                          className="h-9 text-right"
                        />
                      </div>
                      <div className="col-span-2 text-right font-semibold text-sm pr-1">
                        {formatMontant(totalLigne(ligne))}
                      </div>
                      <div className="col-span-1 flex justify-end">
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => removeLigne(index)}
                          className="h-8 w-8 text-red-500 hover:text-red-700"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Récapitulatif */}
        <div className="space-y-4">
          <Card className="border-0 shadow-sm sticky top-24">
            <CardHeader><CardTitle className="text-lg">Récapitulatif</CardTitle></CardHeader>
            <CardContent className="space-y-4">
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Sous-total ({lignes.length} ligne{lignes.length > 1 ? "s" : ""})</span>
                <span className="font-medium">{formatMontant(sousTotal)}</span>
              </div>

              <Separator />

              <div className="space-y-3">
                <div className="flex items-center justify-between gap-3">
                  <Label className="text-sm text-muted-foreground whitespace-nowrap">Remise (%)</Label>
                  <Input
                    type="number"
                    min={0}
                    max={100}
                    value={remiseGlobale}
                    onChange={(e) => setRemiseGlobale(Number(e.target.value))}
                    className="h-8 w-24 text-right"
                  />
                </div>
                {remiseGlobale > 0 && (
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Remise</span>
                    <span className="font-medium text-red-600">-{formatMontant(montantRemise)}</span>
                  </div>
                )}

                <div className="flex items-center justify-between gap-3">
                  <Label className="text-sm text-muted-foreground whitespace-nowrap">TVA (%)</Label>
                  <Input
                    type="number"
                    min={0}
                    max={100}
                    value={tvaGlobale}
                    onChange={(e) => setTvaGlobale(Number(e.target.value))}
                    className="h-8 w-24 text-right"
                  />
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Montant TVA</span>
                  <span className="font-medium">{formatMontant(montantTva)}</span>
                </div>
              </div>

              <Separator />

              <div className="flex justify-between items-center">
                <span className="font-bold text-lg">Total TTC</span>
                <span className="font-bold text-xl text-[#DD0000]">{formatMontant(totalTTC)}</span>
              </div>

              <Separator />

              {/* Signature */}
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <FileSignature className="h-4 w-4 text-muted-foreground" />
                  <Label className="text-sm">Apposer cachet & signature</Label>
                </div>
                <Switch checked={apposerSignature} onCheckedChange={setApposerSignature} />
              </div>
              {apposerSignature && !entreprise?.signature_url && !entreprise?.cachet_url && (
                <p className="text-xs text-orange-600">
                  Aucun cachet/signature configuré. Allez dans Paramètres pour en ajouter.
                </p>
              )}

              <Button onClick={handleSave} disabled={saving} className="w-full bg-[#DD0000] hover:bg-[#BB0000] mt-2">
                {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
                Enregistrer la facture
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
