"use client";

import { useEffect, useState, useRef } from "react";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import {
  Plus,
  Search,
  Pencil,
  Trash2,
  Loader2,
  Package,
  AlertTriangle,
  Upload,
  ImageIcon,
  X,
} from "lucide-react";
import type { Produit, Categorie } from "@/types/database";
import { formatMontant } from "@/lib/formatters";

const emptyProduit: Partial<Produit> = {
  designation: "",
  categorie_id: undefined,
  description: "",
  photo_url: "",
  prix_achat: 0,
  prix_vente: 0,
  tva: 18,
  stock: 0,
  stock_alerte: 5,
  actif: true,
};

export default function ProduitsPage() {
  const [produits, setProduits] = useState<(Produit & { categorie: Categorie | null })[]>([]);
  const [categories, setCategories] = useState<Categorie[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editProduit, setEditProduit] = useState<Partial<Produit>>(emptyProduit);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [selectedCatId, setSelectedCatId] = useState("");
  const fileRef = useRef<HTMLInputElement>(null);

  const loadData = async () => {
    const supabase = createClient();
    const [produitsRes, categoriesRes] = await Promise.all([
      supabase
        .from("produits")
        .select("*, categorie:categories(*)")
        .order("created_at", { ascending: false }),
      supabase.from("categories").select("*").order("nom"),
    ]);
    setProduits(produitsRes.data ?? []);
    setCategories(categoriesRes.data ?? []);
    setLoading(false);
  };

  useEffect(() => {
    loadData();
  }, []);

  const generateReference = async (): Promise<string> => {
    const supabase = createClient();
    const { count } = await supabase
      .from("produits")
      .select("id", { count: "exact", head: true });
    const num = String((count ?? 0) + 1).padStart(4, "0");
    return `MEU-${num}`;
  };

  const handleUploadImage = async (file: File) => {
    setUploading(true);
    const supabase = createClient();
    const ext = file.name.split(".").pop();
    const path = `produits/photo_${Date.now()}.${ext}`;

    const { error } = await supabase.storage
      .from("documents")
      .upload(path, file);

    if (error) {
      toast.error("Erreur lors du téléchargement de l'image");
      setUploading(false);
      return;
    }

    const { data: { publicUrl } } = supabase.storage
      .from("documents")
      .getPublicUrl(path);

    setEditProduit((prev) => ({ ...prev, photo_url: publicUrl }));
    setUploading(false);
  };

  const handleSave = async () => {
    if (!editProduit.designation?.trim()) {
      toast.error("La désignation est obligatoire");
      return;
    }
    setSaving(true);
    const supabase = createClient();

    const categorie_id = selectedCatId || null;

    if (editProduit.id) {
      const { id, created_at, updated_at, categorie, reference, ...rest } = editProduit as Produit & { categorie?: Categorie };
      const { error } = await supabase
        .from("produits")
        .update({ ...rest, categorie_id, updated_at: new Date().toISOString() })
        .eq("id", id);
      if (error) toast.error("Erreur lors de la modification");
      else toast.success("Produit modifié");
    } else {
      const ref = await generateReference();
      const { id, created_at, updated_at, categorie, reference, ...rest } = editProduit as Produit & { categorie?: Categorie };
      const { error } = await supabase.from("produits").insert([{
        ...rest,
        reference: ref,
        categorie_id,
      }]);
      if (error) toast.error("Erreur: " + error.message);
      else toast.success("Produit créé");
    }

    setSaving(false);
    setDialogOpen(false);
    setEditProduit(emptyProduit);
    setSelectedCatId("");
    loadData();
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Supprimer ce produit ?")) return;
    const supabase = createClient();
    const { error } = await supabase.from("produits").delete().eq("id", id);
    if (error) toast.error("Impossible de supprimer (produit utilisé dans un devis/facture)");
    else {
      toast.success("Produit supprimé");
      loadData();
    }
  };

  const openEdit = (produit: Produit & { categorie: Categorie | null }) => {
    setEditProduit(produit);
    setSelectedCatId(produit.categorie_id ?? "");
    setDialogOpen(true);
  };

  const openNew = () => {
    setEditProduit(emptyProduit);
    setSelectedCatId("");
    setDialogOpen(true);
  };

  const filtered = produits.filter(
    (p) =>
      p.designation.toLowerCase().includes(search.toLowerCase()) ||
      p.reference.toLowerCase().includes(search.toLowerCase()) ||
      p.categorie?.nom?.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Produits</h1>
          <p className="text-muted-foreground">Catalogue de meubles</p>
        </div>
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogTrigger
            render={<Button className="bg-[#DD0000] hover:bg-[#BB0000]" />}
            onClick={openNew}
          >
            <Plus className="mr-2 h-4 w-4" />
            Nouveau produit
          </DialogTrigger>
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle>
                {editProduit.id ? "Modifier le produit" : "Nouveau produit"}
              </DialogTitle>
            </DialogHeader>
            <div className="space-y-4 py-4">
              {/* Image upload */}
              <div className="space-y-2">
                <Label>Image du produit</Label>
                <div className="flex items-center gap-4">
                  {editProduit.photo_url ? (
                    <div className="relative w-32 h-32 rounded-lg overflow-hidden border bg-gray-50">
                      <img
                        src={editProduit.photo_url}
                        alt="Aperçu"
                        className="w-full h-full object-cover"
                      />
                      <button
                        type="button"
                        onClick={() => setEditProduit({ ...editProduit, photo_url: "" })}
                        className="absolute top-1 right-1 bg-red-500 text-white rounded-full p-1 hover:bg-red-600"
                      >
                        <X className="h-3 w-3" />
                      </button>
                    </div>
                  ) : (
                    <div className="w-32 h-32 rounded-lg border-2 border-dashed border-gray-300 flex flex-col items-center justify-center text-muted-foreground bg-gray-50">
                      <ImageIcon className="h-8 w-8 mb-1" />
                      <span className="text-xs">Aucune image</span>
                    </div>
                  )}
                  <div>
                    <input
                      ref={fileRef}
                      type="file"
                      accept="image/*"
                      className="hidden"
                      onChange={(e) => {
                        const file = e.target.files?.[0];
                        if (file) handleUploadImage(file);
                      }}
                    />
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => fileRef.current?.click()}
                      disabled={uploading}
                    >
                      {uploading ? (
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      ) : (
                        <Upload className="mr-2 h-4 w-4" />
                      )}
                      {editProduit.photo_url ? "Changer" : "Ajouter une image"}
                    </Button>
                    <p className="text-xs text-muted-foreground mt-1">
                      JPG, PNG ou WebP
                    </p>
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {editProduit.id && (
                  <div className="space-y-2">
                    <Label>Référence</Label>
                    <Input
                      value={editProduit.reference ?? ""}
                      disabled
                      className="bg-gray-50 font-mono"
                    />
                  </div>
                )}
                <div className={`space-y-2 ${editProduit.id ? "" : "md:col-span-2"}`}>
                  <Label>Désignation *</Label>
                  <Input
                    value={editProduit.designation ?? ""}
                    onChange={(e) =>
                      setEditProduit({ ...editProduit, designation: e.target.value })
                    }
                    placeholder="Ex: Canapé 3 places en cuir"
                  />
                </div>
                <div className="space-y-2">
                  <Label>Catégorie</Label>
                  <select
                    value={selectedCatId}
                    onChange={(e) => setSelectedCatId(e.target.value)}
                    className="flex h-8 w-full items-center rounded-lg border border-input bg-transparent px-2.5 py-2 text-sm outline-none focus:border-ring focus:ring-3 focus:ring-ring/50"
                  >
                    <option value="">-- Choisir une catégorie --</option>
                    {categories.map((cat) => (
                      <option key={cat.id} value={cat.id}>
                        {cat.nom}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="space-y-2">
                  <Label>Prix d&apos;achat (FCFA)</Label>
                  <Input
                    type="number"
                    value={editProduit.prix_achat ?? 0}
                    onChange={(e) =>
                      setEditProduit({ ...editProduit, prix_achat: Number(e.target.value) })
                    }
                  />
                </div>
                <div className="space-y-2">
                  <Label>Prix de vente (FCFA)</Label>
                  <Input
                    type="number"
                    value={editProduit.prix_vente ?? 0}
                    onChange={(e) =>
                      setEditProduit({ ...editProduit, prix_vente: Number(e.target.value) })
                    }
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Stock</Label>
                  <Input
                    type="number"
                    value={editProduit.stock ?? 0}
                    onChange={(e) =>
                      setEditProduit({ ...editProduit, stock: Number(e.target.value) })
                    }
                  />
                </div>
                <div className="space-y-2">
                  <Label>Seuil d&apos;alerte stock</Label>
                  <Input
                    type="number"
                    value={editProduit.stock_alerte ?? 5}
                    onChange={(e) =>
                      setEditProduit({ ...editProduit, stock_alerte: Number(e.target.value) })
                    }
                  />
                </div>
              </div>
              <div className="space-y-2">
                <Label>Description</Label>
                <Textarea
                  value={editProduit.description ?? ""}
                  onChange={(e) =>
                    setEditProduit({ ...editProduit, description: e.target.value })
                  }
                  rows={2}
                  placeholder="Description du produit..."
                />
              </div>
            </div>
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setDialogOpen(false)}>
                Annuler
              </Button>
              <Button
                onClick={handleSave}
                disabled={saving}
                className="bg-[#DD0000] hover:bg-[#BB0000]"
              >
                {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                {editProduit.id ? "Modifier" : "Créer"}
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {/* Barre de recherche */}
      <div className="flex items-center gap-4">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Rechercher un produit..."
            className="pl-10"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <div className="text-sm text-muted-foreground">
          {filtered.length} produit{filtered.length > 1 ? "s" : ""}
        </div>
      </div>

      {/* Grille de produits en cards */}
      {loading ? (
        <div className="flex justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-16">
          <Package className="h-16 w-16 text-muted-foreground mx-auto mb-4" />
          <p className="text-lg text-muted-foreground">Aucun produit trouvé</p>
          <p className="text-sm text-muted-foreground mt-1">
            Cliquez sur &quot;Nouveau produit&quot; pour ajouter votre premier meuble
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filtered.map((produit) => (
            <Card
              key={produit.id}
              className="border-0 shadow-sm overflow-hidden hover:shadow-md transition-shadow group"
            >
              {/* Miniature */}
              <div className="relative h-48 bg-gray-100">
                {produit.photo_url ? (
                  <img
                    src={produit.photo_url}
                    alt={produit.designation}
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <div className="w-full h-full flex flex-col items-center justify-center text-muted-foreground">
                    <Package className="h-12 w-12 mb-2 opacity-30" />
                    <span className="text-xs opacity-50">Pas d&apos;image</span>
                  </div>
                )}
                {/* Badge catégorie */}
                {produit.categorie && (
                  <Badge className="absolute top-2 left-2 bg-black/70 text-white text-xs hover:bg-black/70">
                    {produit.categorie.nom}
                  </Badge>
                )}
                {/* Badge stock faible */}
                {produit.stock <= produit.stock_alerte && (
                  <Badge className="absolute top-2 right-2 bg-orange-500 text-white text-xs hover:bg-orange-500">
                    <AlertTriangle className="h-3 w-3 mr-1" />
                    Stock faible
                  </Badge>
                )}
                {/* Actions hover */}
                <div className="absolute inset-0 bg-black/0 group-hover:bg-black/40 transition-colors flex items-center justify-center gap-2 opacity-0 group-hover:opacity-100">
                  <Button
                    size="sm"
                    variant="secondary"
                    onClick={() => openEdit(produit)}
                  >
                    <Pencil className="h-4 w-4 mr-1" />
                    Modifier
                  </Button>
                  <Button
                    size="sm"
                    variant="destructive"
                    onClick={() => handleDelete(produit.id)}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </div>

              <CardContent className="p-4">
                <div className="flex items-start justify-between mb-1">
                  <h3 className="font-semibold text-sm leading-tight line-clamp-2 flex-1">
                    {produit.designation}
                  </h3>
                </div>
                <p className="text-xs text-muted-foreground font-mono mb-3">
                  {produit.reference}
                </p>
                <div className="flex items-center justify-between">
                  <span className="text-lg font-bold text-[#DD0000]">
                    {formatMontant(produit.prix_vente)}
                  </span>
                  <div className="flex items-center gap-1">
                    <Badge
                      variant={
                        produit.stock <= produit.stock_alerte
                          ? "destructive"
                          : "secondary"
                      }
                      className="text-xs"
                    >
                      Stock: {produit.stock}
                    </Badge>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
