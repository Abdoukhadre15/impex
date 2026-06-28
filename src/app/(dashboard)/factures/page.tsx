"use client";

import { useEffect, useState, useCallback } from "react";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { Plus, Search, Eye, Loader2, Receipt, Download, CalendarIcon } from "lucide-react";
import type { Facture, Entreprise, Client as ClientType, LigneFacture, StatutFacture } from "@/types/database";
import { formatMontant, formatDate } from "@/lib/formatters";
import { pdf } from "@react-pdf/renderer";
import { DocumentPDF } from "@/components/pdf/document-pdf";
import Link from "next/link";

const statutColors: Record<string, string> = {
  brouillon: "bg-gray-100 text-gray-800",
  envoyee: "bg-blue-100 text-blue-800",
  payee_partiellement: "bg-orange-100 text-orange-800",
  payee: "bg-green-100 text-green-800",
  annulee: "bg-red-100 text-red-800",
};

const statutLabels: Record<string, string> = {
  brouillon: "Brouillon",
  envoyee: "Envoyée",
  payee_partiellement: "Partielle",
  payee: "Payée",
  annulee: "Annulée",
};

const allStatuts: StatutFacture[] = ["brouillon", "envoyee", "payee_partiellement", "payee", "annulee"];

export default function FacturesPage() {
  const [factures, setFactures] = useState<(Facture & { client: { nom: string; adresse?: string; telephone?: string; email?: string; ninea?: string; raison_sociale?: string } })[]>([]);
  const [entreprise, setEntreprise] = useState<Entreprise | null>(null);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [dateDebut, setDateDebut] = useState("");
  const [dateFin, setDateFin] = useState("");
  const [generatingId, setGeneratingId] = useState<string | null>(null);

  const loadData = useCallback(async () => {
    const supabase = createClient();
    const [facturesRes, entrepriseRes] = await Promise.all([
      supabase
        .from("factures")
        .select("*, client:clients(nom, adresse, telephone, email, ninea, raison_sociale)")
        .order("created_at", { ascending: false }),
      supabase.from("entreprise").select("*").single(),
    ]);
    setFactures(facturesRes.data ?? []);
    setEntreprise(entrepriseRes.data);
    setLoading(false);
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const handleStatutChange = async (factureId: string, newStatut: StatutFacture) => {
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();

    const { error } = await supabase
      .from("factures")
      .update({ statut: newStatut, updated_at: new Date().toISOString() })
      .eq("id", factureId);
    if (error) { toast.error("Erreur lors du changement de statut"); return; }

    if (newStatut === "payee" && user) {
      const facture = factures.find((f) => f.id === factureId);
      if (facture) {
        const { data: catVente } = await supabase
          .from("categories_compta")
          .select("id")
          .eq("type", "entree")
          .limit(1)
          .single();

        if (catVente) {
          await supabase.from("operations_compta").insert([{
            type: "entree",
            categorie_id: catVente.id,
            montant: facture.total_ttc,
            date_operation: new Date().toISOString().split("T")[0],
            description: `Paiement facture ${facture.numero} — ${facture.client?.nom}`,
            reference: facture.numero,
            mode_paiement: "especes",
            compte: "caisse",
            facture_id: facture.id,
            created_by: user.id,
          }]);
        }

        if (facture.reste_a_payer > 0) {
          await supabase.from("paiements").insert([{
            facture_id: facture.id,
            montant: facture.reste_a_payer,
            date_paiement: new Date().toISOString().split("T")[0],
            mode_paiement: "especes",
            reference: "Paiement complet",
            created_by: user.id,
          }]);
        }
      }
    }

    toast.success(`Statut changé en "${statutLabels[newStatut]}"`);
    loadData();
  };

  const handleDownloadPDF = async (facture: Facture & { client: { nom: string; adresse?: string; telephone?: string; email?: string; ninea?: string; raison_sociale?: string } }) => {
    if (!entreprise) return;
    setGeneratingId(facture.id);

    const supabase = createClient();
    const { data: lignes } = await supabase
      .from("lignes_factures")
      .select("*")
      .eq("facture_id", facture.id);

    let parsedNotes = "";
    let tvaPourcent = 18;
    let remisePourcent = 0;
    let apposerSig = true;
    let typeFacture = "";
    let moyenPaiement = "";
    try {
      const parsed = JSON.parse(facture.notes ?? "{}");
      parsedNotes = parsed.notes ?? facture.notes ?? "";
      tvaPourcent = parsed.tva_pourcent ?? 18;
      remisePourcent = parsed.remise_pourcent ?? 0;
      apposerSig = parsed.apposer_signature ?? true;
      typeFacture = parsed.type_facture ?? "";
      moyenPaiement = parsed.moyen_paiement ?? "";
    } catch {
      parsedNotes = facture.notes ?? "";
    }

    const blob = await pdf(
      <DocumentPDF
        type="facture"
        numero={facture.numero}
        date={facture.date_facture}
        dateSecondaire={facture.date_echeance}
        dateSecondaireLabel="Échéance"
        entreprise={entreprise}
        client={facture.client as ClientType}
        lignes={lignes ?? []}
        sousTotal={facture.sous_total}
        tvaTotal={facture.tva_total}
        totalTTC={facture.total_ttc}
        remiseGlobale={facture.remise_globale}
        remisePourcent={remisePourcent}
        tvaPourcent={tvaPourcent}
        apposerSignature={apposerSig}
        montantPaye={facture.montant_paye}
        resteAPayer={facture.reste_a_payer}
        conditions={facture.conditions_paiement ?? undefined}
        notes={parsedNotes || undefined}
        typeFacture={typeFacture || undefined}
        moyenPaiement={moyenPaiement || undefined}
      />
    ).toBlob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${facture.numero}.pdf`;
    a.click();
    URL.revokeObjectURL(url);
    setGeneratingId(null);
  };

  const filtered = factures.filter((f) => {
    const matchSearch =
      f.numero.toLowerCase().includes(search.toLowerCase()) ||
      f.client?.nom?.toLowerCase().includes(search.toLowerCase());

    let matchDate = true;
    if (dateDebut) matchDate = matchDate && f.date_facture >= dateDebut;
    if (dateFin) matchDate = matchDate && f.date_facture <= dateFin;

    return matchSearch && matchDate;
  });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Factures</h1>
          <p className="text-muted-foreground">Gestion des factures</p>
        </div>
        <Link href="/factures/nouveau">
          <Button className="bg-[#DD0000] hover:bg-[#BB0000]">
            <Plus className="mr-2 h-4 w-4" />
            Nouvelle facture
          </Button>
        </Link>
      </div>

      <Card className="border-0 shadow-sm">
        <CardHeader className="pb-4">
          <div className="flex items-center gap-4 flex-wrap">
            <div className="relative flex-1 min-w-[200px] max-w-sm">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Rechercher une facture..."
                className="pl-10"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>
            <div className="flex items-center gap-2">
              <CalendarIcon className="h-4 w-4 text-muted-foreground" />
              <Input
                type="date"
                value={dateDebut}
                onChange={(e) => setDateDebut(e.target.value)}
                className="w-[140px] h-9"
              />
              <span className="text-muted-foreground text-sm">à</span>
              <Input
                type="date"
                value={dateFin}
                onChange={(e) => setDateFin(e.target.value)}
                className="w-[140px] h-9"
              />
              {(dateDebut || dateFin) && (
                <Button variant="ghost" size="sm" onClick={() => { setDateDebut(""); setDateFin(""); }}>
                  Effacer
                </Button>
              )}
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex justify-center py-12">
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
          ) : filtered.length === 0 ? (
            <div className="text-center py-12">
              <Receipt className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
              <p className="text-muted-foreground">Aucune facture trouvée</p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>N°</TableHead>
                  <TableHead>Client</TableHead>
                  <TableHead className="hidden md:table-cell">Date</TableHead>
                  <TableHead className="hidden md:table-cell">Échéance</TableHead>
                  <TableHead>Statut</TableHead>
                  <TableHead className="text-right">Total TTC</TableHead>
                  <TableHead className="text-center hidden md:table-cell">Partager</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.map((facture) => (
                  <TableRow key={facture.id}>
                    <TableCell className="font-mono text-sm font-medium">
                      {facture.numero}
                    </TableCell>
                    <TableCell>{facture.client?.nom}</TableCell>
                    <TableCell className="hidden md:table-cell">
                      {formatDate(facture.date_facture)}
                    </TableCell>
                    <TableCell className="hidden md:table-cell">
                      {formatDate(facture.date_echeance)}
                    </TableCell>
                    <TableCell>
                      <select
                        value={facture.statut}
                        onChange={(e) => handleStatutChange(facture.id, e.target.value as StatutFacture)}
                        className={`text-xs font-medium px-2 py-1 rounded-full border-0 cursor-pointer outline-none ${statutColors[facture.statut]}`}
                      >
                        {allStatuts.map((s) => (
                          <option key={s} value={s}>{statutLabels[s]}</option>
                        ))}
                      </select>
                    </TableCell>
                    <TableCell className="text-right font-medium">
                      {formatMontant(facture.total_ttc)}
                    </TableCell>
                    <TableCell className="hidden md:table-cell">
                      <div className="flex justify-center gap-1">
                        <a
                          href={`https://wa.me/${(facture.client?.telephone ?? "").replace(/[^0-9]/g, "")}?text=${encodeURIComponent(`Bonjour ${facture.client?.nom},\nVeuillez trouver votre facture ${facture.numero} d'un montant de ${formatMontant(facture.total_ttc)}.\nCordialement,\nImpex Germany Senegal`)}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          title="Envoyer via WhatsApp"
                        >
                          <Button variant="ghost" size="icon" className="h-8 w-8 text-green-600 hover:text-green-700 hover:bg-green-50">
                            <svg viewBox="0 0 24 24" className="h-4 w-4" fill="currentColor"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/></svg>
                          </Button>
                        </a>
                        <a
                          href={`mailto:${facture.client?.email ?? ""}?subject=${encodeURIComponent(`Facture ${facture.numero} — Impex Germany Senegal`)}&body=${encodeURIComponent(`Bonjour ${facture.client?.nom},\n\nVeuillez trouver ci-joint votre facture ${facture.numero} d'un montant de ${formatMontant(facture.total_ttc)}.\n\nCordialement,\nImpex Germany Senegal`)}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          title="Envoyer par email"
                        >
                          <Button variant="ghost" size="icon" className="h-8 w-8 text-blue-600 hover:text-blue-700 hover:bg-blue-50">
                            <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect width="20" height="16" x="2" y="4" rx="2"/><path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7"/></svg>
                          </Button>
                        </a>
                      </div>
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-1">
                        <Link href={`/factures/${facture.id}`}>
                          <Button variant="ghost" size="icon" title="Voir">
                            <Eye className="h-4 w-4" />
                          </Button>
                        </Link>
                        <Button
                          variant="ghost"
                          size="icon"
                          title="Télécharger PDF"
                          onClick={() => handleDownloadPDF(facture)}
                          disabled={generatingId === facture.id}
                        >
                          {generatingId === facture.id ? (
                            <Loader2 className="h-4 w-4 animate-spin" />
                          ) : (
                            <Download className="h-4 w-4" />
                          )}
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
