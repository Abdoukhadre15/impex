"use client";

import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { createClient } from "@/lib/supabase/client";
import { formatMontant } from "@/lib/formatters";
import {
  Users,
  FileText,
  Receipt,
  Package,
  TrendingUp,
  AlertCircle,
} from "lucide-react";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
  PieChart,
  Pie,
  Cell,
} from "recharts";

interface DashboardStats {
  totalClients: number;
  totalProduits: number;
  devisEnCours: number;
  facturesImpayees: number;
  caMois: number;
  facturesRetard: number;
}

interface MoisData {
  mois: string;
  recettes: number;
  depenses: number;
}

interface CatData {
  name: string;
  value: number;
}

const COLORS_PIE = ["#DD0000", "#FFCE00", "#000000", "#3B82F6", "#22C55E", "#F59E0B", "#8B5CF6", "#EC4899"];

const MOIS_LABELS = ["Jan", "Fév", "Mar", "Avr", "Mai", "Juin", "Juil", "Août", "Sep", "Oct", "Nov", "Déc"];

export default function TableauDeBordPage() {
  const [stats, setStats] = useState<DashboardStats>({
    totalClients: 0,
    totalProduits: 0,
    devisEnCours: 0,
    facturesImpayees: 0,
    caMois: 0,
    facturesRetard: 0,
  });
  const [barData, setBarData] = useState<MoisData[]>([]);
  const [pieData, setPieData] = useState<CatData[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const loadAll = async () => {
      const supabase = createClient();
      const now = new Date();
      const annee = now.getFullYear();

      const [clients, produits, devis, factures] = await Promise.all([
        supabase.from("clients").select("id", { count: "exact", head: true }),
        supabase.from("produits").select("id", { count: "exact", head: true }),
        supabase.from("devis").select("id", { count: "exact", head: true }).in("statut", ["brouillon", "envoye"]),
        supabase.from("factures").select("total_ttc, montant_paye, statut, date_echeance").in("statut", ["envoyee", "payee_partiellement"]),
      ]);

      const debutMois = new Date(annee, now.getMonth(), 1).toISOString();
      const { data: facturesMois } = await supabase
        .from("factures")
        .select("total_ttc")
        .eq("statut", "payee")
        .gte("date_facture", debutMois);

      const caMois = facturesMois?.reduce((acc, f) => acc + f.total_ttc, 0) ?? 0;
      const facturesRetard = factures.data?.filter((f) => new Date(f.date_echeance) < now).length ?? 0;

      setStats({
        totalClients: clients.count ?? 0,
        totalProduits: produits.count ?? 0,
        devisEnCours: devis.count ?? 0,
        facturesImpayees: factures.data?.length ?? 0,
        caMois,
        facturesRetard,
      });

      const debutAnnee = `${annee}-01-01`;
      const finAnnee = `${annee}-12-31`;

      const { data: opsAnnee } = await supabase
        .from("operations_compta")
        .select("type, montant, date_operation, categorie_id")
        .gte("date_operation", debutAnnee)
        .lte("date_operation", finAnnee);

      const moisMap: Record<number, { recettes: number; depenses: number }> = {};
      for (let i = 0; i < 12; i++) moisMap[i] = { recettes: 0, depenses: 0 };

      (opsAnnee ?? []).forEach((op) => {
        const m = new Date(op.date_operation).getMonth();
        if (op.type === "entree") moisMap[m].recettes += op.montant;
        else moisMap[m].depenses += op.montant;
      });

      setBarData(
        MOIS_LABELS.map((label, i) => ({
          mois: label,
          recettes: moisMap[i].recettes,
          depenses: moisMap[i].depenses,
        }))
      );

      const { data: catProducts } = await supabase
        .from("produits")
        .select("categorie_id, categorie:categories(nom)")
        .eq("actif", true);

      const catCount = new Map<string, number>();
      (catProducts ?? []).forEach((p: Record<string, unknown>) => {
        const cat = p.categorie as { nom: string } | null;
        const name = cat?.nom ?? "Sans catégorie";
        catCount.set(name, (catCount.get(name) ?? 0) + 1);
      });

      setPieData(
        Array.from(catCount.entries())
          .map(([name, value]) => ({ name, value }))
          .sort((a, b) => b.value - a.value)
      );

      setLoading(false);
    };

    loadAll();
  }, []);

  const kpis = [
    { title: "CA du mois", value: formatMontant(stats.caMois), icon: TrendingUp, color: "text-green-600", bg: "bg-green-50" },
    { title: "Clients", value: stats.totalClients.toString(), icon: Users, color: "text-blue-600", bg: "bg-blue-50" },
    { title: "Devis en cours", value: stats.devisEnCours.toString(), icon: FileText, color: "text-[#FFCE00]", bg: "bg-yellow-50" },
    { title: "Factures impayées", value: stats.facturesImpayees.toString(), icon: Receipt, color: "text-[#DD0000]", bg: "bg-red-50" },
    { title: "Produits", value: stats.totalProduits.toString(), icon: Package, color: "text-purple-600", bg: "bg-purple-50" },
    { title: "Factures en retard", value: stats.facturesRetard.toString(), icon: AlertCircle, color: "text-orange-600", bg: "bg-orange-50" },
  ];

  const formatTooltip = ((value: number) => formatMontant(value)) as never;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Tableau de bord</h1>
        <p className="text-muted-foreground">Vue d&apos;ensemble de votre activité commerciale</p>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {kpis.map((kpi) => (
          <Card key={kpi.title} className="border-0 shadow-sm">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">{kpi.title}</p>
                  <p className="text-2xl font-bold mt-1">
                    {loading ? (
                      <span className="inline-block w-20 h-7 bg-gray-200 rounded animate-pulse" />
                    ) : (
                      kpi.value
                    )}
                  </p>
                </div>
                <div className={`p-3 rounded-xl ${kpi.bg}`}>
                  <kpi.icon className={`h-6 w-6 ${kpi.color}`} />
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Graphique Recettes/Dépenses 12 mois */}
      <Card className="border-0 shadow-sm">
        <CardHeader>
          <CardTitle className="text-lg">Recettes & Dépenses — {new Date().getFullYear()}</CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="h-[350px] flex items-center justify-center">
              <span className="text-muted-foreground">Chargement...</span>
            </div>
          ) : (
            <ResponsiveContainer width="100%" height={350}>
              <BarChart data={barData} margin={{ top: 5, right: 20, left: 10, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#E5E7EB" />
                <XAxis dataKey="mois" tick={{ fontSize: 12 }} />
                <YAxis tick={{ fontSize: 11 }} tickFormatter={(v) => v >= 1000 ? `${Math.round(v / 1000)}k` : v} />
                <Tooltip formatter={formatTooltip} />
                <Legend />
                <Bar dataKey="recettes" name="Recettes" fill="#22C55E" radius={[4, 4, 0, 0]} />
                <Bar dataKey="depenses" name="Dépenses" fill="#DD0000" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          )}
        </CardContent>
      </Card>

      {/* Graphique circulaire produits par catégorie */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card className="border-0 shadow-sm">
          <CardHeader>
            <CardTitle className="text-lg">Produits par catégorie</CardTitle>
          </CardHeader>
          <CardContent>
            {loading || pieData.length === 0 ? (
              <div className="h-[300px] flex items-center justify-center">
                <span className="text-muted-foreground">
                  {loading ? "Chargement..." : "Aucun produit"}
                </span>
              </div>
            ) : (
              <div className="flex items-center gap-4">
                <ResponsiveContainer width="60%" height={300}>
                  <PieChart>
                    <Pie
                      data={pieData}
                      cx="50%"
                      cy="50%"
                      innerRadius={60}
                      outerRadius={110}
                      paddingAngle={3}
                      dataKey="value"
                    >
                      {pieData.map((_, i) => (
                        <Cell key={i} fill={COLORS_PIE[i % COLORS_PIE.length]} />
                      ))}
                    </Pie>
                    <Tooltip formatter={((value: number) => `${value} produit${value > 1 ? "s" : ""}`) as never} />
                  </PieChart>
                </ResponsiveContainer>
                <div className="flex-1 space-y-2">
                  {pieData.map((item, i) => (
                    <div key={item.name} className="flex items-center gap-2 text-sm">
                      <div
                        className="w-3 h-3 rounded-full shrink-0"
                        style={{ backgroundColor: COLORS_PIE[i % COLORS_PIE.length] }}
                      />
                      <span className="text-muted-foreground flex-1 truncate">{item.name}</span>
                      <span className="font-medium">{item.value}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        <Card className="border-0 shadow-sm">
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <AlertCircle className="h-5 w-5 text-muted-foreground" />
              Alertes
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {loading ? (
                <div className="text-sm text-muted-foreground text-center py-8">Chargement...</div>
              ) : (
                <>
                  {stats.facturesRetard > 0 && (
                    <div className="flex items-center gap-3 p-3 bg-red-50 rounded-lg">
                      <AlertCircle className="h-5 w-5 text-red-500 shrink-0" />
                      <p className="text-sm">
                        <span className="font-semibold text-red-700">{stats.facturesRetard}</span>{" "}
                        facture{stats.facturesRetard > 1 ? "s" : ""} en retard de paiement
                      </p>
                    </div>
                  )}
                  {stats.facturesImpayees > 0 && (
                    <div className="flex items-center gap-3 p-3 bg-orange-50 rounded-lg">
                      <Receipt className="h-5 w-5 text-orange-500 shrink-0" />
                      <p className="text-sm">
                        <span className="font-semibold text-orange-700">{stats.facturesImpayees}</span>{" "}
                        facture{stats.facturesImpayees > 1 ? "s" : ""} impayée{stats.facturesImpayees > 1 ? "s" : ""}
                      </p>
                    </div>
                  )}
                  {stats.facturesRetard === 0 && stats.facturesImpayees === 0 && (
                    <div className="text-sm text-muted-foreground text-center py-8">
                      Aucune alerte pour le moment
                    </div>
                  )}
                </>
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
