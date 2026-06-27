"use client";

import { useEffect, useState } from "react";
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
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import {
  Plus,
  Search,
  Eye,
  Loader2,
  FileText,
  ArrowRightLeft,
} from "lucide-react";
import type { Devis } from "@/types/database";
import { formatMontant, formatDate } from "@/lib/formatters";
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

export default function DevisPage() {
  const [devisList, setDevisList] = useState<(Devis & { client: { nom: string } })[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");

  useEffect(() => {
    const load = async () => {
      const supabase = createClient();
      const { data } = await supabase
        .from("devis")
        .select("*, client:clients(nom)")
        .order("created_at", { ascending: false });
      setDevisList(data ?? []);
      setLoading(false);
    };
    load();
  }, []);

  const handleConvertToFacture = async (devis: Devis) => {
    if (!confirm("Transformer ce devis en facture ?")) return;

    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const { data: entreprise } = await supabase
      .from("entreprise")
      .select("prefixe_facture")
      .single();

    const annee = new Date().getFullYear();
    const { count } = await supabase
      .from("factures")
      .select("id", { count: "exact", head: true });
    const numero = `${entreprise?.prefixe_facture ?? "FAC"}-${annee}-${String((count ?? 0) + 1).padStart(4, "0")}`;

    const { data: lignes } = await supabase
      .from("lignes_devis")
      .select("*")
      .eq("devis_id", devis.id);

    const { data: facture, error } = await supabase
      .from("factures")
      .insert([{
        numero,
        client_id: devis.client_id,
        devis_id: devis.id,
        date_facture: new Date().toISOString().split("T")[0],
        date_echeance: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split("T")[0],
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

    if (error || !facture) {
      toast.error("Erreur lors de la conversion");
      return;
    }

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

    await supabase
      .from("devis")
      .update({ statut: "accepte", facture_id: facture.id })
      .eq("id", devis.id);

    toast.success(`Facture ${numero} créée`);
    window.location.href = "/factures";
  };

  const filtered = devisList.filter(
    (d) =>
      d.numero.toLowerCase().includes(search.toLowerCase()) ||
      d.client?.nom?.toLowerCase().includes(search.toLowerCase())
  );

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
          <div className="flex items-center gap-4">
            <div className="relative flex-1 max-w-sm">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Rechercher un devis..."
                className="pl-10"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
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
                      <Badge className={statutColors[devis.statut]}>
                        {statutLabels[devis.statut]}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right font-medium">
                      {formatMontant(devis.total_ttc)}
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-1">
                        <Link href={`/devis/${devis.id}`}>
                          <Button variant="ghost" size="icon">
                            <Eye className="h-4 w-4" />
                          </Button>
                        </Link>
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
