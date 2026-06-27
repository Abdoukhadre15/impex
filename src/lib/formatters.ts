export function formatMontant(montant: number): string {
  return new Intl.NumberFormat('fr-FR', {
    style: 'decimal',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(montant) + ' FCFA'
}

export function formatDate(date: string): string {
  return new Intl.DateTimeFormat('fr-FR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  }).format(new Date(date))
}

export function formatDateLong(date: string): string {
  return new Intl.DateTimeFormat('fr-FR', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  }).format(new Date(date))
}

export function formatTelephone(tel: string): string {
  return tel.replace(/(\d{2})(?=\d)/g, '$1 ').trim()
}

export function genererNumero(prefixe: string, sequence: number): string {
  const annee = new Date().getFullYear()
  const num = String(sequence).padStart(4, '0')
  return `${prefixe}-${annee}-${num}`
}

export function calculerTTC(prixHT: number, tva: number): number {
  return prixHT * (1 + tva / 100)
}

export function calculerHT(prixTTC: number, tva: number): number {
  return prixTTC / (1 + tva / 100)
}
