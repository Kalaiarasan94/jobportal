import { LOGO } from './config';

/**
 * Branded opening screen. Rendered over the page and faded out by App once
 * the timer elapses, so the form behind it is already mounted and ready.
 */
export default function Splash({ leaving, title }: { leaving: boolean; title: string }) {
  return (
    <div
      className={`fixed inset-0 z-100 flex flex-col items-center justify-center overflow-hidden bg-navy transition-all duration-500 ${
        leaving ? 'pointer-events-none scale-105 opacity-0' : 'opacity-100'
      }`}
    >
      {/* Ambient shield-coloured glow */}
      <div className="pointer-events-none absolute -top-32 -left-24 h-96 w-96 rounded-full bg-brand/20 blur-3xl" />
      <div className="pointer-events-none absolute -right-24 -bottom-32 h-96 w-96 rounded-full bg-teal/20 blur-3xl" />

      <div className="relative flex flex-col items-center px-6">
        <div className="animate-splash-pop rounded-3xl bg-white px-8 py-6 shadow-2xl shadow-black/40">
          <img src={LOGO} alt="JCI" className="h-16 w-auto sm:h-20" />
        </div>

        <h1
          className="animate-splash-rise mt-8 text-center text-2xl font-extrabold tracking-tight text-white sm:text-3xl"
          style={{ animationDelay: '0.25s' }}
        >
          {title}
        </h1>

        <p
          className="animate-splash-rise mt-2 text-center text-xs tracking-[0.3em] text-white/45 uppercase"
          style={{ animationDelay: '0.4s' }}
        >
          Official Registration Portal
        </p>

        {/* Loading sweep */}
        <div className="mt-10 h-[3px] w-44 overflow-hidden rounded-full bg-white/10">
          <div className="animate-sweep h-full w-1/3 rounded-full bg-gradient-to-r from-brand to-teal" />
        </div>
      </div>

      <div className="absolute right-0 bottom-0 left-0 flex">
        <div className="h-1.5 flex-[55] bg-brand" />
        <div className="h-1.5 flex-[45] bg-teal" />
      </div>
    </div>
  );
}
