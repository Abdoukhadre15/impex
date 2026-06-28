"use client";

import {
  Document,
  Page,
  Text,
  View,
  StyleSheet,
  Image,
} from "@react-pdf/renderer";
import type { Entreprise, Client } from "@/types/database";

interface LigneDocument {
  designation: string;
  quantite: number;
  prix_unitaire: number;
  total_ht: number;
}

interface DocumentPDFProps {
  type: "devis" | "facture";
  numero: string;
  date: string;
  dateSecondaire: string;
  dateSecondaireLabel: string;
  entreprise: Entreprise;
  client: Client;
  lignes: LigneDocument[];
  sousTotal: number;
  remiseGlobale?: number;
  remisePourcent?: number;
  tvaPourcent?: number;
  tvaTotal: number;
  totalTTC: number;
  conditions?: string;
  notes?: string;
  montantPaye?: number;
  resteAPayer?: number;
  apposerSignature?: boolean;
  typeFacture?: string;
  moyenPaiement?: string;
}

function fmt(n: number): string {
  const rounded = Math.round(n);
  return rounded.toString().replace(/\B(?=(\d{3})+(?!\d))/g, " ");
}

function fmtDate(d: string): string {
  return new Intl.DateTimeFormat("fr-FR", {
    day: "2-digit",
    month: "long",
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

  // Top accent
  accentTop: { width: "100%", height: 4, backgroundColor: c.jaune, marginBottom: 2 },
  accentTopRed: { width: "100%", height: 1.5, backgroundColor: c.rouge, marginBottom: 20 },

  // Header
  header: { flexDirection: "row", justifyContent: "space-between", marginBottom: 25 },
  logo: { width: 130, height: 65, objectFit: "contain" },
  headerRight: { textAlign: "right", maxWidth: 210 },
  entNom: { fontSize: 13, fontFamily: "Helvetica-Bold", color: c.rouge, marginBottom: 3 },
  entInfo: { fontSize: 8, color: c.grisTxt, lineHeight: 1.6 },

  // Title
  titleBar: { backgroundColor: c.noir, paddingVertical: 10, paddingHorizontal: 14, marginBottom: 18, flexDirection: "row", justifyContent: "space-between", alignItems: "center", borderRadius: 3 },
  titleText: { fontSize: 18, fontFamily: "Helvetica-Bold", color: c.blanc, letterSpacing: 2 },
  titleNum: { fontSize: 11, color: c.jaune, fontFamily: "Helvetica-Bold" },

  // Info blocks
  infoRow: { flexDirection: "row", justifyContent: "space-between", marginBottom: 18, gap: 12 },
  infoBlock: { width: "48%" },
  infoLabel: { fontSize: 7, fontFamily: "Helvetica-Bold", color: c.rouge, textTransform: "uppercase", letterSpacing: 1.2, marginBottom: 5 },
  infoBox: { backgroundColor: c.gris, padding: 10, borderRadius: 4, borderLeftWidth: 3, borderLeftColor: c.rouge },
  infoName: { fontFamily: "Helvetica-Bold", fontSize: 10, marginBottom: 2 },
  infoTxt: { fontSize: 8, color: c.grisTxt, lineHeight: 1.6 },

  // Table
  tHead: { flexDirection: "row", backgroundColor: c.rouge, paddingVertical: 7, paddingHorizontal: 10, borderRadius: 2, marginBottom: 1 },
  tHeadTxt: { color: c.blanc, fontFamily: "Helvetica-Bold", fontSize: 8 },
  tRow: { flexDirection: "row", paddingVertical: 7, paddingHorizontal: 10, borderBottomWidth: 0.5, borderBottomColor: c.grisBord },
  tRowAlt: { backgroundColor: "#FAFAFA" },
  tNum: { fontFamily: "Helvetica-Bold", fontSize: 9 },
  colDesig: { width: "45%" },
  colQte: { width: "12%", textAlign: "center" },
  colPrix: { width: "22%", textAlign: "right" },
  colTotal: { width: "21%", textAlign: "right" },

  // Totaux
  totauxWrap: { marginTop: 14, alignItems: "flex-end" },
  totauxBox: { width: 260 },
  totRow: { flexDirection: "row", justifyContent: "space-between", paddingVertical: 4, paddingHorizontal: 8 },
  totLabel: { fontSize: 9, color: c.grisTxt },
  totVal: { fontSize: 9, fontFamily: "Helvetica-Bold" },
  totTTCRow: { flexDirection: "row", justifyContent: "space-between", paddingVertical: 9, paddingHorizontal: 8, backgroundColor: c.noir, borderRadius: 3, marginTop: 3 },
  totTTCLabel: { fontSize: 12, fontFamily: "Helvetica-Bold", color: c.jaune },
  totTTCVal: { fontSize: 12, fontFamily: "Helvetica-Bold", color: c.blanc },

  // Sections
  section: { marginTop: 18 },
  secTitle: { fontSize: 7, fontFamily: "Helvetica-Bold", color: c.rouge, textTransform: "uppercase", letterSpacing: 1, marginBottom: 4 },
  secTxt: { fontSize: 8, color: c.grisTxt, lineHeight: 1.5 },

  // Cachet / Signature
  stampWrap: { flexDirection: "row", justifyContent: "flex-end", marginTop: 25, gap: 16, alignItems: "flex-end" },
  stampLabel: { fontSize: 7, color: c.grisTxt, textAlign: "center", marginBottom: 4 },
  stampImg: { width: 110, height: 75, objectFit: "contain" },
  sigImg: { width: 90, height: 55, objectFit: "contain" },

  // Footer
  footer: { position: "absolute", bottom: 24, left: 40, right: 40 },
  footerLine: { height: 1.5, backgroundColor: c.rouge, marginBottom: 6 },
  footerLineAccent: { height: 0.5, backgroundColor: c.jaune, marginBottom: 6 },
  footerTxt: { fontSize: 6.5, color: c.grisTxt, textAlign: "center", lineHeight: 1.6 },
});

export function DocumentPDF({
  type,
  numero,
  date,
  dateSecondaire,
  dateSecondaireLabel,
  entreprise,
  client,
  lignes,
  sousTotal,
  remiseGlobale = 0,
  remisePourcent = 0,
  tvaPourcent = 18,
  tvaTotal,
  totalTTC,
  conditions,
  notes,
  montantPaye,
  resteAPayer,
  apposerSignature = true,
  typeFacture,
  moyenPaiement,
}: DocumentPDFProps) {
  const titre = type === "devis" ? "DEVIS" : typeFacture ? `FACTURE ${typeFacture.toUpperCase()}` : "FACTURE";

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
              {entreprise.telephone_fixe ? `\nFixe: ${entreprise.telephone_fixe}` : ""}
              {"\n"}{entreprise.email}
              {entreprise.ninea ? `\nNINEA: ${entreprise.ninea}` : ""}
              {entreprise.rc ? `\nRC: ${entreprise.rc}` : ""}
            </Text>
          </View>
        </View>

        {/* Titre */}
        <View style={s.titleBar}>
          <Text style={s.titleText}>{titre}</Text>
          <Text style={s.titleNum}>{numero}</Text>
        </View>

        {/* Client + Dates */}
        <View style={s.infoRow}>
          <View style={s.infoBlock}>
            <Text style={s.infoLabel}>Client</Text>
            <View style={s.infoBox}>
              <Text style={s.infoName}>{client.nom}</Text>
              <Text style={s.infoTxt}>
                {client.raison_sociale ? `${client.raison_sociale}\n` : ""}
                {client.adresse ? `${client.adresse}\n` : ""}
                {client.telephone ? `Tél: ${client.telephone}` : ""}
                {client.email ? `\n${client.email}` : ""}
                {client.ninea ? `\nNINEA: ${client.ninea}` : ""}
              </Text>
            </View>
          </View>
          <View style={s.infoBlock}>
            <Text style={s.infoLabel}>Détails</Text>
            <View style={s.infoBox}>
              <Text style={s.infoTxt}>
                Date : {fmtDate(date)}
                {"\n"}{dateSecondaireLabel} : {fmtDate(dateSecondaire)}
                {conditions ? `\nPaiement : ${conditions}` : ""}
                {moyenPaiement ? `\nMoyen : ${moyenPaiement}` : ""}
              </Text>
            </View>
          </View>
        </View>

        {/* Tableau */}
        <View style={s.tHead}>
          <Text style={[s.tHeadTxt, s.colDesig]}>Désignation</Text>
          <Text style={[s.tHeadTxt, s.colQte]}>Qté</Text>
          <Text style={[s.tHeadTxt, s.colPrix]}>Prix unitaire</Text>
          <Text style={[s.tHeadTxt, s.colTotal]}>Total</Text>
        </View>

        {lignes.map((ligne, i) => (
          <View key={i} style={[s.tRow, i % 2 === 1 ? s.tRowAlt : {}]}>
            <Text style={s.colDesig}>{ligne.designation}</Text>
            <Text style={[s.colQte, s.tNum]}>{ligne.quantite}</Text>
            <Text style={s.colPrix}>{fmt(ligne.prix_unitaire)} FCFA</Text>
            <Text style={[s.colTotal, s.tNum]}>{fmt(ligne.total_ht)} FCFA</Text>
          </View>
        ))}

        {/* Totaux */}
        <View style={s.totauxWrap}>
          <View style={s.totauxBox}>
            <View style={s.totRow}>
              <Text style={s.totLabel}>Sous-total</Text>
              <Text style={s.totVal}>{fmt(sousTotal)} FCFA</Text>
            </View>
            {remiseGlobale > 0 && (
              <View style={s.totRow}>
                <Text style={s.totLabel}>Remise ({remisePourcent}%)</Text>
                <Text style={[s.totVal, { color: c.rouge }]}>-{fmt(remiseGlobale)} FCFA</Text>
              </View>
            )}
            <View style={s.totRow}>
              <Text style={s.totLabel}>TVA ({tvaPourcent}%)</Text>
              <Text style={s.totVal}>{fmt(tvaTotal)} FCFA</Text>
            </View>
            <View style={s.totTTCRow}>
              <Text style={s.totTTCLabel}>TOTAL TTC</Text>
              <Text style={s.totTTCVal}>{fmt(totalTTC)} FCFA</Text>
            </View>

            {type === "facture" && montantPaye !== undefined && (
              <>
                <View style={[s.totRow, { marginTop: 6 }]}>
                  <Text style={s.totLabel}>Montant payé</Text>
                  <Text style={[s.totVal, { color: c.vert }]}>{fmt(montantPaye)} FCFA</Text>
                </View>
                {(resteAPayer ?? 0) > 0 && (
                  <View style={s.totRow}>
                    <Text style={[s.totLabel, { fontFamily: "Helvetica-Bold" }]}>Reste à payer</Text>
                    <Text style={[s.totVal, { color: c.rouge, fontSize: 10 }]}>{fmt(resteAPayer ?? 0)} FCFA</Text>
                  </View>
                )}
              </>
            )}
          </View>
        </View>

        {/* Notes */}
        {notes && (
          <View style={s.section}>
            <Text style={s.secTitle}>Notes</Text>
            <Text style={s.secTxt}>{notes}</Text>
          </View>
        )}

        {/* Conditions générales */}
        {entreprise.conditions_generales && (
          <View style={s.section}>
            <Text style={s.secTitle}>Conditions générales</Text>
            <Text style={s.secTxt}>{entreprise.conditions_generales}</Text>
          </View>
        )}

        {/* Cachet et Signature */}
        {apposerSignature && (entreprise.cachet_url || entreprise.signature_url) && (
          <View style={s.stampWrap}>
            {entreprise.cachet_url && (
              <Image src={entreprise.cachet_url} style={s.stampImg} />
            )}
            {entreprise.signature_url && (
              <Image src={entreprise.signature_url} style={s.sigImg} />
            )}
          </View>
        )}

        {/* Mentions légales */}
        {entreprise.mentions_legales && (
          <View style={[s.section, { marginTop: 12 }]}>
            <Text style={{ fontSize: 6.5, color: "#9CA3AF" }}>{entreprise.mentions_legales}</Text>
          </View>
        )}

        {/* Pied de page */}
        <View style={s.footer} fixed>
          <View style={s.footerLine} />
          <View style={s.footerLineAccent} />
          <Text style={s.footerTxt}>
            {entreprise.nom} — {entreprise.adresse} — Tél: {entreprise.telephone}{entreprise.telephone_fixe ? ` / Fixe: ${entreprise.telephone_fixe}` : ""} — {entreprise.email}
            {entreprise.coordonnees_bancaires ? `\n${entreprise.coordonnees_bancaires}` : ""}
          </Text>
        </View>
      </Page>
    </Document>
  );
}
