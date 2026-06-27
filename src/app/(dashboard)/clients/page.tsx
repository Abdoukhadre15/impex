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
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { Plus, Search, Pencil, Trash2, Loader2, Users } from "lucide-react";
import type { Client } from "@/types/database";
import { formatDate } from "@/lib/formatters";

const emptyClient: Partial<Client> = {
  nom: "",
  raison_sociale: "",
  ninea: "",
  rc: "",
  adresse: "",
  telephone: "",
  email: "",
  notes: "",
};

export default function ClientsPage() {
  const [clients, setClients] = useState<Client[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editClient, setEditClient] = useState<Partial<Client>>(emptyClient);
  const [saving, setSaving] = useState(false);

  const loadClients = async () => {
    const supabase = createClient();
    const { data } = await supabase
      .from("clients")
      .select("*")
      .order("created_at", { ascending: false });
    setClients(data ?? []);
    setLoading(false);
  };

  useEffect(() => {
    loadClients();
  }, []);

  const handleSave = async () => {
    if (!editClient.nom?.trim()) {
      toast.error("Le nom du client est obligatoire");
      return;
    }
    setSaving(true);
    const supabase = createClient();

    if (editClient.id) {
      const { id, created_at, updated_at, ...rest } = editClient as Client;
      const { error } = await supabase
        .from("clients")
        .update({ ...rest, updated_at: new Date().toISOString() })
        .eq("id", id);
      if (error) toast.error("Erreur lors de la modification");
      else toast.success("Client modifié");
    } else {
      const { id, created_at, updated_at, ...rest } = editClient as Client;
      const { error } = await supabase.from("clients").insert([rest]);
      if (error) toast.error("Erreur lors de la création");
      else toast.success("Client créé");
    }

    setSaving(false);
    setDialogOpen(false);
    setEditClient(emptyClient);
    loadClients();
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Supprimer ce client ?")) return;
    const supabase = createClient();
    const { error } = await supabase.from("clients").delete().eq("id", id);
    if (error) toast.error("Impossible de supprimer ce client (devis/factures liés)");
    else {
      toast.success("Client supprimé");
      loadClients();
    }
  };

  const filtered = clients.filter(
    (c) =>
      c.nom.toLowerCase().includes(search.toLowerCase()) ||
      c.telephone?.includes(search) ||
      c.email?.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Clients</h1>
          <p className="text-muted-foreground">
            Gestion de votre base clients
          </p>
        </div>
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogTrigger
            render={<Button className="bg-[#DD0000] hover:bg-[#BB0000]" />}
            onClick={() => setEditClient(emptyClient)}
          >
            <Plus className="mr-2 h-4 w-4" />
            Nouveau client
          </DialogTrigger>
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle>
                {editClient.id ? "Modifier le client" : "Nouveau client"}
              </DialogTitle>
            </DialogHeader>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 py-4">
              <div className="space-y-2">
                <Label>Nom *</Label>
                <Input
                  value={editClient.nom ?? ""}
                  onChange={(e) =>
                    setEditClient({ ...editClient, nom: e.target.value })
                  }
                />
              </div>
              <div className="space-y-2">
                <Label>Raison sociale</Label>
                <Input
                  value={editClient.raison_sociale ?? ""}
                  onChange={(e) =>
                    setEditClient({ ...editClient, raison_sociale: e.target.value })
                  }
                />
              </div>
              <div className="space-y-2">
                <Label>NINEA</Label>
                <Input
                  value={editClient.ninea ?? ""}
                  onChange={(e) =>
                    setEditClient({ ...editClient, ninea: e.target.value })
                  }
                />
              </div>
              <div className="space-y-2">
                <Label>RC</Label>
                <Input
                  value={editClient.rc ?? ""}
                  onChange={(e) =>
                    setEditClient({ ...editClient, rc: e.target.value })
                  }
                />
              </div>
              <div className="space-y-2 md:col-span-2">
                <Label>Adresse</Label>
                <Input
                  value={editClient.adresse ?? ""}
                  onChange={(e) =>
                    setEditClient({ ...editClient, adresse: e.target.value })
                  }
                />
              </div>
              <div className="space-y-2">
                <Label>Téléphone</Label>
                <Input
                  value={editClient.telephone ?? ""}
                  onChange={(e) =>
                    setEditClient({ ...editClient, telephone: e.target.value })
                  }
                />
              </div>
              <div className="space-y-2">
                <Label>Email</Label>
                <Input
                  type="email"
                  value={editClient.email ?? ""}
                  onChange={(e) =>
                    setEditClient({ ...editClient, email: e.target.value })
                  }
                />
              </div>
              <div className="space-y-2 md:col-span-2">
                <Label>Notes</Label>
                <Textarea
                  value={editClient.notes ?? ""}
                  onChange={(e) =>
                    setEditClient({ ...editClient, notes: e.target.value })
                  }
                  rows={3}
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
                {editClient.id ? "Modifier" : "Créer"}
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      <Card className="border-0 shadow-sm">
        <CardHeader className="pb-4">
          <div className="flex items-center gap-4">
            <div className="relative flex-1 max-w-sm">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Rechercher un client..."
                className="pl-10"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>
            <div className="text-sm text-muted-foreground">
              {filtered.length} client{filtered.length > 1 ? "s" : ""}
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex justify-center py-12">
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
          ) : filtered.length === 0 ? (
            <div className="text-center py-12">
              <Users className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
              <p className="text-muted-foreground">Aucun client trouvé</p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Nom</TableHead>
                  <TableHead className="hidden md:table-cell">Téléphone</TableHead>
                  <TableHead className="hidden md:table-cell">Email</TableHead>
                  <TableHead className="hidden lg:table-cell">Adresse</TableHead>
                  <TableHead className="hidden lg:table-cell">Créé le</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.map((client) => (
                  <TableRow key={client.id}>
                    <TableCell>
                      <div>
                        <p className="font-medium">{client.nom}</p>
                        {client.raison_sociale && (
                          <p className="text-xs text-muted-foreground">
                            {client.raison_sociale}
                          </p>
                        )}
                      </div>
                    </TableCell>
                    <TableCell className="hidden md:table-cell">
                      {client.telephone ?? "-"}
                    </TableCell>
                    <TableCell className="hidden md:table-cell">
                      {client.email ?? "-"}
                    </TableCell>
                    <TableCell className="hidden lg:table-cell">
                      {client.adresse ?? "-"}
                    </TableCell>
                    <TableCell className="hidden lg:table-cell">
                      {formatDate(client.created_at)}
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-1">
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => {
                            setEditClient(client);
                            setDialogOpen(true);
                          }}
                        >
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => handleDelete(client.id)}
                          className="text-red-600 hover:text-red-700"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
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
