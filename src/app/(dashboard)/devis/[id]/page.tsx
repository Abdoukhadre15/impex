"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { toast } from "sonner";
import { ArrowLeft, Download, Loader2 } from "lucide-react";
import { formatMontant, formatDate } from "@/lib/formatters";
import { pdf } from "@react-pdf/renderer";
import { DocumentPDF } from "@/components/pdf/document-pdf";
import type { Devis, LigneDevis, Client, Entreprise, StatutDevis } from "@/types/database";
import Link from "next/link";

const statutColors: Record<string, string> = {
  brouillon: "bg-gray-100 text-gray-800",
  envoye: "bg-blue-100 text-blue-800",
  accepte: "bg-green-100 text-green-800",
  refuse: "bg-red-100 text-red-800",
  expire: "bg-orange-100 text-orange-800",
};
const statutLabels: Record<string, string> = {
  brouillon: "Brouillon", envoye: "Envoyé", accepte: "Accepté", refuse: "Refusé", expire: "Expiré",
};

export default function DevisDetailPage() {
  const params = useParams();
  const [devis, setDevis] = useState<Devis | null>(null);
  const [lignes, setLignes] = useState<LigneDevis[]>([]);
  const [client, setClient] = useState<Client | null>(null);
  const [entreprise, setEntreprise] = useState<Entreprise | null>(null);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);

  useEffect(() => {
    const load = async () => {
      const supabase = createClient();
      const [devisRes, entrepriseRes] = await Promise.all([
        supabase.from("devis").select("*").eq("id", params.id).single(),
        supabase.from("entreprise").select("*").single(),
      ]);
      if (devisRes.data) {
        setDevis(devisRes.data);
        const [clientRes, lignesRes] = await Promise.all([
          supabase.from("clients").select("*").eq("id", devisRes.data.client_id).single(),
          supabase.from("lignes_devis").select("*").eq("devis_id", devisRes.data.id),
        ]);
        setClient(clientRes.data);
        setLignes(lignesRes.data ?? []);
      }
      setEntreprise(entrepriseRes.data);
      setLoading(false);
    };
    load();
  }, [params.id]);

  const handleStatusChange = async (statut: StatutDevis) => {
    if (!devis) return;
    const supabase = createClient();
    await supabase.from("devis").update({ statut, updated_at: new Date().toISOString() }).eq("id", devis.id);
    toast.success("Statut mis à jour");
    setDevis({ ...devis, statut });
  };

  const handleDownloadPDF = async () => {
    if (!devis || !client || !entreprise) return;
    setGenerating(true);

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
        type="devis" numero={devis.numero} date={devis.date_devis}
        dateSecondaire={devis.date_validite} dateSecondaireLabel="Validité"
        entreprise={entreprise} client={client} lignes={lignes}
        sousTotal={devis.sous_total} tvaTotal={devis.tva_total} totalTTC={devis.total_ttc}
        remiseGlobale={devis.remise_globale} remisePourcent={remisePourcent}
        tvaPourcent={tvaPourcent} apposerSignature={apposerSig}
        conditions={devis.conditions_paiement ?? undefined}
        notes={parsedNotes || undefined}
      />
    ).toBlob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = `${devis.numero}.pdf`; a.click();
    URL.revokeObjectURL(url);
    setGenerating(false);
  };

  if (loading) return <div className="flex justify-center py-20"><Loader2 className="h-8 w-8 animate-spin text-muted-foreground" /></div>;
  if (!devis || !client) return <p className="text-center py-20 text-muted-foreground">Devis introuvable</p>;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div className="flex items-center gap-4">
          <Link href="/devis"><Button variant="ghost" size="icon"><ArrowLeft className="h-5 w-5" /></Button></Link>
          <div>
            <h1 className="text-2xl font-bold">{devis.numero}</h1>
            <p className="text-muted-foreground">{client.nom}</p>
          </div>
          <Badge className={statutColors[devis.statut]}>{statutLabels[devis.statut]}</Badge>
        </div>
        <div className="flex gap-2">
          <Select value={devis.statut} onValueChange={(v) => v && handleStatusChange(v as StatutDevis)}>
            <SelectTrigger className="w-[150px]"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="brouillon">Brouillon</SelectItem>
              <SelectItem value="envoye">Envoyé</SelectItem>
              <SelectItem value="accepte">Accepté</SelectItem>
              <SelectItem value="refuse">Refusé</SelectItem>
              <SelectItem value="expire">Expiré</SelectItem>
            </SelectContent>
          </Select>
          <Button onClick={handleDownloadPDF} disabled={generating} variant="outline">
            {generating ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Download className="mr-2 h-4 w-4" />}
            Télécharger PDF
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2">
          <Card className="border-0 shadow-sm">
            <CardHeader><CardTitle className="text-lg">Détail des lignes</CardTitle></CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Désignation</TableHead>
                    <TableHead className="text-center">Qté</TableHead>
                    <TableHead className="text-right">Prix unit.</TableHead>
                    <TableHead className="text-center">Remise</TableHead>
                    <TableHead className="text-center">TVA</TableHead>
                    <TableHead className="text-right">Total HT</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {lignes.map((l) => (
                    <TableRow key={l.id}>
                      <TableCell className="font-medium">{l.designation}</TableCell>
                      <TableCell className="text-center">{l.quantite}</TableCell>
                      <TableCell className="text-right">{formatMontant(l.prix_unitaire)}</TableCell>
                      <TableCell className="text-center">{l.remise}%</TableCell>
                      <TableCell className="text-center">{l.tva}%</TableCell>
                      <TableCell className="text-right font-medium">{formatMontant(l.total_ht)}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </div>

        <div className="space-y-4">
          <Card className="border-0 shadow-sm">
            <CardHeader><CardTitle className="text-lg">Récapitulatif</CardTitle></CardHeader>
            <CardContent className="space-y-3">
              <div className="flex justify-between text-sm"><span className="text-muted-foreground">Sous-total HT</span><span>{formatMontant(devis.sous_total)}</span></div>
              <div className="flex justify-between text-sm"><span className="text-muted-foreground">TVA</span><span>{formatMontant(devis.tva_total)}</span></div>
              <div className="border-t pt-3 flex justify-between font-bold text-lg"><span>Total TTC</span><span>{formatMontant(devis.total_ttc)}</span></div>
            </CardContent>
          </Card>
          <Card className="border-0 shadow-sm">
            <CardHeader><CardTitle className="text-lg">Client</CardTitle></CardHeader>
            <CardContent className="space-y-1 text-sm">
              <p className="font-medium">{client.nom}</p>
              {client.raison_sociale && <p>{client.raison_sociale}</p>}
              {client.adresse && <p>{client.adresse}</p>}
              {client.telephone && <p>{client.telephone}</p>}
              {client.email && <p>{client.email}</p>}
            </CardContent>
          </Card>
          <Card className="border-0 shadow-sm">
            <CardContent className="pt-6 space-y-2 text-sm">
              <div className="flex justify-between"><span className="text-muted-foreground">Date</span><span>{formatDate(devis.date_devis)}</span></div>
              <div className="flex justify-between"><span className="text-muted-foreground">Validité</span><span>{formatDate(devis.date_validite)}</span></div>
              {devis.conditions_paiement && <div className="flex justify-between"><span className="text-muted-foreground">Conditions</span><span>{devis.conditions_paiement}</span></div>}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
