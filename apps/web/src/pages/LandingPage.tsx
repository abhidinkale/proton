import { Link, useNavigate } from 'react-router-dom';
import { ArrowRight, ClipboardCheck, FileText, History, ShieldCheck } from 'lucide-react';

const workflow = [
  {
    title: 'Prepare',
    description: 'Bring relevant patient history and recent changes into view before the visit.',
    icon: History,
  },
  {
    title: 'Document',
    description: 'Turn consultation dialogue into a structured draft for the care team.',
    icon: FileText,
  },
  {
    title: 'Review',
    description: 'Check source details, verify safety rules, and approve changes explicitly.',
    icon: ClipboardCheck,
  },
];

export default function LandingPage() {
  const navigate = useNavigate();

  return (
    <main className="min-h-screen bg-[var(--color-surface-raised)] text-[var(--color-text-primary)]">
      <header className="border-b border-[var(--color-border-default)] bg-[var(--color-surface)]">
        <div className="mx-auto flex min-h-16 max-w-6xl items-center justify-between gap-4 px-4 sm:px-6">
          <Link to="/welcome" className="text-lg font-semibold tracking-tight" aria-label="Proton home">
            proton
          </Link>
          <Link
            to="/login"
            className="inline-flex min-h-10 items-center gap-2 rounded-lg bg-[var(--color-text-primary)] px-4 text-sm font-medium text-[var(--color-text-inverse)] transition-colors hover:opacity-85"
          >
            Open workspace
            <ArrowRight size={15} />
          </Link>
        </div>
      </header>

      <div className="mx-auto max-w-6xl px-4 sm:px-6">
        <section className="grid gap-8 border-b border-[var(--color-border-default)] py-12 sm:py-16 lg:grid-cols-[minmax(0,1.5fr)_minmax(260px,0.8fr)] lg:items-center lg:gap-16 lg:py-20">
          <div>
            <p className="text-sm font-medium text-[var(--color-text-secondary)]">A workspace for clinical care</p>
            <h1 className="mt-4 max-w-3xl text-4xl font-semibold leading-tight tracking-tight sm:text-5xl">
              Clinical context, prepared before the visit.
            </h1>
            <p className="mt-5 max-w-2xl text-base leading-7 text-[var(--color-text-secondary)]">
              Proton brings patient history, consultation documentation, and review tasks into one physician workspace.
              Drafts stay reviewable, and clinical decisions remain with the care team.
            </p>
            <div className="mt-8 flex flex-wrap items-center gap-3">
              <button
                type="button"
                onClick={() => navigate('/login')}
                className="inline-flex min-h-11 items-center gap-2 rounded-lg bg-[var(--color-text-primary)] px-5 text-sm font-medium text-[var(--color-text-inverse)] transition-colors hover:opacity-85"
              >
                Sign in
                <ArrowRight size={15} />
              </button>
              <a
                href="#workflow"
                className="inline-flex min-h-11 items-center rounded-lg border border-[var(--color-border-strong)] px-5 text-sm font-medium text-[var(--color-text-primary)] transition-colors hover:bg-[var(--color-surface-sunken)]"
              >
                How it works
              </a>
            </div>
          </div>

          <aside className="rounded-xl border border-[var(--color-border-default)] bg-[var(--color-surface)] p-5 sm:p-6">
            <div className="flex items-center gap-3">
              <ShieldCheck size={19} strokeWidth={1.8} />
              <h2 className="text-sm font-semibold">Clinician-led by design</h2>
            </div>
            <p className="mt-4 text-sm leading-6 text-[var(--color-text-secondary)]">
              AI-generated content is a draft. A clinician reviews and approves it before it becomes part of the record.
            </p>
            <p className="mt-4 border-t border-[var(--color-border-default)] pt-4 text-xs leading-5 text-[var(--color-text-tertiary)]">
              Evaluation environment uses synthetic records. Do not enter real patient information.
            </p>
          </aside>
        </section>

        <section id="workflow" className="py-12 sm:py-16">
          <div className="max-w-2xl">
            <h2 className="text-2xl font-semibold tracking-tight">One clear workflow</h2>
            <p className="mt-2 text-sm leading-6 text-[var(--color-text-secondary)]">
              Move from patient context to reviewed documentation without hiding the steps that need clinical judgment.
            </p>
          </div>
          <ol className="mt-8 grid gap-4 md:grid-cols-3">
            {workflow.map(({ title, description, icon: Icon }, index) => (
              <li key={title} className="rounded-xl border border-[var(--color-border-default)] bg-[var(--color-surface)] p-5">
                <div className="flex items-center gap-3">
                  <span className="text-xs font-medium tabular-nums text-[var(--color-text-tertiary)]">0{index + 1}</span>
                  <Icon size={17} strokeWidth={1.8} />
                  <h3 className="text-sm font-semibold">{title}</h3>
                </div>
                <p className="mt-4 text-sm leading-6 text-[var(--color-text-secondary)]">{description}</p>
              </li>
            ))}
          </ol>
        </section>
      </div>
    </main>
  );
}
