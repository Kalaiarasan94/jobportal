export const API = import.meta.env.VITE_API_URL ?? '';

export const LOGO = '/logo.jpeg';
export const QR = '/qr.jpeg';

export type PublicConfig = {
  org_name: string;
  event_name: string;
  fee: number;
  contact_phone: string;
  contact_whatsapp: string;
  max_upload_mb: number;
};

/** Used until /api/config.php responds, and if it never does. */
export const DEFAULT_CONFIG: PublicConfig = {
  org_name: 'Malligai EPS',
  event_name: 'Malligai EPS Registration',
  fee: 2000,
  contact_phone: '+917200783406',
  contact_whatsapp: '917200783406',
  max_upload_mb: 8,
};

export const formatMoney = (amount: number) =>
  '₹' + Number(amount || 0).toLocaleString('en-IN', { minimumFractionDigits: 0 });

export const formatDate = (value?: string | null) => {
  if (!value) return '—';
  const d = new Date(value.replace(' ', 'T'));
  if (Number.isNaN(d.getTime())) return value;
  return d.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
};

export const formatDateTime = (value?: string | null) => {
  if (!value) return '—';
  const d = new Date(value.replace(' ', 'T'));
  if (Number.isNaN(d.getTime())) return value;
  return d.toLocaleString('en-IN', {
    day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit',
  });
};
