"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
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
import { Switch } from "@/components/ui/switch";
import { toast } from "sonner";
import { Plus, Loader2, UserCog, Pencil } from "lucide-react";
import type { Profile, UserRole } from "@/types/database";
import { formatDate } from "@/lib/formatters";

const roleLabels: Record<string, string> = {
  admin: "Administrateur",
  vendeur: "Vendeur",
  comptable: "Comptable",
  consultation: "Consultation",
};

const roleColors: Record<string, string> = {
  admin: "bg-red-100 text-red-800",
  vendeur: "bg-blue-100 text-blue-800",
  comptable: "bg-green-100 text-green-800",
  consultation: "bg-gray-100 text-gray-800",
};

export default function UtilisateursPage() {
  const [users, setUsers] = useState<Profile[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editUser, setEditUser] = useState<Partial<Profile> | null>(null);
  const [newEmail, setNewEmail] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [newNom, setNewNom] = useState("");
  const [newRole, setNewRole] = useState<UserRole>("vendeur");
  const [saving, setSaving] = useState(false);

  const loadUsers = async () => {
    const supabase = createClient();
    const { data, error } = await supabase
      .from("profiles")
      .select("*")
      .order("created_at", { ascending: false });
    if (error) {
      console.error("Erreur chargement utilisateurs:", error);
      toast.error("Erreur de chargement des utilisateurs");
    }
    setUsers(data ?? []);
    setLoading(false);
  };

  useEffect(() => {
    loadUsers();
  }, []);

  const handleCreateUser = async () => {
    if (!newEmail || !newPassword || !newNom) {
      toast.error("Remplissez tous les champs");
      return;
    }
    setSaving(true);

    const res = await fetch("/api/auth/create-user", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        email: newEmail,
        password: newPassword,
        nom_complet: newNom,
        role: newRole,
      }),
    });

    if (!res.ok) {
      toast.error("Erreur lors de la création");
    } else {
      toast.success("Utilisateur créé");
      setDialogOpen(false);
      setNewEmail("");
      setNewPassword("");
      setNewNom("");
      setNewRole("vendeur");
      loadUsers();
    }
    setSaving(false);
  };

  const handleUpdateRole = async (userId: string, role: UserRole) => {
    const supabase = createClient();
    const { error } = await supabase
      .from("profiles")
      .update({ role })
      .eq("id", userId);
    if (error) toast.error("Erreur");
    else {
      toast.success("Rôle mis à jour");
      loadUsers();
    }
  };

  const handleToggleActif = async (userId: string, actif: boolean) => {
    const supabase = createClient();
    const { error } = await supabase
      .from("profiles")
      .update({ actif })
      .eq("id", userId);
    if (error) toast.error("Erreur");
    else {
      toast.success(actif ? "Utilisateur activé" : "Utilisateur désactivé");
      loadUsers();
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Utilisateurs</h1>
          <p className="text-muted-foreground">Gestion des accès et rôles</p>
        </div>
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogTrigger render={<Button className="bg-[#DD0000] hover:bg-[#BB0000]" />}>
            <Plus className="mr-2 h-4 w-4" />
            Nouvel utilisateur
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Nouvel utilisateur</DialogTitle>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label>Nom complet *</Label>
                <Input value={newNom} onChange={(e) => setNewNom(e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label>Email *</Label>
                <Input type="email" value={newEmail} onChange={(e) => setNewEmail(e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label>Mot de passe *</Label>
                <Input type="password" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label>Rôle</Label>
                <Select value={newRole} onValueChange={(v) => v && setNewRole(v as UserRole)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="admin">Administrateur</SelectItem>
                    <SelectItem value="vendeur">Vendeur</SelectItem>
                    <SelectItem value="comptable">Comptable</SelectItem>
                    <SelectItem value="consultation">Consultation</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setDialogOpen(false)}>Annuler</Button>
              <Button onClick={handleCreateUser} disabled={saving} className="bg-[#DD0000] hover:bg-[#BB0000]">
                {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Créer
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      <Card className="border-0 shadow-sm">
        <CardContent className="pt-6">
          {loading ? (
            <div className="flex justify-center py-12">
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
          ) : users.length === 0 ? (
            <div className="text-center py-12">
              <UserCog className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
              <p className="text-muted-foreground">Aucun utilisateur</p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Nom</TableHead>
                  <TableHead>Email</TableHead>
                  <TableHead>Rôle</TableHead>
                  <TableHead className="hidden md:table-cell">Créé le</TableHead>
                  <TableHead className="text-center">Actif</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {users.map((user) => (
                  <TableRow key={user.id}>
                    <TableCell className="font-medium">{user.nom_complet}</TableCell>
                    <TableCell>{user.email}</TableCell>
                    <TableCell>
                      <Select
                        value={user.role}
                        onValueChange={(v) => v && handleUpdateRole(user.id, v as UserRole)}
                      >
                        <SelectTrigger className="w-[150px] h-8">
                          <Badge className={roleColors[user.role]}>
                            {roleLabels[user.role]}
                          </Badge>
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="admin">Administrateur</SelectItem>
                          <SelectItem value="vendeur">Vendeur</SelectItem>
                          <SelectItem value="comptable">Comptable</SelectItem>
                          <SelectItem value="consultation">Consultation</SelectItem>
                        </SelectContent>
                      </Select>
                    </TableCell>
                    <TableCell className="hidden md:table-cell">
                      {formatDate(user.created_at)}
                    </TableCell>
                    <TableCell className="text-center">
                      <Switch
                        checked={user.actif}
                        onCheckedChange={(v) => handleToggleActif(user.id, v)}
                      />
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
