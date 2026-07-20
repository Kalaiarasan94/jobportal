import { useEffect, useRef, useState } from 'react';
import axios from 'axios';
import Splash from './Splash';
import { API, DEFAULT_CONFIG, LOGO, QR, formatMoney, type PublicConfig } from './config';

type FormState = {
  full_name: string;
  phone: string;
  email: string;
  dob: string;
  address: string;
};

const EMPTY_FORM: FormState = { full_name: '', phone: '', email: '', dob: '', address: '' };

const FIELDS: { key: keyof FormState; label: string; hint: string; type: string }[] = [
  { key: 'full_name', label: 'Name',                 hint: 'Your full name as it should appear on the ID card', type: 'text' },
  { key: 'phone',     label: 'Phone No (WhatsApp)',  hint: 'Your ID card will be sent to this WhatsApp number',  type: 'tel'  },
  { key: 'email',     label: 'Mail ID',              hint: 'We send the confirmation here',                      type: 'email'},
  { key: 'dob',       label: 'Date of Birth',        hint: '',                                                   type: 'date' },
];

export default function App() {
  const [splashLeaving, setSplashLeaving] = useState(false);
  const [splashDone, setSplashDone] = useState(false);

  const [cfg, setCfg] = useState<PublicConfig>(DEFAULT_CONFIG);
  const [form, setForm] = useState<FormState>(EMPTY_FORM);
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [photo, setPhoto] = useState<File | null>(null);
  const [photoPreview, setPhotoPreview] = useState<string | null>(null);
  const [errors, setErrors] = useState<
    Partial<Record<keyof FormState | 'payment_screenshot' | 'profile_photo' | 'form', string>>
  >({});
  const [submitting, setSubmitting] = useState(false);
  const [success, setSuccess] = useState<boolean>(false);
  const [copied, setCopied] = useState(false);
  const [confirmPay, setConfirmPay] = useState(false); // "is this the real screenshot?" prompt
  const [payConfirmed, setPayConfirmed] = useState(false);

  const fileInput = useRef<HTMLInputElement>(null);
  const photoInput = useRef<HTMLInputElement>(null);

  // Splash timing: start the fade at 1.9s, unmount once the transition ends.
  useEffect(() => {
    const fade = setTimeout(() => setSplashLeaving(true), 1900);
    const done = setTimeout(() => setSplashDone(true), 2500);
    return () => {
      clearTimeout(fade);
      clearTimeout(done);
    };
  }, []);

  useEffect(() => {
    axios
      .get(`${API}/api/config.php`)
      .then((r) => setCfg({ ...DEFAULT_CONFIG, ...r.data }))
      .catch(() => setCfg(DEFAULT_CONFIG));
  }, []);

  // Revoke the object URL whenever the chosen screenshot changes.
  useEffect(() => {
    if (!file) {
      setPreview(null);
      return;
    }
    const url = URL.createObjectURL(file);
    setPreview(url);
    return () => URL.revokeObjectURL(url);
  }, [file]);

  useEffect(() => {
    if (!photo) {
      setPhotoPreview(null);
      return;
    }
    const url = URL.createObjectURL(photo);
    setPhotoPreview(url);
    return () => URL.revokeObjectURL(url);
  }, [photo]);

  const setField = (key: keyof FormState, value: string) => {
    setForm((f) => ({ ...f, [key]: value }));
    setErrors((e) => ({ ...e, [key]: undefined, form: undefined }));
  };

  const checkImage = (chosen: File, key: 'payment_screenshot' | 'profile_photo') => {
    if (!chosen.type.startsWith('image/')) {
      setErrors((e) => ({ ...e, [key]: 'Please choose an image file' }));
      return false;
    }
    if (chosen.size > cfg.max_upload_mb * 1024 * 1024) {
      setErrors((e) => ({ ...e, [key]: `Image must be under ${cfg.max_upload_mb} MB` }));
      return false;
    }
    return true;
  };

  const pickFile = (chosen: File | null | undefined) => {
    if (!chosen || !checkImage(chosen, 'payment_screenshot')) return;
    setFile(chosen);
    setPayConfirmed(false);
    setConfirmPay(true); // ask the applicant to confirm it is the real screenshot
    setErrors((e) => ({ ...e, payment_screenshot: undefined, form: undefined }));
  };

  const clearPaymentFile = () => {
    setFile(null);
    setPayConfirmed(false);
    setConfirmPay(false);
    if (fileInput.current) fileInput.current.value = '';
  };

  const pickPhoto = (chosen: File | null | undefined) => {
    if (!chosen || !checkImage(chosen, 'profile_photo')) return;
    setPhoto(chosen);
    setErrors((e) => ({ ...e, profile_photo: undefined, form: undefined }));
  };

  const validate = () => {
    const next: typeof errors = {};
    if (!photo) next.profile_photo = 'Profile photo is required';
    if (!form.full_name.trim()) next.full_name = 'Name is required';
    if (!form.phone.trim()) next.phone = 'WhatsApp number is required';
    else if (!/^[0-9+\-\s]{10,20}$/.test(form.phone.trim())) next.phone = 'Enter a valid WhatsApp number';
    if (!form.email.trim()) next.email = 'Mail ID is required';
    else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email.trim())) next.email = 'Enter a valid mail ID';
    if (!form.dob) next.dob = 'Date of birth is required';
    if (!form.address.trim()) next.address = 'Address is required';
    if (!file) next.payment_screenshot = 'Payment screenshot is required';
    else if (!payConfirmed) next.payment_screenshot = 'Please confirm your payment screenshot';
    setErrors(next);
    return Object.keys(next).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (submitting) return;
    if (!validate()) {
      document.querySelector('[data-invalid="true"]')?.scrollIntoView({ behavior: 'smooth', block: 'center' });
      return;
    }

    const payload = new FormData();
    (Object.keys(form) as (keyof FormState)[]).forEach((k) => payload.append(k, form[k].trim()));
    payload.append('profile_photo', photo as File);
    payload.append('payment_screenshot', file as File);

    setSubmitting(true);
    try {
      await axios.post(`${API}/api/register.php`, payload);
      setSuccess(true);
      setForm(EMPTY_FORM);
      setFile(null);
      setPhoto(null);
      if (fileInput.current) fileInput.current.value = '';
      if (photoInput.current) photoInput.current.value = '';
    } catch (err) {
      if (axios.isAxiosError(err) && err.response?.status === 422 && err.response.data?.errors) {
        setErrors(err.response.data.errors);
      } else if (axios.isAxiosError(err) && err.response?.data?.error) {
        setErrors({ form: err.response.data.error });
      } else {
        setErrors({ form: 'Could not reach the server. Please check your connection and try again.' });
      }
    } finally {
      setSubmitting(false);
    }
  };

  const waLink = `https://wa.me/${cfg.contact_whatsapp}?text=${encodeURIComponent(
    `Hello, I would like to know more about ${cfg.event_name}.`,
  )}`;

  const copyUpi = async () => {
    try {
      await navigator.clipboard.writeText('balakumaran10.97@okaxis');
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      /* clipboard unavailable — the id is visible on screen anyway */
    }
  };

  const inputClass = (invalid?: string) =>
    `w-full rounded-xl border px-4 py-3 text-sm text-ink outline-none transition-all duration-200 placeholder:text-muted/70 hover:border-brand/50 focus:-translate-y-0.5 focus:shadow-lg focus:shadow-brand/10 ${
      invalid
        ? 'border-rose-300 bg-rose-50/50 focus:border-rose-400 focus:ring-2 focus:ring-rose-100'
        : 'border-hair bg-white focus:border-brand focus:ring-2 focus:ring-brand/15'
    }`;

  return (
    <>
      {!splashDone && <Splash leaving={splashLeaving} title={cfg.event_name} />}

      <div className="min-h-screen bg-slate-50 pb-28 sm:pb-10">
        {/* ---------------------------------------------------------- top bar */}
        <header className="sticky top-0 z-30 border-b border-hair bg-white/90 backdrop-blur">
          <div className="mx-auto flex max-w-3xl items-center justify-between gap-3 px-4 py-3">
            <div className="flex items-center gap-3">
              <img src={LOGO} alt="JCI" className="h-8 w-auto sm:h-9" />
              <div className="hidden h-8 w-px bg-hair sm:block" />
              <span className="hidden text-sm font-bold text-navy sm:block">{cfg.event_name}</span>
            </div>
            <div className="flex items-center gap-2">
              <a
                href={`tel:${cfg.contact_phone}`}
                className="inline-flex items-center gap-1.5 rounded-full border border-hair bg-white px-3 py-1.5 text-xs font-bold text-navy transition hover:border-brand hover:text-brand"
              >
                <PhoneIcon /> Call
              </a>
              <a
                href={waLink}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-1.5 rounded-full bg-[#25D366] px-3 py-1.5 text-xs font-bold text-white transition hover:bg-[#1eb455]"
              >
                <WhatsAppIcon /> WhatsApp
              </a>
            </div>
          </div>
        </header>

        <main className="mx-auto max-w-3xl px-4 py-6 sm:py-10">
          {/* ------------------------------------------------------------ hero */}
          <section className="animate-fade-up relative overflow-hidden rounded-3xl bg-navy px-6 py-8 text-center shadow-xl shadow-navy/25 sm:px-10 sm:py-10">
            <div className="animate-float-slow pointer-events-none absolute -top-20 -right-16 h-56 w-56 rounded-full bg-brand/25 blur-3xl" />
            <div className="animate-float-slower pointer-events-none absolute -bottom-24 -left-16 h-56 w-56 rounded-full bg-teal/25 blur-3xl" />
            <div className="animate-float-slower pointer-events-none absolute top-1/2 left-1/3 h-40 w-40 rounded-full bg-indigo-500/10 blur-3xl" />

            <div className="relative">
              <div className="animate-bob mx-auto mb-5 inline-flex rounded-2xl bg-white px-5 py-3 shadow-lg shadow-black/20">
                <img src={LOGO} alt="JCI" className="h-10 w-auto sm:h-12" />
              </div>
              <h1 className="text-2xl font-extrabold tracking-tight text-white sm:text-3xl">{cfg.event_name}</h1>
              <p className="mx-auto mt-2 max-w-md text-sm text-white/55">
                Fill in your details, pay the registration fee and upload the payment screenshot. All fields are
                mandatory.
              </p>
              <div className="relative mt-5 inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/10 px-5 py-2 backdrop-blur">
                <span className="relative flex h-2 w-2">
                  <span className="animate-pulse-ring absolute inline-flex h-full w-full rounded-full bg-teal" />
                  <span className="relative inline-flex h-2 w-2 rounded-full bg-teal" />
                </span>
                <span className="text-xs font-bold tracking-wider text-white/70 uppercase">Registration Fee</span>
                <span className="text-sm font-extrabold text-white">{formatMoney(cfg.fee)}</span>
              </div>
            </div>

            <div className="absolute right-0 bottom-0 left-0 flex">
              <div className="h-1.5 flex-[55] bg-brand" />
              <div className="h-1.5 flex-[45] bg-teal" />
            </div>
          </section>

          <form onSubmit={handleSubmit} noValidate className="mt-6 space-y-6">
            {/* ------------------------------------------------- your details */}
            <section className="stagger rounded-3xl border border-hair bg-white p-5 shadow-sm transition-shadow hover:shadow-md sm:p-7" style={{ ['--i' as string]: 1 }}>
              <SectionHeading step="1" title="Your Details" subtitle="All fields are mandatory" />

              {/* Profile photo */}
              <div
                className="mt-6 flex flex-col items-center gap-4 rounded-2xl border border-hair bg-slate-50/70 p-5 sm:flex-row sm:items-center sm:gap-6"
                data-invalid={errors.profile_photo ? 'true' : 'false'}
              >
                <button
                  type="button"
                  onClick={() => photoInput.current?.click()}
                  className={`group relative flex h-28 w-28 shrink-0 items-center justify-center overflow-hidden rounded-full border-2 border-dashed transition ${
                    errors.profile_photo ? 'border-rose-300 bg-rose-50' : 'border-brand/40 bg-brand-soft hover:border-brand'
                  }`}
                >
                  {photoPreview ? (
                    <img src={photoPreview} alt="Profile preview" className="h-full w-full object-cover" />
                  ) : (
                    <span className="flex flex-col items-center text-brand">
                      <svg className="h-7 w-7" fill="none" stroke="currentColor" strokeWidth="1.8" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M12 12a4 4 0 100-8 4 4 0 000 8zM4 20a8 8 0 0116 0" />
                      </svg>
                    </span>
                  )}
                  <span className="absolute inset-x-0 bottom-0 bg-navy/80 py-1 text-[10px] font-bold text-white opacity-0 transition group-hover:opacity-100">
                    {photoPreview ? 'Change' : 'Add'}
                  </span>
                </button>

                <div className="text-center sm:text-left">
                  <p className="text-sm font-extrabold text-navy">
                    Profile Photo <span className="text-rose-500">*</span>
                  </p>
                  <p className="mt-0.5 text-xs text-muted">
                    A clear photo of your face — this is printed on your EPS ID card.
                  </p>
                  <div className="mt-3 flex items-center justify-center gap-3 sm:justify-start">
                    <button
                      type="button"
                      onClick={() => photoInput.current?.click()}
                      className="rounded-xl bg-navy px-4 py-2 text-xs font-bold text-white transition hover:bg-navy-800"
                    >
                      {photo ? 'Change photo' : 'Upload photo'}
                    </button>
                    {photo && (
                      <button
                        type="button"
                        onClick={() => {
                          setPhoto(null);
                          if (photoInput.current) photoInput.current.value = '';
                        }}
                        className="text-xs font-bold text-rose-600 hover:underline"
                      >
                        Remove
                      </button>
                    )}
                  </div>
                  {errors.profile_photo && (
                    <p className="mt-2 text-xs font-semibold text-rose-600">{errors.profile_photo}</p>
                  )}
                </div>

                <input
                  ref={photoInput}
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={(e) => pickPhoto(e.target.files?.[0])}
                />
              </div>

              <div className="mt-5 grid grid-cols-1 gap-5 sm:grid-cols-2">
                {FIELDS.map((f, i) => (
                  <div
                    key={f.key}
                    data-invalid={errors[f.key] ? 'true' : 'false'}
                    style={{ ['--i' as string]: i }}
                    className={`stagger ${f.key === 'full_name' ? 'sm:col-span-2' : ''}`}
                  >
                    <label htmlFor={f.key} className="mb-1.5 block text-xs font-bold tracking-wider text-navy uppercase">
                      {f.label} <span className="text-rose-500">*</span>
                    </label>
                    <input
                      id={f.key}
                      type={f.type}
                      inputMode={f.key === 'phone' ? 'tel' : undefined}
                      autoComplete={
                        ({
                          full_name: 'name',
                          phone: 'tel',
                          email: 'email',
                          dob: 'bday',
                          address: 'street-address',
                        } as const)[f.key]
                      }
                      max={f.type === 'date' ? new Date().toISOString().slice(0, 10) : undefined}
                      placeholder={
                        [ 'Enter your full name', 'WhatsApp number', 'name@example.com', '' ][i]
                      }
                      className={inputClass(errors[f.key])}
                      value={form[f.key]}
                      onChange={(e) => setField(f.key, e.target.value)}
                    />
                    <FieldNote error={errors[f.key]} hint={f.hint} />
                  </div>
                ))}

                <div
                  className="stagger sm:col-span-2"
                  style={{ ['--i' as string]: FIELDS.length }}
                  data-invalid={errors.address ? 'true' : 'false'}
                >
                  <label htmlFor="address" className="mb-1.5 block text-xs font-bold tracking-wider text-navy uppercase">
                    Address <span className="text-rose-500">*</span>
                  </label>
                  <textarea
                    id="address"
                    rows={3}
                    autoComplete="street-address"
                    placeholder="Door no, street, area, city, district, state and pincode"
                    className={`${inputClass(errors.address)} resize-y`}
                    value={form.address}
                    onChange={(e) => setField('address', e.target.value)}
                  />
                  <FieldNote error={errors.address} hint="" />
                </div>
              </div>
            </section>

            {/* -------------------------------------------------- payment step */}
            <section className="stagger rounded-3xl border border-hair bg-white p-5 shadow-sm transition-shadow hover:shadow-md sm:p-7" style={{ ['--i' as string]: 6 }}>
              <SectionHeading
                step="2"
                title="Pay & Upload Screenshot"
                subtitle={`Scan the QR and pay ${formatMoney(cfg.fee)}`}
              />

              <div className="mt-6 grid grid-cols-1 gap-6 md:grid-cols-2">
                {/* QR panel */}
                <div className="group relative overflow-hidden rounded-2xl border border-hair bg-navy shadow-sm transition-shadow hover:shadow-xl hover:shadow-navy/20">
                  <div className="animate-float-slow pointer-events-none absolute -top-10 -right-10 h-32 w-32 rounded-full bg-brand/20 blur-2xl" />
                  <div className="relative mx-auto w-full max-w-[280px] p-4">
                    <div className="overflow-hidden rounded-xl bg-white p-2 shadow-lg transition-transform duration-300 group-hover:scale-[1.02]">
                      <img src={QR} alt="UPI payment QR code" className="mx-auto block w-full" />
                    </div>
                  </div>
                  <div className="relative border-t border-white/10 p-4">
                    <p className="text-[11px] font-bold tracking-wider text-white/40 uppercase">Amount to pay</p>
                    <p className="text-2xl font-extrabold text-white">{formatMoney(cfg.fee)}</p>
                    <button
                      type="button"
                      onClick={copyUpi}
                      className="mt-3 inline-flex w-full items-center justify-center gap-2 rounded-xl border border-white/15 bg-white/5 px-3 py-2 text-xs font-bold text-white transition hover:bg-white/10"
                    >
                      {copied ? '✓ UPI ID copied' : 'Copy UPI ID'}
                    </button>
                  </div>
                </div>

                {/* Upload panel */}
                <div data-invalid={errors.payment_screenshot ? 'true' : 'false'} className="flex flex-col">
                  <label className="mb-1.5 block text-xs font-bold tracking-wider text-navy uppercase">
                    Payment Screenshot <span className="text-rose-500">*</span>
                  </label>

                  <div
                    onDragOver={(e) => e.preventDefault()}
                    onDrop={(e) => {
                      e.preventDefault();
                      pickFile(e.dataTransfer.files?.[0]);
                    }}
                    className={`flex flex-1 flex-col items-center justify-center rounded-2xl border-2 border-dashed p-5 text-center transition ${
                      errors.payment_screenshot ? 'border-rose-300 bg-rose-50/40' : 'border-hair bg-slate-50/70'
                    }`}
                  >
                    {preview ? (
                      <>
                        <img
                          src={preview}
                          alt="Payment screenshot preview"
                          className="max-h-56 w-auto rounded-xl border border-hair object-contain shadow-sm"
                        />
                        <p className="mt-3 max-w-full truncate text-xs font-semibold text-ink">{file?.name}</p>
                        {payConfirmed ? (
                          <p className="mt-1 inline-flex items-center gap-1 text-xs font-bold text-emerald-600">
                            <svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                            </svg>
                            Confirmed
                          </p>
                        ) : (
                          <button
                            type="button"
                            onClick={() => setConfirmPay(true)}
                            className="mt-1 text-xs font-bold text-amber-600 hover:underline"
                          >
                            Tap to confirm this screenshot
                          </button>
                        )}
                        <button
                          type="button"
                          onClick={clearPaymentFile}
                          className="mt-2 text-xs font-bold text-rose-600 hover:underline"
                        >
                          Remove and choose another
                        </button>
                      </>
                    ) : (
                      <>
                        <div className="flex h-12 w-12 items-center justify-center rounded-full bg-brand-soft text-brand">
                          <UploadIcon />
                        </div>
                        <p className="mt-3 text-sm font-bold text-navy">Upload your payment screenshot</p>
                        <p className="mt-1 text-xs text-muted">
                          JPG, PNG, HEIC, WEBP or any image · up to {cfg.max_upload_mb} MB
                        </p>
                        <button
                          type="button"
                          onClick={() => fileInput.current?.click()}
                          className="mt-4 rounded-xl bg-navy px-5 py-2.5 text-xs font-bold text-white transition hover:bg-navy-800"
                        >
                          Choose image
                        </button>
                        <p className="mt-2 text-[11px] text-muted">or drag and drop it here</p>
                      </>
                    )}
                  </div>

                  <input
                    ref={fileInput}
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={(e) => pickFile(e.target.files?.[0])}
                  />
                  <FieldNote error={errors.payment_screenshot} hint="" />
                </div>
              </div>
            </section>

            {/* ------------------------------------------------------- submit */}
            {errors.form && (
              <p className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-semibold text-rose-700">
                {errors.form}
              </p>
            )}

            <button
              type="submit"
              disabled={submitting}
              className="group relative w-full overflow-hidden rounded-2xl bg-navy py-4 text-sm font-bold tracking-wider text-white uppercase shadow-lg shadow-navy/25 transition-all hover:-translate-y-0.5 hover:bg-navy-800 hover:shadow-xl hover:shadow-navy/30 active:translate-y-0 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {/* shine sweep on hover */}
              <span className="pointer-events-none absolute inset-0 -translate-x-full bg-gradient-to-r from-transparent via-white/20 to-transparent transition-transform duration-700 group-hover:translate-x-full" />
              <span className="relative flex items-center justify-center gap-2">
                {submitting ? (
                  <>
                    <Spinner /> Submitting…
                  </>
                ) : (
                  <>Submit Registration</>
                )}
              </span>
              <span className="absolute bottom-0 left-0 h-1 w-[55%] bg-brand" />
              <span className="absolute right-0 bottom-0 h-1 w-[45%] bg-teal" />
            </button>

            {/* ------------------------------------------------------ contact */}
            <section className="rounded-3xl border border-hair bg-white p-5 text-center shadow-sm sm:p-6">
              <p className="text-sm font-bold text-navy">Questions about EPS registration?</p>
              <p className="mt-1 text-xs text-muted">Our team is happy to help you complete your registration.</p>
              <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:justify-center">
                <a
                  href={`tel:${cfg.contact_phone}`}
                  className="inline-flex items-center justify-center gap-2 rounded-xl border border-hair bg-white px-6 py-3 text-sm font-bold text-navy transition hover:border-brand hover:text-brand"
                >
                  <PhoneIcon /> Call Us
                </a>
                <a
                  href={waLink}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center justify-center gap-2 rounded-xl bg-[#25D366] px-6 py-3 text-sm font-bold text-white transition hover:bg-[#1eb455]"
                >
                  <WhatsAppIcon /> Chat on WhatsApp
                </a>
              </div>
            </section>
          </form>

          <div className="mt-8 space-y-1 text-center">
            <p className="text-[11px] text-muted">
              © {new Date().getFullYear()} {cfg.org_name}. All rights reserved.
            </p>
            <a
              href="https://www.inwora.com"
              target="_blank"
              rel="noreferrer"
              className="text-[11px] font-semibold text-muted transition hover:text-brand"
            >
              Developed by <span className="font-bold text-navy">inwora</span>
            </a>
          </div>
        </main>

        {/* ------------------------------------- mobile sticky contact actions */}
        <div className="fixed inset-x-0 bottom-0 z-30 flex gap-3 border-t border-hair bg-white/95 p-3 backdrop-blur sm:hidden">
          <a
            href={`tel:${cfg.contact_phone}`}
            className="flex flex-1 items-center justify-center gap-2 rounded-xl border border-hair py-3 text-sm font-bold text-navy"
          >
            <PhoneIcon /> Call
          </a>
          <a
            href={waLink}
            target="_blank"
            rel="noreferrer"
            className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-[#25D366] py-3 text-sm font-bold text-white"
          >
            <WhatsAppIcon /> WhatsApp
          </a>
        </div>
      </div>

      {/* -------------------------------------- payment screenshot confirmation */}
      {confirmPay && (
        <div className="fixed inset-0 z-100 flex items-center justify-center bg-navy/60 p-4 backdrop-blur-sm">
          <div className="animate-pop-in w-full max-w-sm overflow-hidden rounded-3xl bg-white shadow-2xl">
            <div className="relative bg-navy px-6 pt-7 pb-6 text-center">
              <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-amber-400 text-navy">
                <svg className="h-7 w-7" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v4m0 4h.01M10.3 3.86l-8.06 14A1.5 1.5 0 003.54 20h16.92a1.5 1.5 0 001.3-2.14l-8.06-14a1.5 1.5 0 00-2.6 0z" />
                </svg>
              </div>
              <h3 className="mt-4 text-base font-extrabold text-white">Confirm Your Payment Screenshot</h3>
              <div className="absolute right-0 bottom-0 left-0 flex">
                <div className="h-1.5 flex-[55] bg-brand" />
                <div className="h-1.5 flex-[45] bg-teal" />
              </div>
            </div>

            <div className="p-6">
              {preview && (
                <img
                  src={preview}
                  alt="Payment screenshot preview"
                  className="mx-auto mb-4 max-h-44 w-auto rounded-xl border border-hair object-contain"
                />
              )}
              <p className="text-sm leading-relaxed text-ink">
                Have you uploaded the <span className="font-bold">correct, original</span> payment screenshot?
              </p>
              <p className="mt-2 rounded-xl bg-rose-50 px-3 py-2 text-xs font-semibold text-rose-700">
                A fake or wrong screenshot will not be accepted and you cannot proceed.
              </p>

              <div className="mt-5 flex gap-3">
                <button
                  onClick={clearPaymentFile}
                  className="flex-1 rounded-xl border border-hair py-3 text-xs font-bold text-navy uppercase transition hover:border-rose-300 hover:text-rose-600"
                >
                  No, reupload
                </button>
                <button
                  onClick={() => {
                    setPayConfirmed(true);
                    setConfirmPay(false);
                  }}
                  className="flex-1 rounded-xl bg-emerald-600 py-3 text-xs font-bold text-white uppercase transition hover:bg-emerald-700"
                >
                  Yes, it's original
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ------------------------------------------------------ success modal */}
      {success && (
        <div className="fixed inset-0 z-100 flex items-center justify-center bg-navy/60 p-4 backdrop-blur-sm">
          <div className="animate-pop-in w-full max-w-sm overflow-hidden rounded-3xl bg-white text-center shadow-2xl">
            <div className="relative bg-navy px-6 pt-8 pb-6">
              <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-teal text-white">
                <CheckIcon />
              </div>
              <h3 className="mt-4 text-lg font-extrabold text-white">Registration Submitted</h3>
              <p className="mt-1 text-xs text-white/50">Thank you for registering with {cfg.org_name}</p>
              <div className="absolute right-0 bottom-0 left-0 flex">
                <div className="h-1.5 flex-[55] bg-brand" />
                <div className="h-1.5 flex-[45] bg-teal" />
              </div>
            </div>

            <div className="p-6">
              <div className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3">
                <p className="text-xs font-bold tracking-wider text-amber-700 uppercase">Pending Verification</p>
                <p className="mt-1 text-xs leading-relaxed text-amber-700/80">
                  Your details and payment are received. Once verified, your registration number will be issued and your
                  EPS ID card will be sent to your WhatsApp number.
                </p>
              </div>
              <button
                onClick={() => setSuccess(false)}
                className="mt-5 w-full rounded-xl bg-navy py-3 text-xs font-bold tracking-wider text-white uppercase transition hover:bg-navy-800"
              >
                Done
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

/* --------------------------------------------------------------- fragments */

function SectionHeading({ step, title, subtitle }: { step: string; title: string; subtitle: string }) {
  return (
    <div className="flex items-center gap-3 border-b border-hair pb-4">
      <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-navy text-sm font-extrabold text-white">
        {step}
      </span>
      <div>
        <h2 className="text-base font-extrabold text-navy">{title}</h2>
        <p className="text-xs text-muted">{subtitle}</p>
      </div>
    </div>
  );
}

function FieldNote({ error, hint }: { error?: string; hint: string }) {
  if (error) return <p className="mt-1.5 text-xs font-semibold text-rose-600">{error}</p>;
  if (hint) return <p className="mt-1.5 text-xs text-muted">{hint}</p>;
  return null;
}

function PhoneIcon() {
  return (
    <svg className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M3 5a2 2 0 012-2h2.5a1 1 0 01.97.757l.9 3.6a1 1 0 01-.28.95l-1.6 1.6a14 14 0 006.6 6.6l1.6-1.6a1 1 0 01.95-.28l3.6.9A1 1 0 0121 16.5V19a2 2 0 01-2 2h-1C9.7 21 3 14.3 3 6V5z"
      />
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

function UploadIcon() {
  return (
    <svg className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 16V4m0 0L8 8m4-4l4 4M4 16v2a2 2 0 002 2h12a2 2 0 002-2v-2" />
    </svg>
  );
}

function CheckIcon() {
  return (
    <svg className="h-8 w-8" fill="none" stroke="currentColor" strokeWidth="3" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
    </svg>
  );
}

function Spinner() {
  return (
    <svg className="h-4 w-4 animate-spin" fill="none" viewBox="0 0 24 24">
      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z" />
    </svg>
  );
}
