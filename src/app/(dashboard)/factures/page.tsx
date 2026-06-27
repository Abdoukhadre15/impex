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
import { Plus, Search, Eye, Loader2, Receipt } from "lucide-react";
import type { Facture } from "@/types/database";
import { formatMontant, formatDate } from "@/lib/formatters";
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

export default function FacturesPage() {
  const [factures, setFactures] = useState<(Facture & { client: { nom: string } })[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");

  useEffect(() => {
    const load = async () => {
      const supabase = createClient();
      const { data } = await supabase
        .from("factures")
        .select("*, client:clients(nom)")
        .order("created_at", { ascending: false });
      setFactures(data ?? []);
      setLoading(false);
    };
    load();
  }, []);

  const filtered = factures.filter(
    (f) =>
      f.numero.toLowerCase().includes(search.toLowerCase()) ||
      f.client?.nom?.toLowerCase().includes(search.toLowerCase())
  );

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
          <div className="flex items-center gap-4">
            <div className="relative flex-1 max-w-sm">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Rechercher une facture..."
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
                  <TableHead className="text-right hidden md:table-cell">
                    Reste dû
                  </TableHead>
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
                      <Badge className={statutColors[facture.statut]}>
                        {statutLabels[facture.statut]}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right font-medium">
                      {formatMontant(facture.total_ttc)}
                    </TableCell>
                    <TableCell className="text-right font-medium hidden md:table-cell">
                      {facture.reste_a_payer > 0 ? (
                        <span className="text-red-600">
                          {formatMontant(facture.reste_a_payer)}
                        </span>
                      ) : (
                        <span className="text-green-600">0 FCFA</span>
                      )}
                    </TableCell>
                    <TableCell className="text-right">
                      <Link href={`/factures/${facture.id}`}>
                        <Button variant="ghost" size="icon">
                          <Eye className="h-4 w-4" />
                        </Button>
                      </Link>
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
