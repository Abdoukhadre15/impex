"use client";

import { useEffect, useState, useCallback } from "react";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { toast } from "sonner";
import {
  Plus,
  Search,
  Eye,
  Loader2,
  FileText,
  ArrowRightLeft,
  Download,
  CalendarIcon,
} from "lucide-react";
import type { Devis, Entreprise, Client as ClientType, StatutDevis } from "@/types/database";
import { formatMontant, formatDate } from "@/lib/formatters";
import { pdf } from "@react-pdf/renderer";
import { DocumentPDF } from "@/components/pdf/document-pdf";
import Link from "next/link";

const statutColors: Record<string, string> = {
  brouillon: "bg-gray-100 text-gray-800",
  envoye: "bg-blue-100 text-blue-800",
  accepte: "bg-green-100 text-green-800",
  refuse: "bg-red-100 text-red-800",
  expire: "bg-orange-100 text-orange-800",
};

const statutLabels: Record<string, string> = {
  brouillon: "Brouillon",
  envoye: "Envoyé",
  accepte: "Accepté",
  refuse: "Refusé",
  expire: "Expiré",
};

const allStatuts: StatutDevis[] = ["brouillon", "envoye", "accepte", "refuse", "expire"];

export default function DevisPage() {
  const [devisList, setDevisList] = useState<(Devis & { client: { nom: string; adresse?: string; telephone?: string; email?: string; ninea?: string; raison_sociale?: string } })[]>([]);
  const [entreprise, setEntreprise] = useState<Entreprise | null>(null);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [dateDebut, setDateDebut] = useState("");
  const [dateFin, setDateFin] = useState("");
  const [generatingId, setGeneratingId] = useState<string | null>(null);

  const loadData = useCallback(async () => {
    const supabase = createClient();
    const [devisRes, entrepriseRes] = await Promise.all([
      supabase
        .from("devis")
        .select("*, client:clients(nom, adresse, telephone, email, ninea, raison_sociale)")
        .order("created_at", { ascending: false }),
      supabase.from("entreprise").select("*").single(),
    ]);
    setDevisList(devisRes.data ?? []);
    setEntreprise(entrepriseRes.data);
    setLoading(false);
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const handleStatutChange = async (devisId: string, newStatut: StatutDevis) => {
    const supabase = createClient();
    const { error } = await supabase
      .from("devis")
      .update({ statut: newStatut, updated_at: new Date().toISOString() })
      .eq("id", devisId);
    if (error) toast.error("Erreur lors du changement de statut");
    else {
      toast.success(`Statut changé en "${statutLabels[newStatut]}"`);
      loadData();
    }
  };

  const handleDownloadPDF = async (devis: Devis & { client: { nom: string; adresse?: string; telephone?: string; email?: string; ninea?: string; raison_sociale?: string } }) => {
    if (!entreprise) return;
    setGeneratingId(devis.id);

    const supabase = createClient();
    const { data: lignes } = await supabase
      .from("lignes_devis")
      .select("*")
      .eq("devis_id", devis.id);

    let parsedNotes = "";
    let tvaPourcent = 18;
    let remisePourcent = 0;
    let apposerSig = true;
    try {
      const parsed = JSON.parse(devis.notes ?? "{}");
      parsedNotes = parsed.notes ?? devis.notes ?? "";
      tvaPourcent = parsed.tva_pourcent ?? 18;
      remisePourcent = parsed.remise_pourcent ?? 0;
      apposerSig = parsed.apposer_signature ?? true;
    } catch {
      parsedNotes = devis.notes ?? "";
    }

    const blob = await pdf(
      <DocumentPDF
        type="devis"
        numero={devis.numero}
        date={devis.date_devis}
        dateSecondaire={devis.date_validite}
        dateSecondaireLabel="Validité"
        entreprise={entreprise}
        client={devis.client as ClientType}
        lignes={lignes ?? []}
        sousTotal={devis.sous_total}
        tvaTotal={devis.tva_total}
        totalTTC={devis.total_ttc}
        remiseGlobale={devis.remise_globale}
        remisePourcent={remisePourcent}
        tvaPourcent={tvaPourcent}
        apposerSignature={apposerSig}
        conditions={devis.conditions_paiement ?? undefined}
        notes={parsedNotes || undefined}
      />
    ).toBlob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${devis.numero}.pdf`;
    a.click();
    URL.revokeObjectURL(url);
    setGeneratingId(null);
  };

  const handleConvertToFacture = async (devis: Devis) => {
    if (!confirm("Transformer ce devis en facture ?")) return;

    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const { data: ent } = await supabase.from("entreprise").select("prefixe_facture").single();
    const annee = new Date().getFullYear();
    const { count } = await supabase.from("factures").select("id", { count: "exact", head: true });
    const numero = `${ent?.prefixe_facture ?? "FAC"}-${annee}-${String((count ?? 0) + 1).padStart(4, "0")}`;

    const { data: lignes } = await supabase.from("lignes_devis").select("*").eq("devis_id", devis.id);

    const { data: facture, error } = await supabase
      .from("factures")
      .insert([{
        numero,
        client_id: devis.client_id,
        devis_id: devis.id,
        date_facture: new Date().toISOString().split("T")[0],
        date_echeance: new Date(Date.now() + 30 * 86400000).toISOString().split("T")[0],
        sous_total: devis.sous_total,
        remise_globale: devis.remise_globale,
        tva_total: devis.tva_total,
        total_ttc: devis.total_ttc,
        reste_a_payer: devis.total_ttc,
        conditions_paiement: devis.conditions_paiement,
        notes: devis.notes,
        created_by: user.id,
      }])
      .select()
      .single();

    if (error || !facture) { toast.error("Erreur lors de la conversion"); return; }

    if (lignes?.length) {
      await supabase.from("lignes_factures").insert(
        lignes.map((l) => ({
          facture_id: facture.id,
          produit_id: l.produit_id,
          designation: l.designation,
          quantite: l.quantite,
          prix_unitaire: l.prix_unitaire,
          remise: l.remise,
          tva: l.tva,
          total_ht: l.total_ht,
          total_ttc: l.total_ttc,
        }))
      );
    }

    await supabase.from("devis").update({ statut: "accepte", facture_id: facture.id }).eq("id", devis.id);
    toast.success(`Facture ${numero} créée`);
    window.location.href = "/factures";
  };

  const filtered = devisList.filter((d) => {
    const matchSearch =
      d.numero.toLowerCase().includes(search.toLowerCase()) ||
      d.client?.nom?.toLowerCase().includes(search.toLowerCase());

    let matchDate = true;
    if (dateDebut) matchDate = matchDate && d.date_devis >= dateDebut;
    if (dateFin) matchDate = matchDate && d.date_devis <= dateFin;

    return matchSearch && matchDate;
  });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Devis</h1>
          <p className="text-muted-foreground">Gestion des devis clients</p>
        </div>
        <Link href="/devis/nouveau">
          <Button className="bg-[#DD0000] hover:bg-[#BB0000]">
            <Plus className="mr-2 h-4 w-4" />
            Nouveau devis
          </Button>
        </Link>
      </div>

      <Card className="border-0 shadow-sm">
        <CardHeader className="pb-4">
          <div className="flex items-center gap-4 flex-wrap">
            <div className="relative flex-1 min-w-[200px] max-w-sm">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Rechercher un devis..."
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
              <FileText className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
              <p className="text-muted-foreground">Aucun devis trouvé</p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>N°</TableHead>
                  <TableHead>Client</TableHead>
                  <TableHead className="hidden md:table-cell">Date</TableHead>
                  <TableHead>Statut</TableHead>
                  <TableHead className="text-right">Total TTC</TableHead>
                  <TableHead className="text-center hidden md:table-cell">Partager</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.map((devis) => (
                  <TableRow key={devis.id}>
                    <TableCell className="font-mono text-sm font-medium">
                      {devis.numero}
                    </TableCell>
                    <TableCell>{devis.client?.nom}</TableCell>
                    <TableCell className="hidden md:table-cell">
                      {formatDate(devis.date_devis)}
                    </TableCell>
                    <TableCell>
                      <select
                        value={devis.statut}
                        onChange={(e) => handleStatutChange(devis.id, e.target.value as StatutDevis)}
                        className={`text-xs font-medium px-2 py-1 rounded-full border-0 cursor-pointer outline-none ${statutColors[devis.statut]}`}
                      >
                        {allStatuts.map((s) => (
                          <option key={s} value={s}>{statutLabels[s]}</option>
                        ))}
                      </select>
                    </TableCell>
                    <TableCell className="text-right font-medium">
                      {formatMontant(devis.total_ttc)}
                    </TableCell>
                    <TableCell className="hidden md:table-cell">
                      <div className="flex justify-center gap-1">
                        <a
                          href={`https://wa.me/${(devis.client?.telephone ?? "").replace(/[^0-9]/g, "")}?text=${encodeURIComponent(`Bonjour ${devis.client?.nom},\nVeuillez trouver votre devis ${devis.numero} d'un montant de ${formatMontant(devis.total_ttc)}.\nCordialement,\nImpex Germany Senegal`)}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          title="Envoyer via WhatsApp"
                        >
                          <Button variant="ghost" size="icon" className="h-8 w-8 text-green-600 hover:text-green-700 hover:bg-green-50">
                            <svg viewBox="0 0 24 24" className="h-4 w-4" fill="currentColor"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/></svg>
                          </Button>
                        </a>
                        <a
                          href={`mailto:${devis.client?.email ?? ""}?subject=${encodeURIComponent(`Devis ${devis.numero} — Impex Germany Senegal`)}&body=${encodeURIComponent(`Bonjour ${devis.client?.nom},\n\nVeuillez trouver ci-joint votre devis ${devis.numero} d'un montant de ${formatMontant(devis.total_ttc)}.\n\nCordialement,\nImpex Germany Senegal`)}`}
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
                        <Link href={`/devis/${devis.id}`}>
                          <Button variant="ghost" size="icon" title="Voir">
                            <Eye className="h-4 w-4" />
                          </Button>
                        </Link>
                        <Button
                          variant="ghost"
                          size="icon"
                          title="Télécharger PDF"
                          onClick={() => handleDownloadPDF(devis)}
                          disabled={generatingId === devis.id}
                        >
                          {generatingId === devis.id ? (
                            <Loader2 className="h-4 w-4 animate-spin" />
                          ) : (
                            <Download className="h-4 w-4" />
                          )}
                        </Button>
                        {(devis.statut === "envoye" || devis.statut === "accepte") &&
                          !devis.facture_id && (
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => handleConvertToFacture(devis)}
                              title="Transformer en facture"
                            >
                              <ArrowRightLeft className="h-4 w-4 text-green-600" />
                            </Button>
                          )}
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
