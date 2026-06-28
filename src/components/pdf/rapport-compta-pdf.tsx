"use client";

import {
  Document,
  Page,
  Text,
  View,
  StyleSheet,
  Image,
} from "@react-pdf/renderer";
import type { Entreprise, OperationCompta, CategorieCompta } from "@/types/database";

function fmt(n: number): string {
  const rounded = Math.round(n);
  return rounded.toString().replace(/\B(?=(\d{3})+(?!\d))/g, " ");
}

function fmtDate(d: string): string {
  return new Intl.DateTimeFormat("fr-FR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  }).format(new Date(d));
}

const c = {
  noir: "#000000",
  rouge: "#DD0000",
  jaune: "#FFCE00",
  gris: "#F5F5F5",
  grisTxt: "#6B7280",
  grisBord: "#E5E7EB",
  blanc: "#FFFFFF",
  vert: "#22C55E",
};

const s = StyleSheet.create({
  page: { padding: 40, paddingBottom: 80, fontSize: 9, fontFamily: "Helvetica", color: "#1a1a1a" },
  accentTop: { width: "100%", height: 4, backgroundColor: c.jaune, marginBottom: 2 },
  accentTopRed: { width: "100%", height: 1.5, backgroundColor: c.rouge, marginBottom: 20 },
  header: { flexDirection: "row", justifyContent: "space-between", marginBottom: 20 },
  logo: { width: 120, height: 60, objectFit: "contain" },
  headerRight: { textAlign: "right", maxWidth: 200 },
  entNom: { fontSize: 13, fontFamily: "Helvetica-Bold", color: c.rouge, marginBottom: 3 },
  entInfo: { fontSize: 8, color: c.grisTxt, lineHeight: 1.6 },
  titleBar: { backgroundColor: c.noir, paddingVertical: 8, paddingHorizontal: 14, marginBottom: 18, borderRadius: 3 },
  titleText: { fontSize: 14, fontFamily: "Helvetica-Bold", color: c.blanc },
  titleSub: { fontSize: 9, color: c.jaune, marginTop: 2 },
  kpiRow: { flexDirection: "row", gap: 10, marginBottom: 18 },
  kpiBox: { flex: 1, padding: 10, borderRadius: 4, backgroundColor: c.gris },
  kpiLabel: { fontSize: 7, color: c.grisTxt, textTransform: "uppercase", marginBottom: 3 },
  kpiValue: { fontSize: 14, fontFamily: "Helvetica-Bold" },
  tHead: { flexDirection: "row", backgroundColor: c.rouge, paddingVertical: 6, paddingHorizontal: 8, borderRadius: 2, marginBottom: 1 },
  tHeadTxt: { color: c.blanc, fontFamily: "Helvetica-Bold", fontSize: 7.5 },
  tRow: { flexDirection: "row", paddingVertical: 5, paddingHorizontal: 8, borderBottomWidth: 0.5, borderBottomColor: c.grisBord },
  tRowAlt: { backgroundColor: "#FAFAFA" },
  colDate: { width: "12%" },
  colType: { width: "8%", textAlign: "center" },
  colCat: { width: "18%" },
  colDesc: { width: "27%" },
  colMode: { width: "12%" },
  colCompte: { width: "10%", textAlign: "center" },
  colMontant: { width: "13%", textAlign: "right" },
  sectionTitle: { fontSize: 10, fontFamily: "Helvetica-Bold", marginTop: 16, marginBottom: 8, color: c.noir },
  catRow: { flexDirection: "row", justifyContent: "space-between", paddingVertical: 3, paddingHorizontal: 8, borderBottomWidth: 0.5, borderBottomColor: c.grisBord },
  catLabel: { fontSize: 9 },
  catValue: { fontSize: 9, fontFamily: "Helvetica-Bold" },
  footer: { position: "absolute", bottom: 24, left: 40, right: 40 },
  footerLine: { height: 1.5, backgroundColor: c.rouge, marginBottom: 4 },
  footerLineAccent: { height: 0.5, backgroundColor: c.jaune, marginBottom: 4 },
  footerTxt: { fontSize: 6.5, color: c.grisTxt, textAlign: "center", lineHeight: 1.6 },
});

const modesLabels: Record<string, string> = {
  especes: "Espèces", virement: "Virement", cheque: "Chèque",
  mobile_money: "Mobile Money", carte: "Carte", autre: "Autre",
};

interface RapportComptaPDFProps {
  entreprise: Entreprise;
  operations: (OperationCompta & { categorie: CategorieCompta })[];
  periode: string;
  totalEntrees: number;
  totalSorties: number;
  solde: number;
}

export function RapportComptaPDF({
  entreprise,
  operations,
  periode,
  totalEntrees,
  totalSorties,
  solde,
}: RapportComptaPDFProps) {
  const periodeLabels: Record<string, string> = {
    jour: "Aujourd'hui",
    semaine: "Cette semaine",
    mois: "Ce mois",
    annee: "Cette année",
  };

  const entreesByCat = new Map<string, number>();
  const sortiesByCat = new Map<string, number>();
  operations.forEach((op) => {
    const map = op.type === "entree" ? entreesByCat : sortiesByCat;
    const key = op.categorie?.nom ?? "Autre";
    map.set(key, (map.get(key) ?? 0) + op.montant);
  });

  return (
    <Document>
      <Page size="A4" style={s.page}>
        <View style={s.accentTop} />
        <View style={s.accentTopRed} />

        {/* En-tête */}
        <View style={s.header}>
          <View>
            {entreprise.logo_url ? (
              <Image src={entreprise.logo_url} style={s.logo} />
            ) : (
              <Text style={s.entNom}>{entreprise.nom}</Text>
            )}
          </View>
          <View style={s.headerRight}>
            {entreprise.logo_url && <Text style={s.entNom}>{entreprise.nom}</Text>}
            <Text style={s.entInfo}>
              {entreprise.adresse}
              {"\n"}Tél: {entreprise.telephone}
              {"\n"}{entreprise.email}
            </Text>
          </View>
        </View>

        {/* Titre */}
        <View style={s.titleBar}>
          <Text style={s.titleText}>RAPPORT COMPTABLE</Text>
          <Text style={s.titleSub}>
            Période : {periodeLabels[periode] ?? periode} — Généré le {fmtDate(new Date().toISOString())}
          </Text>
        </View>

        {/* KPIs */}
        <View style={s.kpiRow}>
          <View style={s.kpiBox}>
            <Text style={s.kpiLabel}>Total Entrées</Text>
            <Text style={[s.kpiValue, { color: c.vert }]}>{fmt(totalEntrees)} FCFA</Text>
          </View>
          <View style={s.kpiBox}>
            <Text style={s.kpiLabel}>Total Sorties</Text>
            <Text style={[s.kpiValue, { color: c.rouge }]}>{fmt(totalSorties)} FCFA</Text>
          </View>
          <View style={s.kpiBox}>
            <Text style={s.kpiLabel}>Solde</Text>
            <Text style={[s.kpiValue, { color: solde >= 0 ? c.vert : c.rouge }]}>{fmt(solde)} FCFA</Text>
          </View>
        </View>

        {/* Résumé par catégorie — Entrées */}
        {entreesByCat.size > 0 && (
          <>
            <Text style={s.sectionTitle}>Entrées par catégorie</Text>
            {Array.from(entreesByCat.entries()).map(([cat, montant]) => (
              <View key={cat} style={s.catRow}>
                <Text style={s.catLabel}>{cat}</Text>
                <Text style={[s.catValue, { color: c.vert }]}>+{fmt(montant)} FCFA</Text>
              </View>
            ))}
          </>
        )}

        {/* Résumé par catégorie — Sorties */}
        {sortiesByCat.size > 0 && (
          <>
            <Text style={s.sectionTitle}>Sorties par catégorie</Text>
            {Array.from(sortiesByCat.entries()).map(([cat, montant]) => (
              <View key={cat} style={s.catRow}>
                <Text style={s.catLabel}>{cat}</Text>
                <Text style={[s.catValue, { color: c.rouge }]}>-{fmt(montant)} FCFA</Text>
              </View>
            ))}
          </>
        )}

        {/* Détail des opérations */}
        <Text style={[s.sectionTitle, { marginTop: 20 }]}>
          Détail des opérations ({operations.length})
        </Text>

        <View style={s.tHead}>
          <Text style={[s.tHeadTxt, s.colDate]}>Date</Text>
          <Text style={[s.tHeadTxt, s.colType]}>Type</Text>
          <Text style={[s.tHeadTxt, s.colCat]}>Catégorie</Text>
          <Text style={[s.tHeadTxt, s.colDesc]}>Description</Text>
          <Text style={[s.tHeadTxt, s.colMode]}>Mode</Text>
          <Text style={[s.tHeadTxt, s.colCompte]}>Compte</Text>
          <Text style={[s.tHeadTxt, s.colMontant]}>Montant</Text>
        </View>

        {operations.map((op, i) => (
          <View key={i} style={[s.tRow, i % 2 === 1 ? s.tRowAlt : {}]}>
            <Text style={s.colDate}>{fmtDate(op.date_operation)}</Text>
            <Text style={[s.colType, { color: op.type === "entree" ? c.vert : c.rouge }]}>
              {op.type === "entree" ? "+" : "-"}
            </Text>
            <Text style={s.colCat}>{op.categorie?.nom}</Text>
            <Text style={s.colDesc}>{op.description}</Text>
            <Text style={s.colMode}>{modesLabels[op.mode_paiement] ?? op.mode_paiement}</Text>
            <Text style={s.colCompte}>{op.compte === "caisse" ? "Caisse" : "Banque"}</Text>
            <Text style={[s.colMontant, { fontFamily: "Helvetica-Bold", color: op.type === "entree" ? c.vert : c.rouge }]}>
              {op.type === "entree" ? "+" : "-"}{fmt(op.montant)}
            </Text>
          </View>
        ))}

        {/* Pied de page */}
        <View style={s.footer} fixed>
          <View style={s.footerLine} />
          <View style={s.footerLineAccent} />
          <Text style={s.footerTxt}>
            {entreprise.nom} — {entreprise.adresse} — Tél: {entreprise.telephone} — {entreprise.email}
          </Text>
        </View>
      </Page>
    </Document>
  );
}
