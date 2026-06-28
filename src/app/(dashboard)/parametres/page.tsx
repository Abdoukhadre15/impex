"use client";

import { useEffect, useState, useRef } from "react";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Separator } from "@/components/ui/separator";
import { toast } from "sonner";
import {
  Building2,
  Upload,
  Save,
  Loader2,
  FileSignature,
  Stamp,
  Image as ImageIcon,
  Trash2,
} from "lucide-react";
import type { Entreprise } from "@/types/database";

export default function ParametresPage() {
  const [entreprise, setEntreprise] = useState<Partial<Entreprise>>({
    nom: "Impex Germany Senegal",
    adresse: "Nguékhokh, Route de Nguaparou, Sénégal",
    telephone: "",
    email: "",
    devise: "FCFA",
    tva_defaut: 18,
    prefixe_devis: "DEV",
    prefixe_facture: "FAC",
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState<string | null>(null);

  const logoRef = useRef<HTMLInputElement>(null);
  const cachetRef = useRef<HTMLInputElement>(null);
  const signatureRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const load = async () => {
      const supabase = createClient();
      const { data } = await supabase
        .from("entreprise")
        .select("*")
        .single();
      if (data) setEntreprise(data);
      setLoading(false);
    };
    load();
  }, []);

  const handleSave = async () => {
    setSaving(true);
    const supabase = createClient();

    const { id, created_at, updated_at, ...rest } = entreprise as Entreprise & { id?: string; created_at?: string; updated_at?: string };

    const payload: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(rest)) {
      if (value !== undefined) payload[key] = value;
    }

    if (id) {
      const { error } = await supabase
        .from("entreprise")
        .update({ ...payload, updated_at: new Date().toISOString() })
        .eq("id", id);
      if (error) {
        console.error("Erreur sauvegarde:", error);
        toast.error(`Erreur: ${error.message}`);
      } else {
        toast.success("Paramètres sauvegardés");
      }
    } else {
      const { error } = await supabase
        .from("entreprise")
        .insert([payload]);
      if (error) {
        console.error("Erreur création:", error);
        toast.error(`Erreur: ${error.message}`);
      } else {
        toast.success("Paramètres créés");
      }
    }
    setSaving(false);
  };

  const handleUpload = async (
    file: File,
    field: "logo_url" | "cachet_url" | "signature_url"
  ) => {
    setUploading(field);
    const supabase = createClient();
    const ext = file.name.split(".").pop();
    const path = `entreprise/${field}_${Date.now()}.${ext}`;

    const { error: uploadError } = await supabase.storage
      .from("documents")
      .upload(path, file);

    if (uploadError) {
      toast.error("Erreur lors du téléchargement");
      setUploading(null);
      return;
    }

    const { data: { publicUrl } } = supabase.storage
      .from("documents")
      .getPublicUrl(path);

    setEntreprise((prev) => ({ ...prev, [field]: publicUrl }));
    setUploading(null);
    toast.success("Image téléchargée");
  };

  const handleRemoveImage = (field: "logo_url" | "cachet_url" | "signature_url") => {
    setEntreprise((prev) => ({ ...prev, [field]: "" }));
  };

  const updateField = (field: string, value: string | number) => {
    setEntreprise((prev) => ({ ...prev, [field]: value }));
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Paramètres</h1>
          <p className="text-muted-foreground">
            Configuration de l&apos;entreprise et des documents
          </p>
        </div>
        <Button
          onClick={handleSave}
          disabled={saving}
          className="bg-[#DD0000] hover:bg-[#BB0000]"
        >
          {saving ? (
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
          ) : (
            <Save className="mr-2 h-4 w-4" />
          )}
          Enregistrer
        </Button>
      </div>

      <Tabs defaultValue="entreprise">
        <TabsList className="bg-white border">
          <TabsTrigger value="entreprise">Entreprise</TabsTrigger>
          <TabsTrigger value="documents">Documents</TabsTrigger>
          <TabsTrigger value="cachet">Cachet & Signature</TabsTrigger>
        </TabsList>

        <TabsContent value="entreprise" className="space-y-4 mt-4">
          <Card className="border-0 shadow-sm">
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                <Building2 className="h-5 w-5" />
                Informations de l&apos;entreprise
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Nom de l&apos;entreprise</Label>
                  <Input
                    value={entreprise.nom ?? ""}
                    onChange={(e) => updateField("nom", e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Raison sociale</Label>
                  <Input
                    value={entreprise.raison_sociale ?? ""}
                    onChange={(e) => updateField("raison_sociale", e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label>NINEA</Label>
                  <Input
                    value={entreprise.ninea ?? ""}
                    onChange={(e) => updateField("ninea", e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Registre de Commerce (RC)</Label>
                  <Input
                    value={entreprise.rc ?? ""}
                    onChange={(e) => updateField("rc", e.target.value)}
                  />
                </div>
                <div className="space-y-2 md:col-span-2">
                  <Label>Adresse</Label>
                  <Input
                    value={entreprise.adresse ?? ""}
                    onChange={(e) => updateField("adresse", e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Téléphone mobile</Label>
                  <Input
                    value={entreprise.telephone ?? ""}
                    onChange={(e) => updateField("telephone", e.target.value)}
                    placeholder="+221 7X XXX XX XX"
                  />
                </div>
                <div className="space-y-2">
                  <Label>Téléphone fixe</Label>
                  <Input
                    value={entreprise.telephone_fixe ?? ""}
                    onChange={(e) => updateField("telephone_fixe", e.target.value)}
                    placeholder="+221 33 XXX XX XX"
                  />
                </div>
                <div className="space-y-2">
                  <Label>Email</Label>
                  <Input
                    type="email"
                    value={entreprise.email ?? ""}
                    onChange={(e) => updateField("email", e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Site web</Label>
                  <Input
                    value={entreprise.site_web ?? ""}
                    onChange={(e) => updateField("site_web", e.target.value)}
                  />
                </div>
              </div>

              <Separator className="my-6" />

              <div className="space-y-2">
                <Label className="flex items-center gap-2">
                  <ImageIcon className="h-4 w-4" />
                  Logo de l&apos;entreprise
                </Label>
                <div className="flex items-center gap-4">
                  {entreprise.logo_url && (
                    <div className="relative">
                      <img
                        src={entreprise.logo_url}
                        alt="Logo"
                        className="h-20 w-auto object-contain border rounded-lg p-2"
                      />
                      <button
                        onClick={() => handleRemoveImage("logo_url")}
                        className="absolute -top-2 -right-2 bg-red-500 text-white rounded-full p-1"
                      >
                        <Trash2 className="h-3 w-3" />
                      </button>
                    </div>
                  )}
                  <input
                    ref={logoRef}
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      if (file) handleUpload(file, "logo_url");
                    }}
                  />
                  <Button
                    variant="outline"
                    onClick={() => logoRef.current?.click()}
                    disabled={uploading === "logo_url"}
                  >
                    {uploading === "logo_url" ? (
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    ) : (
                      <Upload className="mr-2 h-4 w-4" />
                    )}
                    Télécharger le logo
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="documents" className="space-y-4 mt-4">
          <Card className="border-0 shadow-sm">
            <CardHeader>
              <CardTitle className="text-lg">Numérotation</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="space-y-2">
                  <Label>Préfixe devis</Label>
                  <Input
                    value={entreprise.prefixe_devis ?? "DEV"}
                    onChange={(e) => updateField("prefixe_devis", e.target.value)}
                  />
                  <p className="text-xs text-muted-foreground">Ex: DEV-2026-0001</p>
                </div>
                <div className="space-y-2">
                  <Label>Préfixe facture</Label>
                  <Input
                    value={entreprise.prefixe_facture ?? "FAC"}
                    onChange={(e) => updateField("prefixe_facture", e.target.value)}
                  />
                  <p className="text-xs text-muted-foreground">Ex: FAC-2026-0001</p>
                </div>
                <div className="space-y-2">
                  <Label>TVA par défaut (%)</Label>
                  <Input
                    type="number"
                    value={entreprise.tva_defaut ?? 18}
                    onChange={(e) => updateField("tva_defaut", Number(e.target.value))}
                  />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="border-0 shadow-sm">
            <CardHeader>
              <CardTitle className="text-lg">Mentions sur les documents</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label>Conditions générales de vente</Label>
                <Textarea
                  rows={4}
                  value={entreprise.conditions_generales ?? ""}
                  onChange={(e) => updateField("conditions_generales", e.target.value)}
                  placeholder="Saisissez vos conditions générales de vente..."
                />
              </div>
              <div className="space-y-2">
                <Label>Mentions légales</Label>
                <Textarea
                  rows={3}
                  value={entreprise.mentions_legales ?? ""}
                  onChange={(e) => updateField("mentions_legales", e.target.value)}
                  placeholder="Mentions légales obligatoires..."
                />
              </div>
              <div className="space-y-2">
                <Label>Coordonnées bancaires</Label>
                <Textarea
                  rows={3}
                  value={entreprise.coordonnees_bancaires ?? ""}
                  onChange={(e) => updateField("coordonnees_bancaires", e.target.value)}
                  placeholder="Banque, IBAN, SWIFT..."
                />
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="cachet" className="space-y-4 mt-4">
          <Card className="border-0 shadow-sm">
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                <Stamp className="h-5 w-5" />
                Cachet de l&apos;entreprise
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground mb-4">
                Téléchargez une image PNG avec fond transparent pour le cachet qui sera
                apposé automatiquement sur les devis et factures.
              </p>
              <div className="flex items-center gap-4">
                {entreprise.cachet_url && (
                  <div className="relative">
                    <img
                      src={entreprise.cachet_url}
                      alt="Cachet"
                      className="h-32 w-auto object-contain border rounded-lg p-2 bg-gray-50"
                    />
                    <button
                      onClick={() => handleRemoveImage("cachet_url")}
                      className="absolute -top-2 -right-2 bg-red-500 text-white rounded-full p-1"
                    >
                      <Trash2 className="h-3 w-3" />
                    </button>
                  </div>
                )}
                <input
                  ref={cachetRef}
                  type="file"
                  accept="image/png"
                  className="hidden"
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) handleUpload(file, "cachet_url");
                  }}
                />
                <Button
                  variant="outline"
                  onClick={() => cachetRef.current?.click()}
                  disabled={uploading === "cachet_url"}
                >
                  {uploading === "cachet_url" ? (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  ) : (
                    <Upload className="mr-2 h-4 w-4" />
                  )}
                  Télécharger le cachet
                </Button>
              </div>
            </CardContent>
          </Card>

          <Card className="border-0 shadow-sm">
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                <FileSignature className="h-5 w-5" />
                Signature
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground mb-4">
                Téléchargez une image PNG avec fond transparent pour la signature.
              </p>
              <div className="flex items-center gap-4">
                {entreprise.signature_url && (
                  <div className="relative">
                    <img
                      src={entreprise.signature_url}
                      alt="Signature"
                      className="h-24 w-auto object-contain border rounded-lg p-2 bg-gray-50"
                    />
                    <button
                      onClick={() => handleRemoveImage("signature_url")}
                      className="absolute -top-2 -right-2 bg-red-500 text-white rounded-full p-1"
                    >
                      <Trash2 className="h-3 w-3" />
                    </button>
                  </div>
                )}
                <input
                  ref={signatureRef}
                  type="file"
                  accept="image/png"
                  className="hidden"
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) handleUpload(file, "signature_url");
                  }}
                />
                <Button
                  variant="outline"
                  onClick={() => signatureRef.current?.click()}
                  disabled={uploading === "signature_url"}
                >
                  {uploading === "signature_url" ? (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  ) : (
                    <Upload className="mr-2 h-4 w-4" />
                  )}
                  Télécharger la signature
                </Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
