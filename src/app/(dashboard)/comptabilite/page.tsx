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
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  PieChart,
  Pie,
  Cell,
  Tooltip as RechartsTooltip,
  ResponsiveContainer,
} from "recharts";
import type { OperationCompta, CategorieCompta, TypeOperation, ModePaiement, Entreprise } from "@/types/database";
import { formatMontant, formatDate } from "@/lib/formatters";
import { PERIODES, getDateRange, type PeriodeValue } from "@/lib/periodes";
import { pdf } from "@react-pdf/renderer";
import { RapportComptaPDF } from "@/components/pdf/rapport-compta-pdf";

const PIE_COLORS = ["#DD0000", "#FFCE00", "#22C55E", "#3B82F6", "#000000", "#F59E0B", "#8B5CF6", "#EC4899", "#14B8A6", "#6366F1", "#F97316"];

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
  const [filtrePeriode, setFiltrePeriode] = useState<PeriodeValue>("ce_mois");
  const [generatingPDF, setGeneratingPDF] = useState(false);
  const [nouvelleCat, setNouvelleCat] = useState("");

  const loadData = async () => {
    const supabase = createClient();
    const { debut, fin } = getDateRange(filtrePeriode);

    const [opsRes, catsRes, entRes] = await Promise.all([
      supabase
        .from("operations_compta")
        .select("*, categorie:categories_compta(*)")
        .gte("date_operation", debut)
        .lte("date_operation", fin)
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

  const selectedCatIsAutre = (() => {
    const cat = categories.find((c) => c.id === form.categorie_id);
    return cat?.nom?.toLowerCase().includes("autres");
  })();

  const handleSave = async () => {
    if (!form.categorie_id || !form.description || form.montant <= 0) {
      toast.error("Remplissez tous les champs obligatoires");
      return;
    }
    setSaving(true);
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    let categorieId = form.categorie_id;

    if (selectedCatIsAutre && nouvelleCat.trim()) {
      const { data: existante } = await supabase
        .from("categories_compta")
        .select("id")
        .eq("nom", nouvelleCat.trim())
        .eq("type", form.type)
        .single();

      if (existante) {
        categorieId = existante.id;
      } else {
        const { data: newCat, error: catError } = await supabase
          .from("categories_compta")
          .insert([{ nom: nouvelleCat.trim(), type: form.type }])
          .select()
          .single();

        if (catError || !newCat) {
          toast.error("Erreur lors de la création de la catégorie");
          setSaving(false);
          return;
        }
        categorieId = newCat.id;
      }
    }

    const { error } = await supabase.from("operations_compta").insert([{
      ...form,
      categorie_id: categorieId,
      created_by: user.id,
    }]);

    if (error) toast.error("Erreur lors de l'enregistrement");
    else {
      toast.success("Opération enregistrée");
      setDialogOpen(false);
      setForm(emptyOp);
      setNouvelleCat("");
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
                    onChange={(e) => { setForm({ ...form, categorie_id: e.target.value }); setNouvelleCat(""); }}
                    className="flex h-9 w-full rounded-lg border border-input bg-transparent px-3 py-2 text-sm outline-none focus:border-ring focus:ring-3 focus:ring-ring/50"
                  >
                    <option value="">-- Choisir --</option>
                    {filteredCategories.map((c) => (
                      <option key={c.id} value={c.id}>{c.nom}</option>
                    ))}
                  </select>
                  {selectedCatIsAutre && (
                    <Input
                      value={nouvelleCat}
                      onChange={(e) => setNouvelleCat(e.target.value)}
                      placeholder="Saisir le nom de la nouvelle catégorie..."
                      className="mt-2"
                    />
                  )}
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

      {/* Graphiques par catégorie */}
      {operations.length > 0 && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <Card className="border-0 shadow-sm">
            <CardHeader>
              <CardTitle className="text-lg">Entrées par catégorie</CardTitle>
            </CardHeader>
            <CardContent>
              {(() => {
                const entreesMap = new Map<string, number>();
                operations.filter((o) => o.type === "entree").forEach((o) => {
                  const cat = o.categorie?.nom ?? "Autre";
                  entreesMap.set(cat, (entreesMap.get(cat) ?? 0) + o.montant);
                });
                const data = Array.from(entreesMap.entries())
                  .map(([name, value]) => ({ name, value }))
                  .sort((a, b) => b.value - a.value);
                if (data.length === 0) return <p className="text-sm text-muted-foreground text-center py-8">Aucune entrée</p>;
                return (
                  <ResponsiveContainer width="100%" height={Math.max(data.length * 50, 120)}>
                    <BarChart data={data} layout="vertical" margin={{ top: 0, right: 20, left: 0, bottom: 0 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#E5E7EB" horizontal={false} />
                      <XAxis type="number" tick={{ fontSize: 11 }} tickFormatter={(v: number) => v >= 1000000 ? `${(v / 1000000).toFixed(1)}M` : v >= 1000 ? `${Math.round(v / 1000)}k` : String(v)} />
                      <YAxis type="category" dataKey="name" tick={{ fontSize: 11 }} width={130} />
                      <RechartsTooltip formatter={((v: number) => formatMontant(v)) as never} />
                      <Bar dataKey="value" name="Montant" fill="#22C55E" radius={[0, 4, 4, 0]} barSize={24} />
                    </BarChart>
                  </ResponsiveContainer>
                );
              })()}
            </CardContent>
          </Card>

          <Card className="border-0 shadow-sm">
            <CardHeader>
              <CardTitle className="text-lg">Sorties par catégorie</CardTitle>
            </CardHeader>
            <CardContent>
              {(() => {
                const sortiesMap = new Map<string, number>();
                operations.filter((o) => o.type === "sortie").forEach((o) => {
                  const cat = o.categorie?.nom ?? "Autre";
                  sortiesMap.set(cat, (sortiesMap.get(cat) ?? 0) + o.montant);
                });
                const data = Array.from(sortiesMap.entries())
                  .map(([name, value]) => ({ name, value }))
                  .sort((a, b) => b.value - a.value);
                if (data.length === 0) return <p className="text-sm text-muted-foreground text-center py-8">Aucune sortie</p>;
                return (
                  <div className="flex items-center gap-4">
                    <ResponsiveContainer width="55%" height={250}>
                      <PieChart>
                        <Pie data={data} cx="50%" cy="50%" innerRadius={50} outerRadius={95} paddingAngle={3} dataKey="value">
                          {data.map((_, i) => <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />)}
                        </Pie>
                        <RechartsTooltip formatter={((v: number) => formatMontant(v)) as never} />
                      </PieChart>
                    </ResponsiveContainer>
                    <div className="flex-1 space-y-2">
                      {data.map((item, i) => (
                        <div key={item.name} className="flex items-center gap-2 text-sm">
                          <div className="w-3 h-3 rounded-full shrink-0" style={{ backgroundColor: PIE_COLORS[i % PIE_COLORS.length] }} />
                          <span className="text-muted-foreground flex-1 truncate">{item.name}</span>
                          <span className="font-medium text-red-600">{formatMontant(item.value)}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                );
              })()}
            </CardContent>
          </Card>
        </div>
      )}

      <Card className="border-0 shadow-sm">
        <CardHeader className="pb-4">
          <div className="flex items-center justify-between">
            <CardTitle className="text-lg">Journal des opérations</CardTitle>
            <select
              value={filtrePeriode}
              onChange={(e) => setFiltrePeriode(e.target.value as PeriodeValue)}
              className="h-9 rounded-lg border border-input bg-transparent px-3 text-sm outline-none focus:border-ring focus:ring-3 focus:ring-ring/50"
            >
              {PERIODES.map((p) => (
                <option key={p.value} value={p.value}>{p.label}</option>
              ))}
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
