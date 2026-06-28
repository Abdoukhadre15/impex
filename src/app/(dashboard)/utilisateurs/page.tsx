"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
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
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { toast } from "sonner";
import { Plus, Loader2, UserCog, KeyRound, Eye, EyeOff } from "lucide-react";
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
  const [newEmail, setNewEmail] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [newNom, setNewNom] = useState("");
  const [newRole, setNewRole] = useState<UserRole>("vendeur");
  const [saving, setSaving] = useState(false);

  const [pwdDialogOpen, setPwdDialogOpen] = useState(false);
  const [pwdUserId, setPwdUserId] = useState("");
  const [pwdUserName, setPwdUserName] = useState("");
  const [pwdNew, setPwdNew] = useState("");
  const [pwdConfirm, setPwdConfirm] = useState("");
  const [pwdShow, setPwdShow] = useState(false);
  const [pwdSaving, setPwdSaving] = useState(false);

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
      const data = await res.json();
      toast.error(data.error || "Erreur lors de la création");
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

  const openPwdDialog = (user: Profile) => {
    setPwdUserId(user.id);
    setPwdUserName(user.nom_complet);
    setPwdNew("");
    setPwdConfirm("");
    setPwdShow(false);
    setPwdDialogOpen(true);
  };

  const handleUpdatePassword = async () => {
    if (!pwdNew) {
      toast.error("Saisissez un nouveau mot de passe");
      return;
    }
    if (pwdNew.length < 6) {
      toast.error("Le mot de passe doit contenir au moins 6 caractères");
      return;
    }
    if (pwdNew !== pwdConfirm) {
      toast.error("Les mots de passe ne correspondent pas");
      return;
    }

    setPwdSaving(true);
    const res = await fetch("/api/auth/update-password", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ user_id: pwdUserId, password: pwdNew }),
    });

    if (!res.ok) {
      const data = await res.json();
      toast.error(data.error || "Erreur lors de la modification");
    } else {
      toast.success("Mot de passe modifié");
      setPwdDialogOpen(false);
    }
    setPwdSaving(false);
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
                <select
                  value={newRole}
                  onChange={(e) => setNewRole(e.target.value as UserRole)}
                  className="flex h-9 w-full rounded-lg border border-input bg-transparent px-3 py-2 text-sm outline-none focus:border-ring focus:ring-3 focus:ring-ring/50"
                >
                  <option value="admin">Administrateur</option>
                  <option value="vendeur">Vendeur</option>
                  <option value="comptable">Comptable</option>
                  <option value="consultation">Consultation</option>
                </select>
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

      {/* Dialog modifier mot de passe */}
      <Dialog open={pwdDialogOpen} onOpenChange={setPwdDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Modifier le mot de passe</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <p className="text-sm text-muted-foreground">
              Utilisateur : <span className="font-medium text-foreground">{pwdUserName}</span>
            </p>
            <div className="space-y-2">
              <Label>Nouveau mot de passe *</Label>
              <div className="relative">
                <Input
                  type={pwdShow ? "text" : "password"}
                  value={pwdNew}
                  onChange={(e) => setPwdNew(e.target.value)}
                  placeholder="Minimum 6 caractères"
                  className="pr-10"
                />
                <button
                  type="button"
                  onClick={() => setPwdShow(!pwdShow)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                >
                  {pwdShow ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>
            <div className="space-y-2">
              <Label>Confirmer le mot de passe *</Label>
              <Input
                type={pwdShow ? "text" : "password"}
                value={pwdConfirm}
                onChange={(e) => setPwdConfirm(e.target.value)}
                placeholder="Retapez le mot de passe"
              />
              {pwdConfirm && pwdNew !== pwdConfirm && (
                <p className="text-xs text-red-500">Les mots de passe ne correspondent pas</p>
              )}
            </div>
          </div>
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => setPwdDialogOpen(false)}>Annuler</Button>
            <Button
              onClick={handleUpdatePassword}
              disabled={pwdSaving || !pwdNew || pwdNew !== pwdConfirm}
              className="bg-[#DD0000] hover:bg-[#BB0000]"
            >
              {pwdSaving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Modifier
            </Button>
          </div>
        </DialogContent>
      </Dialog>

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
                  <TableHead className="text-center">Mot de passe</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {users.map((user) => (
                  <TableRow key={user.id}>
                    <TableCell className="font-medium">{user.nom_complet}</TableCell>
                    <TableCell>{user.email}</TableCell>
                    <TableCell>
                      <select
                        value={user.role}
                        onChange={(e) => handleUpdateRole(user.id, e.target.value as UserRole)}
                        className={`text-xs font-medium px-2 py-1 rounded-full border-0 cursor-pointer outline-none ${roleColors[user.role]}`}
                      >
                        <option value="admin">Administrateur</option>
                        <option value="vendeur">Vendeur</option>
                        <option value="comptable">Comptable</option>
                        <option value="consultation">Consultation</option>
                      </select>
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
                    <TableCell className="text-center">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => openPwdDialog(user)}
                        className="text-muted-foreground hover:text-foreground"
                        title="Modifier le mot de passe"
                      >
                        <KeyRound className="h-4 w-4 mr-1" />
                        <span className="hidden md:inline">Modifier</span>
                      </Button>
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
