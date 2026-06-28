export const PERIODES = [
  { value: "ce_mois", label: "Ce mois" },
  { value: "mois_dernier", label: "Mois dernier" },
  { value: "3_mois", label: "3 derniers mois" },
  { value: "6_mois", label: "6 derniers mois" },
  { value: "cette_annee", label: "Cette année" },
  { value: "annee_derniere", label: "Année dernière" },
] as const;

export type PeriodeValue = (typeof PERIODES)[number]["value"];

export function getDateRange(periode: PeriodeValue): { debut: string; fin: string } {
  const now = new Date();
  const y = now.getFullYear();
  const m = now.getMonth();

  let debut: Date;
  let fin: Date = now;

  switch (periode) {
    case "ce_mois":
      debut = new Date(y, m, 1);
      break;
    case "mois_dernier":
      debut = new Date(y, m - 1, 1);
      fin = new Date(y, m, 0);
      break;
    case "3_mois":
      debut = new Date(y, m - 2, 1);
      break;
    case "6_mois":
      debut = new Date(y, m - 5, 1);
      break;
    case "cette_annee":
      debut = new Date(y, 0, 1);
      break;
    case "annee_derniere":
      debut = new Date(y - 1, 0, 1);
      fin = new Date(y - 1, 11, 31);
      break;
    default:
      debut = new Date(y, m, 1);
  }

  return {
    debut: debut.toISOString().split("T")[0],
    fin: fin.toISOString().split("T")[0],
  };
}
