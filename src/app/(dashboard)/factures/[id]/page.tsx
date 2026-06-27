"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { toast } from "sonner";
import { ArrowLeft, Download, Loader2, Plus, CreditCard } from "lucide-react";
import { formatMontant, formatDate } from "@/lib/formatters";
import { pdf } from "@react-pdf/renderer";
import { DocumentPDF } from "@/components/pdf/document-pdf";
import type {
  Facture, LigneFacture, Client, Entreprise, Paiement,
  StatutFacture, ModePaiement,
} from "@/types/database";
import Link from "next/link";

const statutColors: Record<string, string> = {
  brouillon: "bg-gray-100 text-gray-800",
  envoyee: "bg-blue-100 text-blue-800",
  payee_partiellement: "bg-orange-100 text-orange-800",
  payee: "bg-green-100 text-green-800",
  annulee: "bg-red-100 text-red-800",
};
const statutLabels: Record<string, string> = {
  brouillon: "Brouillon", envoyee: "Envoyée", payee_partiellement: "Partielle",
  payee: "Payée", annulee: "Annulée",
};
const modesLabels: Record<string, string> = {
  especes: "Espèces", virement: "Virement", cheque: "Chèque",
  mobile_money: "Mobile Money", carte: "Carte", autre: "Autre",
};

export default function FactureDetailPage() {
  const params = useParams();
  const [facture, setFacture] = useState<Facture | null>(null);
  const [lignes, setLignes] = useState<LigneFacture[]>([]);
  const [paiements, setPaiements] = useState<Paiement[]>([]);
  const [client, setClient] = useState<Client | null>(null);
  const [entreprise, setEntreprise] = useState<Entreprise | null>(null);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [paiementOpen, setPaiementOpen] = useState(false);
  const [montantP, setMontantP] = useState(0);
  const [modeP, setModeP] = useState<ModePaiement>("especes");
  const [savingP, setSavingP] = useState(false);

  const loadData = async () => {
    const supabase = createClient();
    const [factureRes, entrepriseRes] = await Promise.all([
      supabase.from("factures").select("*").eq("id", params.id).single(),
      supabase.from("entreprise").select("*").single(),
    ]);
    if (factureRes.data) {
      setFacture(factureRes.data);
      const [clientRes, lignesRes, paiementsRes] = await Promise.all([
        supabase.from("clients").select("*").eq("id", factureRes.data.client_id).single(),
        supabase.from("lignes_factures").select("*").eq("facture_id", factureRes.data.id),
        supabase.from("paiements").select("*").eq("facture_id", factureRes.data.id).order("date_paiement"),
      ]);
      setClient(clientRes.data);
      setLignes(lignesRes.data ?? []);
      setPaiements(paiementsRes.data ?? []);
    }
    setEntreprise(entrepriseRes.data);
    setLoading(false);
  };

  useEffect(() => { loadData(); }, [params.id]);

  const handleStatusChange = async (statut: StatutFacture) => {
    if (!facture) return;
    const supabase = createClient();
    await supabase.from("factures").update({ statut }).eq("id", facture.id);
    toast.success("Statut mis à jour");
    setFacture({ ...facture, statut });
  };

  const handleAddPaiement = async () => {
    if (!facture || montantP <= 0) return;
    setSavingP(true);
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    const { error } = await supabase.from("paiements").insert([{
      facture_id: facture.id,
      montant: montantP,
      mode_paiement: modeP,
      created_by: user.id,
    }]);
    if (error) toast.error("Erreur");
    else {
      toast.success("Paiement enregistré");
      setPaiementOpen(false);
      setMontantP(0);
      loadData();
    }
    setSavingP(false);
  };

  const handleDownloadPDF = async () => {
    if (!facture || !client || !entreprise) return;
    setGenerating(true);

    let parsedNotes = "";
    let tvaPourcent = 18;
    let remisePourcent = 0;
    let apposerSig = true;
    try {
      const parsed = JSON.parse(facture.notes ?? "{}");
      parsedNotes = parsed.notes ?? facture.notes ?? "";
      tvaPourcent = parsed.tva_pourcent ?? 18;
      remisePourcent = parsed.remise_pourcent ?? 0;
      apposerSig = parsed.apposer_signature ?? true;
    } catch {
      parsedNotes = facture.notes ?? "";
    }

    const blob = await pdf(
      <DocumentPDF
        type="facture" numero={facture.numero} date={facture.date_facture}
        dateSecondaire={facture.date_echeance} dateSecondaireLabel="Échéance"
        entreprise={entreprise} client={client} lignes={lignes}
        sousTotal={facture.sous_total} tvaTotal={facture.tva_total} totalTTC={facture.total_ttc}
        remiseGlobale={facture.remise_globale} remisePourcent={remisePourcent}
        tvaPourcent={tvaPourcent} apposerSignature={apposerSig}
        montantPaye={facture.montant_paye} resteAPayer={facture.reste_a_payer}
        conditions={facture.conditions_paiement ?? undefined}
        notes={parsedNotes || undefined}
      />
    ).toBlob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a"); a.href = url; a.download = `${facture.numero}.pdf`; a.click();
    URL.revokeObjectURL(url);
    setGenerating(false);
  };

  if (loading) return <div className="flex justify-center py-20"><Loader2 className="h-8 w-8 animate-spin text-muted-foreground" /></div>;
  if (!facture || !client) return <p className="text-center py-20 text-muted-foreground">Facture introuvable</p>;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div className="flex items-center gap-4">
          <Link href="/factures"><Button variant="ghost" size="icon"><ArrowLeft className="h-5 w-5" /></Button></Link>
          <div>
            <h1 className="text-2xl font-bold">{facture.numero}</h1>
            <p className="text-muted-foreground">{client.nom}</p>
          </div>
          <Badge className={statutColors[facture.statut]}>{statutLabels[facture.statut]}</Badge>
        </div>
        <div className="flex gap-2">
          <Select value={facture.statut} onValueChange={(v) => v && handleStatusChange(v as StatutFacture)}>
            <SelectTrigger className="w-[150px]"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="brouillon">Brouillon</SelectItem>
              <SelectItem value="envoyee">Envoyée</SelectItem>
              <SelectItem value="payee_partiellement">Partielle</SelectItem>
              <SelectItem value="payee">Payée</SelectItem>
              <SelectItem value="annulee">Annulée</SelectItem>
            </SelectContent>
          </Select>
          <Button onClick={handleDownloadPDF} disabled={generating} variant="outline">
            {generating ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Download className="mr-2 h-4 w-4" />}
            PDF
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-6">
          <Card className="border-0 shadow-sm">
            <CardHeader><CardTitle className="text-lg">Lignes</CardTitle></CardHeader>
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

          <Card className="border-0 shadow-sm">
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle className="text-lg flex items-center gap-2">
                <CreditCard className="h-5 w-5" /> Paiements
              </CardTitle>
              <Dialog open={paiementOpen} onOpenChange={setPaiementOpen}>
                <DialogTrigger render={<Button size="sm" className="bg-green-600 hover:bg-green-700" />}>
                  <Plus className="mr-2 h-4 w-4" /> Ajouter un paiement
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader><DialogTitle>Enregistrer un paiement</DialogTitle></DialogHeader>
                  <div className="space-y-4 py-4">
                    <div className="space-y-2">
                      <Label>Montant (FCFA)</Label>
                      <Input type="number" value={montantP} onChange={(e) => setMontantP(Number(e.target.value))} />
                      <p className="text-xs text-muted-foreground">Reste à payer: {formatMontant(facture.reste_a_payer)}</p>
                    </div>
                    <div className="space-y-2">
                      <Label>Mode de paiement</Label>
                      <Select value={modeP} onValueChange={(v) => v && setModeP(v as ModePaiement)}>
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent>
                          {Object.entries(modesLabels).map(([k, v]) => (
                            <SelectItem key={k} value={k}>{v}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                  <div className="flex justify-end gap-2">
                    <Button variant="outline" onClick={() => setPaiementOpen(false)}>Annuler</Button>
                    <Button onClick={handleAddPaiement} disabled={savingP} className="bg-green-600 hover:bg-green-700">
                      {savingP && <Loader2 className="mr-2 h-4 w-4 animate-spin" />} Enregistrer
                    </Button>
                  </div>
                </DialogContent>
              </Dialog>
            </CardHeader>
            <CardContent>
              {paiements.length === 0 ? (
                <p className="text-center py-6 text-muted-foreground">Aucun paiement enregistré</p>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Date</TableHead>
                      <TableHead>Mode</TableHead>
                      <TableHead className="text-right">Montant</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {paiements.map((p) => (
                      <TableRow key={p.id}>
                        <TableCell>{formatDate(p.date_paiement)}</TableCell>
                        <TableCell>{modesLabels[p.mode_paiement]}</TableCell>
                        <TableCell className="text-right font-medium text-green-600">+{formatMontant(p.montant)}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </div>

        <div className="space-y-4">
          <Card className="border-0 shadow-sm">
            <CardHeader><CardTitle className="text-lg">Récapitulatif</CardTitle></CardHeader>
            <CardContent className="space-y-3">
              <div className="flex justify-between text-sm"><span className="text-muted-foreground">Sous-total HT</span><span>{formatMontant(facture.sous_total)}</span></div>
              <div className="flex justify-between text-sm"><span className="text-muted-foreground">TVA</span><span>{formatMontant(facture.tva_total)}</span></div>
              <div className="border-t pt-3 flex justify-between font-bold text-lg"><span>Total TTC</span><span>{formatMontant(facture.total_ttc)}</span></div>
              <div className="border-t pt-3 space-y-2">
                <div className="flex justify-between text-sm"><span className="text-muted-foreground">Payé</span><span className="text-green-600 font-medium">{formatMontant(facture.montant_paye)}</span></div>
                <div className="flex justify-between text-sm"><span className="text-muted-foreground">Reste</span><span className="text-red-600 font-bold">{formatMontant(facture.reste_a_payer)}</span></div>
              </div>
            </CardContent>
          </Card>
          <Card className="border-0 shadow-sm">
            <CardHeader><CardTitle className="text-lg">Client</CardTitle></CardHeader>
            <CardContent className="space-y-1 text-sm">
              <p className="font-medium">{client.nom}</p>
              {client.adresse && <p>{client.adresse}</p>}
              {client.telephone && <p>{client.telephone}</p>}
              {client.email && <p>{client.email}</p>}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
