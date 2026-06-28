"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import {
  Plus,
  ArrowUpCircle,
  ArrowDownCircle,
  Loader2,
  Calculator,
  TrendingUp,
  TrendingDown,
  Wallet,
  Download,
} from "lucide-react";
import type { OperationCompta, CategorieCompta, TypeOperation, ModePaiement, Entreprise } from "@/types/database";
import { formatMontant, formatDate } from "@/lib/formatters";
import { pdf } from "@react-pdf/renderer";
import { RapportComptaPDF } from "@/components/pdf/rapport-compta-pdf";

const emptyOp = {
  type: "entree" as TypeOperation,
  categorie_id: "",
  montant: 0,
  date_operation: new Date().toISOString().split("T")[0],
  description: "",
  reference: "",
  mode_paiement: "especes" as ModePaiement,
  compte: "caisse" as "caisse" | "banque",
};

const modesLabels: Record<string, string> = {
  especes: "Espèces",
  virement: "Virement",
  cheque: "Chèque",
  mobile_money: "Mobile Money",
  carte: "Carte",
  autre: "Autre",
};

export default function ComptabilitePage() {
  const [operations, setOperations] = useState<(OperationCompta & { categorie: CategorieCompta })[]>([]);
  const [categories, setCategories] = useState<CategorieCompta[]>([]);
  const [entreprise, setEntreprise] = useState<Entreprise | null>(null);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [form, setForm] = useState(emptyOp);
  const [saving, setSaving] = useState(false);
  const [filtrePeriode, setFiltrePeriode] = useState("mois");
  const [generatingPDF, setGeneratingPDF] = useState(false);

  const loadData = async () => {
    const supabase = createClient();
    const now = new Date();
    let dateDebut = new Date(now.getFullYear(), now.getMonth(), 1);

    if (filtrePeriode === "semaine") {
      dateDebut = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    } else if (filtrePeriode === "annee") {
      dateDebut = new Date(now.getFullYear(), 0, 1);
    } else if (filtrePeriode === "jour") {
      dateDebut = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    }

    const [opsRes, catsRes, entRes] = await Promise.all([
      supabase
        .from("operations_compta")
        .select("*, categorie:categories_compta(*)")
        .gte("date_operation", dateDebut.toISOString().split("T")[0])
        .order("date_operation", { ascending: false }),
      supabase.from("categories_compta").select("*").order("nom"),
      supabase.from("entreprise").select("*").single(),
    ]);
    setOperations(opsRes.data ?? []);
    setCategories(catsRes.data ?? []);
    setEntreprise(entRes.data);
    setLoading(false);
  };

  useEffect(() => {
    loadData();
  }, [filtrePeriode]);

  const handleSave = async () => {
    if (!form.categorie_id || !form.description || form.montant <= 0) {
      toast.error("Remplissez tous les champs obligatoires");
      return;
    }
    setSaving(true);
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const { error } = await supabase.from("operations_compta").insert([{
      ...form,
      created_by: user.id,
    }]);

    if (error) toast.error("Erreur lors de l'enregistrement");
    else {
      toast.success("Opération enregistrée");
      setDialogOpen(false);
      setForm(emptyOp);
      loadData();
    }
    setSaving(false);
  };

  const handleDownloadRapport = async () => {
    if (!entreprise) return;
    setGeneratingPDF(true);

    const blob = await pdf(
      <RapportComptaPDF
        entreprise={entreprise}
        operations={operations}
        periode={filtrePeriode}
        totalEntrees={totalEntrees}
        totalSorties={totalSorties}
        solde={solde}
      />
    ).toBlob();

    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `Rapport-comptable-${filtrePeriode}.pdf`;
    a.click();
    URL.revokeObjectURL(url);
    setGeneratingPDF(false);
  };

  const totalEntrees = operations
    .filter((o) => o.type === "entree")
    .reduce((a, o) => a + o.montant, 0);
  const totalSorties = operations
    .filter((o) => o.type === "sortie")
    .reduce((a, o) => a + o.montant, 0);
  const solde = totalEntrees - totalSorties;

  const filteredCategories = categories.filter((c) => c.type === form.type);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Comptabilité</h1>
          <p className="text-muted-foreground">Suivi des entrées et sorties</p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            onClick={handleDownloadRapport}
            disabled={generatingPDF || operations.length === 0}
          >
            {generatingPDF ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <Download className="mr-2 h-4 w-4" />
            )}
            Rapport PDF
          </Button>
          <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
            <DialogTrigger render={<Button className="bg-[#DD0000] hover:bg-[#BB0000]" />}>
              <Plus className="mr-2 h-4 w-4" />
              Nouvelle opération
            </DialogTrigger>
            <DialogContent className="max-w-lg">
              <DialogHeader>
                <DialogTitle>Nouvelle opération</DialogTitle>
              </DialogHeader>
              <div className="space-y-4 py-4">
                <div className="space-y-2">
                  <Label>Type</Label>
                  <select
                    value={form.type}
                    onChange={(e) => setForm({ ...form, type: e.target.value as TypeOperation, categorie_id: "" })}
                    className="flex h-9 w-full rounded-lg border border-input bg-transparent px-3 py-2 text-sm outline-none focus:border-ring focus:ring-3 focus:ring-ring/50"
                  >
                    <option value="entree">Entrée (recette)</option>
                    <option value="sortie">Sortie (dépense)</option>
                  </select>
                </div>
                <div className="space-y-2">
                  <Label>Catégorie *</Label>
                  <select
                    value={form.categorie_id}
                    onChange={(e) => setForm({ ...form, categorie_id: e.target.value })}
                    className="flex h-9 w-full rounded-lg border border-input bg-transparent px-3 py-2 text-sm outline-none focus:border-ring focus:ring-3 focus:ring-ring/50"
                  >
                    <option value="">-- Choisir --</option>
                    {filteredCategories.map((c) => (
                      <option key={c.id} value={c.id}>{c.nom}</option>
                    ))}
                  </select>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Montant (FCFA) *</Label>
                    <Input
                      type="number"
                      value={form.montant}
                      onChange={(e) => setForm({ ...form, montant: Number(e.target.value) })}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Date</Label>
                    <Input
                      type="date"
                      value={form.date_operation}
                      onChange={(e) => setForm({ ...form, date_operation: e.target.value })}
                    />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label>Description *</Label>
                  <Input
                    value={form.description}
                    onChange={(e) => setForm({ ...form, description: e.target.value })}
                  />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Mode de paiement</Label>
                    <select
                      value={form.mode_paiement}
                      onChange={(e) => setForm({ ...form, mode_paiement: e.target.value as ModePaiement })}
                      className="flex h-9 w-full rounded-lg border border-input bg-transparent px-3 py-2 text-sm outline-none focus:border-ring focus:ring-3 focus:ring-ring/50"
                    >
                      {Object.entries(modesLabels).map(([k, v]) => (
                        <option key={k} value={k}>{v}</option>
                      ))}
                    </select>
                  </div>
                  <div className="space-y-2">
                    <Label>Compte</Label>
                    <select
                      value={form.compte}
                      onChange={(e) => setForm({ ...form, compte: e.target.value as "caisse" | "banque" })}
                      className="flex h-9 w-full rounded-lg border border-input bg-transparent px-3 py-2 text-sm outline-none focus:border-ring focus:ring-3 focus:ring-ring/50"
                    >
                      <option value="caisse">Caisse</option>
                      <option value="banque">Banque</option>
                    </select>
                  </div>
                </div>
                <div className="space-y-2">
                  <Label>Référence</Label>
                  <Input
                    value={form.reference}
                    onChange={(e) => setForm({ ...form, reference: e.target.value })}
                    placeholder="N° reçu, chèque..."
                  />
                </div>
              </div>
              <div className="flex justify-end gap-2">
                <Button variant="outline" onClick={() => setDialogOpen(false)}>Annuler</Button>
                <Button onClick={handleSave} disabled={saving} className="bg-[#DD0000] hover:bg-[#BB0000]">
                  {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  Enregistrer
                </Button>
              </div>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card className="border-0 shadow-sm">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Entrées</p>
                <p className="text-2xl font-bold text-green-600">{formatMontant(totalEntrees)}</p>
              </div>
              <div className="p-3 bg-green-50 rounded-xl">
                <TrendingUp className="h-6 w-6 text-green-600" />
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className="border-0 shadow-sm">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Sorties</p>
                <p className="text-2xl font-bold text-red-600">{formatMontant(totalSorties)}</p>
              </div>
              <div className="p-3 bg-red-50 rounded-xl">
                <TrendingDown className="h-6 w-6 text-red-600" />
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className="border-0 shadow-sm">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Solde</p>
                <p className={`text-2xl font-bold ${solde >= 0 ? "text-green-600" : "text-red-600"}`}>
                  {formatMontant(solde)}
                </p>
              </div>
              <div className="p-3 bg-blue-50 rounded-xl">
                <Wallet className="h-6 w-6 text-blue-600" />
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <Card className="border-0 shadow-sm">
        <CardHeader className="pb-4">
          <div className="flex items-center justify-between">
            <CardTitle className="text-lg">Journal des opérations</CardTitle>
            <select
              value={filtrePeriode}
              onChange={(e) => setFiltrePeriode(e.target.value)}
              className="h-9 rounded-lg border border-input bg-transparent px-3 text-sm outline-none focus:border-ring focus:ring-3 focus:ring-ring/50"
            >
              <option value="jour">Aujourd&apos;hui</option>
              <option value="semaine">Cette semaine</option>
              <option value="mois">Ce mois</option>
              <option value="annee">Cette année</option>
            </select>
          </div>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex justify-center py-12">
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
          ) : operations.length === 0 ? (
            <div className="text-center py-12">
              <Calculator className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
              <p className="text-muted-foreground">Aucune opération pour cette période</p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Date</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>Catégorie</TableHead>
                  <TableHead>Description</TableHead>
                  <TableHead className="hidden md:table-cell">Mode</TableHead>
                  <TableHead className="hidden md:table-cell">Compte</TableHead>
                  <TableHead className="text-right">Montant</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {operations.map((op) => (
                  <TableRow key={op.id}>
                    <TableCell>{formatDate(op.date_operation)}</TableCell>
                    <TableCell>
                      {op.type === "entree" ? (
                        <ArrowUpCircle className="h-5 w-5 text-green-500" />
                      ) : (
                        <ArrowDownCircle className="h-5 w-5 text-red-500" />
                      )}
                    </TableCell>
                    <TableCell>{op.categorie?.nom}</TableCell>
                    <TableCell>{op.description}</TableCell>
                    <TableCell className="hidden md:table-cell">
                      {modesLabels[op.mode_paiement]}
                    </TableCell>
                    <TableCell className="hidden md:table-cell">
                      <Badge variant="secondary">
                        {op.compte === "caisse" ? "Caisse" : "Banque"}
                      </Badge>
                    </TableCell>
                    <TableCell className={`text-right font-medium ${op.type === "entree" ? "text-green-600" : "text-red-600"}`}>
                      {op.type === "entree" ? "+" : "-"}{formatMontant(op.montant)}
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
