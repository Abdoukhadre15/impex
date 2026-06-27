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
    const { error } = await supabase
      .from("factures")
      .update({ statut: newStatut, updated_at: new Date().toISOString() })
      .eq("id", factureId);
    if (error) toast.error("Erreur lors du changement de statut");
    else {
      toast.success(`Statut changé en "${statutLabels[newStatut]}"`);
      loadData();
    }
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
    try {
      const parsed = JSON.parse(facture.notes ?? "{}");
      parsedNotes = parsed.notes ?? facture.notes ?? "";
      tvaPourcent = parsed.tva_pourcent ?? 18;
      remisePourcent = parsed.remise_pourcent ?? 0;
      apposerSig = parsed.apposer_signature ?? true;
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
                  <TableHead className="text-right hidden md:table-cell">Reste dû</TableHead>
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
                    <TableCell className="text-right font-medium hidden md:table-cell">
                      {facture.reste_a_payer > 0 ? (
                        <span className="text-red-600">{formatMontant(facture.reste_a_payer)}</span>
                      ) : (
                        <span className="text-green-600">0 FCFA</span>
                      )}
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
