import { useCallback, useEffect, useMemo, useState } from 'react';
import axios from 'axios';
import { API, DEFAULT_CONFIG, LOGO, formatDate, formatDateTime, formatMoney, type PublicConfig } from './config';

type Registration = {
  id: number;
  reg_no: string | null;
  full_name: string;
  phone: string;
  email: string;
  dob: string;
  address: string;
  payment_amount: string;
  payment_status: string;
  submitted_at: string;
  approved_at: string | null;
};

const isApproved = (r: Registration) => r.payment_status === 'APPROVED';

const TOKEN_KEY = 'eps_admin_token';

/** Normalise an Indian mobile number into a wa.me target. */
const waNumber = (phone: string) => {
  const digits = phone.replace(/\D/g, '');
  if (digits.length === 10) return '91' + digits;
  return digits.replace(/^0+/, '');
};

const triggerDownload = (blob: Blob, fileName: string) => {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = fileName;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
};

export default function Admin() {
  const [token, setToken] = useState<string | null>(() => sessionStorage.getItem(TOKEN_KEY));
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [loginError, setLoginError] = useState('');
  const [loggingIn, setLoggingIn] = useState(false);

  const [cfg, setCfg] = useState<PublicConfig>(DEFAULT_CONFIG);
  const [rows, setRows] = useState<Registration[]>([]);
  const [summary, setSummary] = useState({ total: 0, pending: 0, approved: 0, collected: 0 });
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(false);
  const [loadError, setLoadError] = useState('');

  const [viewing, setViewing] = useState<Registration | null>(null);
  const [payShot, setPayShot] = useState<Registration | null>(null);
  const [carding, setCarding] = useState<Registration | null>(null);
  const [sending, setSending] = useState(false);
  const [sendNote, setSendNote] = useState('');
  const [approvingId, setApprovingId] = useState<number | null>(null);

  const authUrl = useCallback(
    (path: string, params: Record<string, string | number> = {}) => {
      const qs = new URLSearchParams({ token: token ?? '', ...Object.fromEntries(Object.entries(params).map(([k, v]) => [k, String(v)])) });
      return `${API}${path}?${qs.toString()}`;
    },
    [token],
  );

  useEffect(() => {
    axios
      .get(`${API}/api/config.php`)
      .then((r) => setCfg({ ...DEFAULT_CONFIG, ...r.data }))
      .catch(() => undefined);
  }, []);

  const load = useCallback(
    async (term: string) => {
      if (!token) return;
      setLoading(true);
      setLoadError('');
      try {
        const res = await axios.get(`${API}/api/admin/registrations.php`, {
          headers: { 'X-Admin-Token': token },
          params: term ? { search: term } : undefined,
        });
        setRows(res.data.registrations ?? []);
        setSummary({
          total: res.data.allTotal ?? res.data.total ?? 0,
          pending: res.data.pending ?? 0,
          approved: res.data.approved ?? 0,
          collected: Number(res.data.collected ?? 0),
        });
      } catch (err) {
        if (axios.isAxiosError(err) && err.response?.status === 401) {
          sessionStorage.removeItem(TOKEN_KEY);
          setToken(null);
        } else {
          setLoadError('Could not load registrations. Check that the server is running.');
        }
      } finally {
        setLoading(false);
      }
    },
    [token],
  );

  useEffect(() => {
    if (token) load('');
  }, [token, load]);

  // Debounce the search so each keystroke does not hit the API.
  useEffect(() => {
    if (!token) return;
    const t = setTimeout(() => load(search.trim()), 300);
    return () => clearTimeout(t);
  }, [search, token, load]);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoggingIn(true);
    setLoginError('');
    try {
      const res = await axios.post(`${API}/api/admin/login.php`, { username, password });
      if (res.data.success && res.data.token) {
        sessionStorage.setItem(TOKEN_KEY, res.data.token);
        setToken(res.data.token);
        setPassword('');
      } else {
        setLoginError('Invalid username or password.');
      }
    } catch (err) {
      setLoginError(
        axios.isAxiosError(err) && err.response?.status === 401
          ? 'Invalid username or password.'
          : 'Could not reach the server.',
      );
    } finally {
      setLoggingIn(false);
    }
  };

  const logout = () => {
    sessionStorage.removeItem(TOKEN_KEY);
    setToken(null);
    setRows([]);
  };

  /** Approve a pending registration — allocates its running EPS number. */
  const approve = async (reg: Registration) => {
    if (!token || approvingId) return;
    setApprovingId(reg.id);
    try {
      const res = await axios.post(
        `${API}/api/admin/approve.php`,
        { id: reg.id },
        { headers: { 'X-Admin-Token': token } },
      );
      if (res.data.success) {
        await load(search.trim());
      }
    } catch {
      setLoadError('Could not approve the registration. Please try again.');
    } finally {
      setApprovingId(null);
    }
  };

  /**
   * Share the generated ID card. On devices that support sharing files (most
   * phones) this hands the image straight to WhatsApp; elsewhere the card is
   * downloaded and the WhatsApp chat is opened so it can be attached.
   */
  const sendIdCard = async (reg: Registration) => {
    setSending(true);
    setSendNote('');
    const message =
      `Hello ${reg.full_name}, your ${cfg.event_name} is confirmed.\n` +
      `Registration No: ${reg.reg_no}\n` +
      `Amount paid: ${formatMoney(Number(reg.payment_amount))} (PAID)\n\n` +
      `Your ID card is attached. Please keep it for your reference.`;

    try {
      const res = await fetch(authUrl('/api/admin/idcard.php', { id: reg.id, download: 1 }));
      if (!res.ok) throw new Error('idcard fetch failed');
      const blob = await res.blob();
      const fileName = `${reg.reg_no}_EPS_IDCard.png`;
      const file = new File([blob], fileName, { type: 'image/png' });

      if (navigator.canShare?.({ files: [file] })) {
        await navigator.share({ files: [file], text: message, title: cfg.event_name });
        setSendNote('Shared successfully.');
        return;
      }

      triggerDownload(blob, fileName);
      window.open(`https://wa.me/${waNumber(reg.phone)}?text=${encodeURIComponent(message)}`, '_blank');
      setSendNote('ID card downloaded and WhatsApp opened — attach the downloaded image to send it.');
    } catch (err) {
      // A cancelled share is a normal user action, not a failure.
      if (err instanceof DOMException && err.name === 'AbortError') return;
      setSendNote('Could not prepare the ID card. Please try again.');
    } finally {
      setSending(false);
    }
  };

  const tiles = useMemo(
    () => [
      { label: 'Total Registrations', value: String(summary.total), accent: 'bg-brand' },
      { label: 'Pending Approval', value: String(summary.pending), accent: 'bg-amber-500' },
      { label: 'Approved (Paid)', value: String(summary.approved), accent: 'bg-teal' },
      { label: 'Total Collected', value: formatMoney(summary.collected), accent: 'bg-navy' },
    ],
    [summary],
  );

  const statusBadge = (r: Registration) =>
    isApproved(r) ? (
      <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2.5 py-1 text-[11px] font-bold text-emerald-700">
        <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" /> Paid
      </span>
    ) : (
      <span className="inline-flex items-center gap-1 rounded-full bg-amber-50 px-2.5 py-1 text-[11px] font-bold text-amber-700">
        <span className="h-1.5 w-1.5 rounded-full bg-amber-500" /> Pending
      </span>
    );

  // Action buttons shared by the desktop table and the mobile cards.
  const rowActions = (r: Registration) => (
    <>
      <button
        onClick={() => setPayShot(r)}
        className="inline-flex items-center gap-1.5 rounded-lg border border-hair px-3 py-1.5 text-xs font-bold text-navy transition hover:border-brand hover:text-brand"
      >
        <ImageIcon /> Payment
      </button>
      <button
        onClick={() => setViewing(r)}
        className="rounded-lg border border-hair px-3 py-1.5 text-xs font-bold text-navy transition hover:border-brand hover:text-brand"
      >
        View
      </button>
      {isApproved(r) ? (
        <button
          onClick={() => {
            setCarding(r);
            setSendNote('');
          }}
          className="rounded-lg bg-navy px-3 py-1.5 text-xs font-bold text-white transition hover:bg-navy-800"
        >
          Send ID Card
        </button>
      ) : (
        <button
          onClick={() => approve(r)}
          disabled={approvingId === r.id}
          className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-600 px-3 py-1.5 text-xs font-bold text-white transition hover:bg-emerald-700 disabled:opacity-60"
        >
          {approvingId === r.id ? 'Approving…' : '✓ Approve'}
        </button>
      )}
    </>
  );

  /* ------------------------------------------------------------ login view */
  if (!token) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-navy p-4">
        <div className="pointer-events-none absolute -top-32 -left-24 h-96 w-96 rounded-full bg-brand/15 blur-3xl" />
        <div className="pointer-events-none absolute -right-24 -bottom-32 h-96 w-96 rounded-full bg-teal/15 blur-3xl" />

        <div className="animate-pop-in relative w-full max-w-sm overflow-hidden rounded-3xl bg-white shadow-2xl">
          <div className="bg-navy px-6 pt-7 pb-6 text-center">
            <div className="mx-auto mb-4 inline-flex rounded-2xl bg-white px-4 py-2.5">
              <img src={LOGO} alt="JCI" className="h-8 w-auto" />
            </div>
            <h1 className="text-base font-extrabold text-white">{cfg.event_name}</h1>
            <p className="mt-1 text-[11px] tracking-[0.25em] text-white/40 uppercase">Admin Console</p>
          </div>
          <div className="flex">
            <div className="h-1.5 flex-[55] bg-brand" />
            <div className="h-1.5 flex-[45] bg-teal" />
          </div>

          <form onSubmit={handleLogin} className="space-y-4 p-6">
            <div>
              <label className="mb-1.5 block text-xs font-bold tracking-wider text-navy uppercase">Username</label>
              <input
                type="text"
                required
                autoComplete="username"
                className="w-full rounded-xl border border-hair px-4 py-3 text-sm text-ink outline-none transition focus:border-brand focus:ring-2 focus:ring-brand/15"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
              />
            </div>
            <div>
              <label className="mb-1.5 block text-xs font-bold tracking-wider text-navy uppercase">Password</label>
              <input
                type="password"
                required
                autoComplete="current-password"
                className="w-full rounded-xl border border-hair px-4 py-3 text-sm text-ink outline-none transition focus:border-brand focus:ring-2 focus:ring-brand/15"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
            </div>
            {loginError && <p className="text-xs font-semibold text-rose-600">{loginError}</p>}
            <button
              type="submit"
              disabled={loggingIn}
              className="w-full rounded-xl bg-navy py-3 text-xs font-bold tracking-wider text-white uppercase transition hover:bg-navy-800 disabled:opacity-60"
            >
              {loggingIn ? 'Signing in…' : 'Sign In'}
            </button>
          </form>
        </div>
      </div>
    );
  }

  /* ------------------------------------------------------- dashboard view */
  return (
    <div className="min-h-screen bg-slate-50">
      <header className="sticky top-0 z-30 border-b border-hair bg-white/90 backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-3 px-4 py-3">
          <div className="flex items-center gap-3">
            <img src={LOGO} alt="JCI" className="h-8 w-auto" />
            <div className="hidden h-8 w-px bg-hair sm:block" />
            <div className="hidden sm:block">
              <p className="text-sm font-extrabold text-navy">{cfg.event_name}</p>
              <p className="text-[11px] text-muted">Admin Console</p>
            </div>
          </div>
          <button
            onClick={logout}
            className="rounded-xl border border-hair px-4 py-2 text-xs font-bold text-navy transition hover:border-rose-300 hover:text-rose-600"
          >
            Sign Out
          </button>
        </div>
      </header>

      <main className="mx-auto max-w-6xl space-y-6 px-4 py-6">
        {/* ---------------------------------------------------------- tiles */}
        <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
          {tiles.map((t) => (
            <div key={t.label} className="relative overflow-hidden rounded-2xl border border-hair bg-white p-5 shadow-sm">
              <span className={`absolute top-0 bottom-0 left-0 w-1.5 ${t.accent}`} />
              <p className="text-[11px] font-bold tracking-wider text-muted uppercase">{t.label}</p>
              <p className="mt-1.5 text-3xl font-extrabold text-navy">{t.value}</p>
            </div>
          ))}
        </div>

        {/* --------------------------------------------------------- exports */}
        <div className="rounded-2xl border border-hair bg-white p-5 shadow-sm">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="text-sm font-extrabold text-navy">Export all registrations</p>
              <p className="mt-0.5 text-xs text-muted">
                Every field, formatted and branded — ready to print or share.
              </p>
            </div>
            <div className="flex flex-col gap-3 sm:flex-row">
              <a
                href={authUrl('/api/admin/export-excel.php')}
                className="inline-flex items-center justify-center gap-2 rounded-xl bg-emerald-600 px-5 py-3 text-xs font-bold text-white shadow-sm transition hover:bg-emerald-700"
              >
                <SheetIcon /> Download Excel
              </a>
              <a
                href={authUrl('/api/admin/export-pdf.php')}
                className="inline-flex items-center justify-center gap-2 rounded-xl bg-rose-600 px-5 py-3 text-xs font-bold text-white shadow-sm transition hover:bg-rose-700"
              >
                <PdfIcon /> Download PDF
              </a>
            </div>
          </div>
        </div>

        {/* ----------------------------------------------------------- table */}
        <div className="overflow-hidden rounded-2xl border border-hair bg-white shadow-sm">
          <div className="flex flex-col gap-3 border-b border-hair p-4 sm:flex-row sm:items-center sm:justify-between">
            <h2 className="text-sm font-extrabold text-navy">
              Registrations {loading && <span className="ml-2 text-xs font-semibold text-muted">loading…</span>}
            </h2>
            <div className="flex items-center gap-2">
              <input
                type="search"
                placeholder="Search name, phone, mail or reg no"
                className="w-full rounded-xl border border-hair px-4 py-2.5 text-sm outline-none transition focus:border-brand focus:ring-2 focus:ring-brand/15 sm:w-72"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
              <button
                onClick={() => load(search.trim())}
                className="rounded-xl border border-hair px-3 py-2.5 text-xs font-bold text-navy transition hover:border-brand hover:text-brand"
                title="Refresh"
              >
                ↻
              </button>
            </div>
          </div>

          {loadError && <p className="p-4 text-sm font-semibold text-rose-600">{loadError}</p>}

          {/* Desktop: table */}
          <div className="hidden overflow-x-auto md:block">
            <table className="w-full min-w-[900px] text-left text-sm">
              <thead className="bg-navy text-[11px] tracking-wider text-white uppercase">
                <tr>
                  <th className="px-4 py-3 font-bold">#</th>
                  <th className="px-4 py-3 font-bold">Reg No</th>
                  <th className="px-4 py-3 font-bold">Name</th>
                  <th className="px-4 py-3 font-bold">WhatsApp</th>
                  <th className="px-4 py-3 font-bold">Mail ID</th>
                  <th className="px-4 py-3 font-bold">DOB</th>
                  <th className="px-4 py-3 font-bold">Status</th>
                  <th className="px-4 py-3 text-right font-bold">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-hair">
                {rows.map((r, i) => (
                  <tr key={r.id} className="transition hover:bg-brand-soft/40">
                    <td className="px-4 py-3 text-xs text-muted">{i + 1}</td>
                    <td className="px-4 py-3 font-mono text-xs font-bold text-brand">
                      {r.reg_no ?? <span className="text-muted">—</span>}
                    </td>
                    <td className="px-4 py-3 font-bold text-navy">{r.full_name}</td>
                    <td className="px-4 py-3 text-xs text-ink">{r.phone}</td>
                    <td className="px-4 py-3 text-xs text-ink">{r.email}</td>
                    <td className="px-4 py-3 text-xs text-ink">{formatDate(r.dob)}</td>
                    <td className="px-4 py-3">{statusBadge(r)}</td>
                    <td className="px-4 py-3">
                      <div className="flex flex-wrap justify-end gap-2">{rowActions(r)}</div>
                    </td>
                  </tr>
                ))}
                {!loading && rows.length === 0 && (
                  <tr>
                    <td colSpan={8} className="px-4 py-12 text-center text-sm text-muted">
                      {search ? 'No registrations match your search.' : 'No registrations yet.'}
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          {/* Mobile: stacked cards */}
          <div className="divide-y divide-hair md:hidden">
            {rows.map((r, i) => (
              <div key={r.id} className="p-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-extrabold text-navy">{r.full_name}</p>
                    <p className="mt-0.5 font-mono text-xs font-bold text-brand">
                      {r.reg_no ?? <span className="text-muted">No number yet</span>}
                    </p>
                  </div>
                  <div className="flex shrink-0 flex-col items-end gap-1">
                    <span className="text-[11px] text-muted">#{i + 1}</span>
                    {statusBadge(r)}
                  </div>
                </div>
                <div className="mt-3 grid grid-cols-1 gap-1 text-xs text-ink">
                  <p className="truncate"><span className="font-semibold text-muted">WhatsApp:</span> {r.phone}</p>
                  <p className="truncate"><span className="font-semibold text-muted">Mail:</span> {r.email}</p>
                  <p><span className="font-semibold text-muted">DOB:</span> {formatDate(r.dob)}</p>
                </div>
                <div className="mt-3 flex flex-wrap gap-2">{rowActions(r)}</div>
              </div>
            ))}
            {!loading && rows.length === 0 && (
              <p className="px-4 py-12 text-center text-sm text-muted">
                {search ? 'No registrations match your search.' : 'No registrations yet.'}
              </p>
            )}
          </div>
        </div>

        {/* -------------------------------------------------------- footer */}
        <footer className="pt-2 pb-6 text-center">
          <a
            href="https://www.inwora.com"
            target="_blank"
            rel="noreferrer"
            className="text-xs font-semibold text-muted transition hover:text-brand"
          >
            Developed by <span className="font-bold text-navy">inwora</span>
          </a>
        </footer>
      </main>

      {/* ------------------------------------------ payment screenshot modal */}
      {payShot && (
        <Modal onClose={() => setPayShot(null)} title="Payment Screenshot" subtitle={`${payShot.reg_no} · ${payShot.full_name}`}>
          <div className="flex flex-col items-center">
            <a
              href={authUrl('/api/admin/image.php', { id: payShot.id, field: 'payment' })}
              target="_blank"
              rel="noreferrer"
              className="block w-full overflow-hidden rounded-2xl border border-hair bg-slate-50"
              title="Open full size in a new tab"
            >
              <img
                src={authUrl('/api/admin/image.php', { id: payShot.id, field: 'payment' })}
                alt={`Payment screenshot for ${payShot.full_name}`}
                className="mx-auto max-h-[60vh] w-auto object-contain"
              />
            </a>
            <div className="mt-4 flex w-full flex-col gap-3 sm:flex-row">
              <a
                href={authUrl('/api/admin/image.php', { id: payShot.id, field: 'payment' })}
                target="_blank"
                rel="noreferrer"
                className="inline-flex flex-1 items-center justify-center gap-2 rounded-xl border border-hair py-3 text-xs font-bold text-navy transition hover:border-brand hover:text-brand"
              >
                Open Full Size
              </a>
              <a
                href={authUrl('/api/admin/image.php', { id: payShot.id, field: 'payment', download: 1 })}
                className="inline-flex flex-1 items-center justify-center gap-2 rounded-xl bg-navy py-3 text-xs font-bold text-white transition hover:bg-navy-800"
              >
                <DownloadIcon /> Download Payment Image
              </a>
            </div>
          </div>
        </Modal>
      )}

      {/* ---------------------------------------------------- details modal */}
      {viewing && (
        <Modal onClose={() => setViewing(null)} title="Registration Details" subtitle={viewing.reg_no ?? 'Pending approval'}>
          <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
            <dl className="space-y-4">
              <div className="flex items-center gap-4">
                <img
                  src={authUrl('/api/admin/image.php', { id: viewing.id, field: 'photo' })}
                  alt={`${viewing.full_name} profile`}
                  className="h-20 w-20 shrink-0 rounded-full border-2 border-teal object-cover"
                />
                <div>
                  <p className="text-sm font-extrabold text-navy">{viewing.full_name}</p>
                  <div className="mt-1">{statusBadge(viewing)}</div>
                  <p className="mt-1 font-mono text-xs font-bold text-brand">
                    {viewing.reg_no ?? 'Number issued after approval'}
                  </p>
                </div>
              </div>
              <Detail label="Phone No (WhatsApp)" value={viewing.phone} />
              <Detail label="Mail ID" value={viewing.email} />
              <Detail label="Date of Birth" value={formatDate(viewing.dob)} />
              <Detail label="Address" value={viewing.address} />
              <Detail
                label="Payment"
                value={`${formatMoney(Number(viewing.payment_amount))} · ${isApproved(viewing) ? 'Paid' : 'Pending'}`}
              />
              <Detail label="Registered On" value={formatDateTime(viewing.submitted_at)} />
            </dl>

            <div>
              <p className="mb-2 text-[11px] font-bold tracking-wider text-muted uppercase">Payment Screenshot</p>
              <a
                href={authUrl('/api/admin/image.php', { id: viewing.id, field: 'payment' })}
                target="_blank"
                rel="noreferrer"
                className="block overflow-hidden rounded-2xl border border-hair bg-slate-50"
              >
                <img
                  src={authUrl('/api/admin/image.php', { id: viewing.id, field: 'payment' })}
                  alt="Payment screenshot"
                  className="mx-auto max-h-80 w-auto object-contain"
                />
              </a>
              <a
                href={authUrl('/api/admin/image.php', { id: viewing.id, field: 'payment', download: 1 })}
                className="mt-3 inline-flex w-full items-center justify-center gap-2 rounded-xl bg-navy py-3 text-xs font-bold text-white transition hover:bg-navy-800"
              >
                <DownloadIcon /> Download Payment Image
              </a>
            </div>
          </div>
        </Modal>
      )}

      {/* ---------------------------------------------------- ID card modal */}
      {carding && (
        <Modal onClose={() => setCarding(null)} title="EPS ID Card" subtitle={carding.full_name}>
          <div className="grid grid-cols-1 gap-6 md:grid-cols-[minmax(0,320px)_1fr]">
            <img
              src={authUrl('/api/admin/idcard.php', { id: carding.id })}
              alt={`ID card for ${carding.full_name}`}
              className="w-full rounded-2xl border border-hair shadow-lg"
            />

            <div className="space-y-4">
              <p className="text-sm text-ink">
                The card carries the JCI logo, the EPS registration heading and every submitted detail along with the
                paid confirmation.
              </p>

              <button
                onClick={() => sendIdCard(carding)}
                disabled={sending}
                className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-[#25D366] py-3.5 text-sm font-bold text-white transition hover:bg-[#1eb455] disabled:opacity-60"
              >
                <WhatsAppIcon /> {sending ? 'Preparing…' : `Send to ${carding.phone} on WhatsApp`}
              </button>

              <a
                href={authUrl('/api/admin/idcard.php', { id: carding.id, download: 1 })}
                className="inline-flex w-full items-center justify-center gap-2 rounded-xl border border-hair py-3.5 text-sm font-bold text-navy transition hover:border-brand hover:text-brand"
              >
                <DownloadIcon /> Download ID Card
              </a>

              {sendNote && (
                <p className="rounded-xl border border-brand/30 bg-brand-soft px-4 py-3 text-xs font-semibold text-navy">
                  {sendNote}
                </p>
              )}

              <p className="text-[11px] leading-relaxed text-muted">
                On phones the image is handed directly to WhatsApp. On desktop the card downloads and the chat opens —
                attach the downloaded image to complete the send.
              </p>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}

/* --------------------------------------------------------------- fragments */

function Modal({
  title,
  subtitle,
  onClose,
  children,
}: {
  title: string;
  subtitle?: string;
  onClose: () => void;
  children: React.ReactNode;
}) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  return (
    <div className="fixed inset-0 z-100 flex items-start justify-center overflow-y-auto bg-navy/60 p-4 backdrop-blur-sm">
      <div className="animate-pop-in my-6 w-full max-w-3xl overflow-hidden rounded-3xl bg-white shadow-2xl">
        <div className="flex items-start justify-between bg-navy px-6 py-5">
          <div>
            <h3 className="text-base font-extrabold text-white">{title}</h3>
            {subtitle && <p className="mt-0.5 text-xs text-white/50">{subtitle}</p>}
          </div>
          <button
            onClick={onClose}
            className="rounded-lg p-1.5 text-white/60 transition hover:bg-white/10 hover:text-white"
            aria-label="Close"
          >
            <svg className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
        <div className="flex">
          <div className="h-1.5 flex-[55] bg-brand" />
          <div className="h-1.5 flex-[45] bg-teal" />
        </div>
        <div className="p-6">{children}</div>
      </div>
    </div>
  );
}

function Detail({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-[11px] font-bold tracking-wider text-muted uppercase">{label}</dt>
      <dd className="mt-0.5 text-sm font-semibold break-words text-ink">{value}</dd>
    </div>
  );
}

function SheetIcon() {
  return (
    <svg className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" d="M4 4h16v16H4zM4 10h16M10 4v16" />
    </svg>
  );
}

function PdfIcon() {
  return (
    <svg className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" d="M7 3h7l5 5v13a1 1 0 01-1 1H7a1 1 0 01-1-1V4a1 1 0 011-1z" />
      <path strokeLinecap="round" strokeLinejoin="round" d="M14 3v5h5M9 13h6M9 17h4" />
    </svg>
  );
}

function ImageIcon() {
  return (
    <svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
      <rect x="3" y="4" width="18" height="16" rx="2" />
      <circle cx="8.5" cy="9.5" r="1.5" />
      <path strokeLinecap="round" strokeLinejoin="round" d="M4 17l4.5-4.5L12 16l3-3 5 5" />
    </svg>
  );
}

function DownloadIcon() {
  return (
    <svg className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v12m0 0l-4-4m4 4l4-4M4 18v2h16v-2" />
    </svg>
  );
}

function WhatsAppIcon() {
  return (
    <svg className="h-4 w-4" fill="currentColor" viewBox="0 0 24 24">
      <path d="M12.04 2C6.58 2 2.13 6.45 2.13 11.91c0 1.75.46 3.45 1.32 4.95L2 22l5.25-1.38a9.9 9.9 0 004.79 1.22h.01c5.46 0 9.91-4.45 9.91-9.91 0-2.65-1.03-5.14-2.9-7.01A9.82 9.82 0 0012.04 2zm0 18.15h-.01a8.2 8.2 0 01-4.19-1.15l-.3-.18-3.12.82.83-3.04-.2-.31a8.19 8.19 0 01-1.26-4.38c0-4.54 3.7-8.23 8.25-8.23a8.2 8.2 0 015.83 2.42 8.18 8.18 0 012.41 5.82c0 4.54-3.7 8.23-8.24 8.23zm4.52-6.16c-.25-.12-1.47-.72-1.69-.81-.23-.08-.39-.12-.56.13-.16.24-.64.8-.79.97-.14.16-.29.18-.54.06-.25-.13-1.05-.39-1.99-1.23-.74-.66-1.24-1.47-1.38-1.72-.15-.25-.02-.38.11-.5.11-.11.25-.29.37-.44.13-.15.17-.25.25-.41.09-.17.04-.31-.02-.44-.06-.12-.56-1.35-.77-1.85-.2-.48-.4-.42-.56-.43h-.47c-.17 0-.43.06-.66.31-.22.25-.86.85-.86 2.07 0 1.21.89 2.39 1.01 2.55.12.17 1.75 2.67 4.23 3.74.59.26 1.05.41 1.41.52.59.19 1.13.16 1.56.1.47-.07 1.47-.6 1.68-1.18.2-.58.2-1.07.15-1.18-.06-.11-.23-.17-.48-.29z" />
    </svg>
  );
}
