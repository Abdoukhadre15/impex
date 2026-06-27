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
  Clock,
} from "lucide-react";

interface DashboardStats {
  totalClients: number;
  totalProduits: number;
  devisEnCours: number;
  facturesImpayees: number;
  caMois: number;
  facturesRetard: number;
}

export default function TableauDeBordPage() {
  const [stats, setStats] = useState<DashboardStats>({
    totalClients: 0,
    totalProduits: 0,
    devisEnCours: 0,
    facturesImpayees: 0,
    caMois: 0,
    facturesRetard: 0,
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const loadStats = async () => {
      const supabase = createClient();

      const [clients, produits, devis, factures] = await Promise.all([
        supabase.from("clients").select("id", { count: "exact", head: true }),
        supabase.from("produits").select("id", { count: "exact", head: true }),
        supabase
          .from("devis")
          .select("id", { count: "exact", head: true })
          .in("statut", ["brouillon", "envoye"]),
        supabase
          .from("factures")
          .select("total_ttc, montant_paye, statut, date_echeance")
          .in("statut", ["envoyee", "payee_partiellement"]),
      ]);

      const now = new Date();
      const debutMois = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();

      const { data: facturesMois } = await supabase
        .from("factures")
        .select("total_ttc")
        .eq("statut", "payee")
        .gte("date_facture", debutMois);

      const caMois = facturesMois?.reduce((acc, f) => acc + f.total_ttc, 0) ?? 0;
      const facturesRetard = factures.data?.filter(
        (f) => new Date(f.date_echeance) < now
      ).length ?? 0;

      setStats({
        totalClients: clients.count ?? 0,
        totalProduits: produits.count ?? 0,
        devisEnCours: devis.count ?? 0,
        facturesImpayees: factures.data?.length ?? 0,
        caMois,
        facturesRetard,
      });
      setLoading(false);
    };

    loadStats();
  }, []);

  const kpis = [
    {
      title: "Chiffre d'affaires du mois",
      value: formatMontant(stats.caMois),
      icon: TrendingUp,
      color: "text-green-600",
      bg: "bg-green-50",
    },
    {
      title: "Clients",
      value: stats.totalClients.toString(),
      icon: Users,
      color: "text-blue-600",
      bg: "bg-blue-50",
    },
    {
      title: "Devis en cours",
      value: stats.devisEnCours.toString(),
      icon: FileText,
      color: "text-[#FFCE00]",
      bg: "bg-yellow-50",
    },
    {
      title: "Factures impayées",
      value: stats.facturesImpayees.toString(),
      icon: Receipt,
      color: "text-[#DD0000]",
      bg: "bg-red-50",
    },
    {
      title: "Produits",
      value: stats.totalProduits.toString(),
      icon: Package,
      color: "text-purple-600",
      bg: "bg-purple-50",
    },
    {
      title: "Factures en retard",
      value: stats.facturesRetard.toString(),
      icon: AlertCircle,
      color: "text-orange-600",
      bg: "bg-orange-50",
    },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Tableau de bord</h1>
        <p className="text-muted-foreground">
          Vue d&apos;ensemble de votre activité commerciale
        </p>
      </div>

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

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card className="border-0 shadow-sm">
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <Clock className="h-5 w-5 text-muted-foreground" />
              Activité récente
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-sm text-muted-foreground text-center py-8">
              Les dernières activités apparaîtront ici
            </div>
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
            <div className="text-sm text-muted-foreground text-center py-8">
              Aucune alerte pour le moment
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
