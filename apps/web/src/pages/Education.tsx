import { useEffect, useMemo, useState } from 'react';
import {
  Play,
  Plus,
  Check,
  BookOpen,
  ArrowUpRight,
  CheckCircle2,
  X,
  Award,
  Download,
  Share2,
  LoaderCircle,
  AlertTriangle,
  Search,
  Clock,
  Sparkles
} from 'lucide-react';
import Layout from '../components/Layout';
import { clinicApi, type EducationProgress } from '../lib/clinicApi';
import { authService } from '../services/auth';

type SpecialtyVariant = 'rose' | 'canary' | 'olive' | 'periwinkle';

interface ClinicalCourse {
  id: string;
  title: string;
  specialty: string;
  specialtyVariant: SpecialtyVariant;
  description: string;
  duration: string;
  durationMinutes: number;
  date: string;
  cmeCredits?: string;
  creditValue?: number;
  speaker?: string;
  fullContent: string;
}

const COURSES: ClinicalCourse[] = [
  {
    id: 'art-asthma',
    title: 'Moderate to Severe Asthma: Gaining Control',
    specialty: 'Allergy & Immunology',
    specialtyVariant: 'rose',
    description: 'Phenotype differentiation, biologic selection and GINA 2026 step-up therapy.',
    duration: '60 min',
    durationMinutes: 60,
    date: 'May 2026',
    cmeCredits: '1.0 AMA PRA Category 1 Credit™',
    creditValue: 1,
    speaker: 'Dr. Olwyn Westwood, MD',
    fullContent:
      'Optimal management of moderate to severe asthma requires phenotype differentiation (Type 2 high vs Type 2 low). High-dose ICS/LABA combined with biologic agents (anti-IL-4R, anti-IL-5, anti-TSLP) dramatically reduce exacerbation frequency. When blood eosinophils exceed 300 cells/µL, anti-IL-5 monoclonal antibody therapy reduces emergency department visits by 58% compared with high-dose oral corticosteroids alone. Patient adherence monitoring via digital inhalers provides actionable telemetry, and every step-up should be paired with inhaler technique review and trigger avoidance.'
  },
  {
    id: 'art-epilepsy',
    title: 'Complex Cases in Developmental & Epileptic Encephalopathies',
    specialty: 'Neurology',
    specialtyVariant: 'canary',
    description: 'Evidence-based refractory epilepsy protocols and genetic testing indications.',
    duration: '45 min',
    durationMinutes: 45,
    date: 'May 2026',
    cmeCredits: '0.75 AMA PRA Category 1 Credit™',
    creditValue: 0.75,
    speaker: 'Dr. Nathan Vance, MD, FAAN',
    fullContent:
      'Early trio whole-exome sequencing identifies channelopathies (SCN1A, KCNQ2, STXBP1) where sodium channel blockers may be either curative or contraindicated. Sodium channel blockers exacerbate Dravet syndrome while benefiting SCN2A/SCN8A gain-of-function variants. Genetic results should be reviewed with a neurologist before the next antiseizure medication change, and families should receive a written seizure action plan.'
  },
  {
    id: 'art-sma',
    title: 'Best Practices in Spinal Muscular Atrophy',
    specialty: 'Neurology',
    specialtyVariant: 'canary',
    description: 'Personalized transition of care from pediatric to adult neurology.',
    duration: '30 min',
    durationMinutes: 30,
    date: 'May 2026',
    cmeCredits: '0.5 AMA PRA Category 1 Credit™',
    creditValue: 0.5,
    speaker: 'Dr. Elena Rostova, MD',
    fullContent:
      'Transition of care from pediatric to adult neurology for SMA requires multidisciplinary pulmonary, orthopedic, and physical medicine coordination. SMN-modifying therapies continue to show sustained functional stabilization in adult patients. A structured transition checklist should cover respiratory baseline, scoliosis surveillance, nutrition, equipment needs, and emergency contact ownership.'
  },
  {
    id: 'art-ckd',
    title: 'Chronic Kidney Disease Co-Management',
    specialty: 'Primary Care',
    specialtyVariant: 'periwinkle',
    description: 'The four pillars of guideline-directed therapy and nephrology referral thresholds.',
    duration: '120 min',
    durationMinutes: 120,
    date: 'May 2026',
    cmeCredits: '2.0 AMA PRA Category 1 Credit™',
    creditValue: 2,
    speaker: 'Dr. Marcus Vance, MD, FASN',
    fullContent:
      'Four pillars of guideline-directed medical therapy for CKD Stage 3: ACEi/ARB titration, SGLT2 inhibitors (dapagliflozin/empagliflozin), non-steroidal mineralocorticoid receptor antagonists (finerenone), and GLP-1 receptor agonists. Nephrology referral threshold is eGFR < 30 mL/min or uACR > 300 mg/g. Recheck potassium and creatinine 2–4 weeks after each RAAS or MRA change.'
  },
  {
    id: 'art-telemedicine',
    title: 'Setting Up Telemedicine in Outpatient Practice',
    specialty: 'Clinical Operations',
    specialtyVariant: 'canary',
    description: 'Technical and clinical protocols for hybrid clinic schedules.',
    duration: '20 min',
    durationMinutes: 20,
    date: 'May 2026',
    cmeCredits: '0.5 AMA PRA Category 1 Credit™',
    creditValue: 0.5,
    speaker: 'Dr. Sarah Connor, MD',
    fullContent:
      'Telemedicine workflows require dedicated high-definition audio/video pipelines, ambient clinical transcription, and pre-visit digital questionnaires. Patient rooming time drops by 40% when patients complete check-in on mobile. Define which complaints are safe for virtual care, how to escalate to in-person evaluation, and how consent is documented in the chart.'
  },
  {
    id: 'art-ehr',
    title: 'Using EHRs to Improve Clinical Decision Support',
    specialty: 'Medical Informatics',
    specialtyVariant: 'olive',
    description: 'FHIR R4 APIs and automated medication safety checks.',
    duration: '25 min',
    durationMinutes: 25,
    date: 'May 2026',
    cmeCredits: '0.5 AMA PRA Category 1 Credit™',
    creditValue: 0.5,
    speaker: 'Dr. Aris Thorne, MD',
    fullContent:
      'Integrating algorithmic contraindication warnings directly into the physician workflow reduces adverse drug events by 62%. Hard-stop safety gates prevent high-severity allergen overlaps while allowing clinical overrides with rationale. Every override should be stored with the clinician identity, timestamp, and a structured reason so the safety program can review patterns.'
  },
  {
    id: 'art-headache',
    title: 'Headache Etiology & Differential Diagnosis in Clinic',
    specialty: 'Neurology',
    specialtyVariant: 'rose',
    description: 'Red flags, secondary headache syndromes, and imaging thresholds.',
    duration: '35 min',
    durationMinutes: 35,
    date: 'May 2026',
    cmeCredits: '0.75 AMA PRA Category 1 Credit™',
    creditValue: 0.75,
    speaker: 'Dr. Priya Patel, MD',
    fullContent:
      'SNOOP4 criteria define high-risk secondary headache red flags: Systemic symptoms, Neurologic deficit, Onset sudden (thunderclap), Older age (>50), Positional or Papilledema. Migraine with visual aura requires avoidance of triptans in ischemic disease. New focal deficits, fever with neck stiffness, or papilledema warrant urgent imaging rather than outpatient triage.'
  }
];

interface FieldUpdate {
  id: string;
  title: string;
  date: string;
  guideline: string;
  content: string;
}

const FIELD_UPDATES: FieldUpdate[] = [
  {
    id: 'update-adhd',
    title: 'Long-Term ADHD Medication Use and Cardiovascular Risk',
    date: '22 April 2026',
    guideline: 'ACC / AHA Joint Advisory',
    content:
      'Prospective trials in 2026 demonstrated that cardiovascular risk is attenuated with monitored titration and baseline ECG screening. Heart rate and blood pressure should be checked at baseline, after each dose change, and at least every 3 months during maintenance. Patients with known structural heart disease or uncontrolled hypertension need cardiology input before stimulant initiation.'
  },
  {
    id: 'update-pain',
    title: 'Chronic Pain in the US: Multimodal Guideline Update',
    date: '22 April 2026',
    guideline: 'CDC / HHS Interagency Taskforce',
    content:
      'Non-pharmacologic and interventional pathways prioritize physical therapy, cognitive behavioral pain reprocessing, and topical agents over systemic opioids. Early physical rehabilitation lowers 1-year disability by 34%. Opioid initiation, when it is appropriate, should be paired with a written function-based agreement, naloxone co-prescribing, and a scheduled reassessment interval.'
  },
  {
    id: 'update-renal',
    title: 'Renal-Protective Glycemic Algorithms in Multi-Morbid Primary Care',
    date: '10 March 2026',
    guideline: 'KDIGO / ADA Consensus Panel',
    content:
      'For patients with type 2 diabetes and CKD, SGLT2 inhibitor therapy should be continued down to an eGFR of 20 mL/min/1.73 m², with expected initial dip in eGFR that is not a reason to stop. GLP-1 receptor agonists are preferred when weight reduction or atherosclerotic risk is the dominant concern. Avoid combining an SGLT2 inhibitor with a non-steroidal MRA without checking potassium and renal function within 4 weeks.'
  }
];

function downloadTextFile(name: string, content: string) {
  const blob = new Blob([content], { type: 'text/plain;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = name;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

function specialtyBadge(variant: SpecialtyVariant): string {
  switch (variant) {
    case 'rose':
      return 'bg-[#FCE7F3] text-[#9D174D]';
    case 'canary':
      return 'bg-[#FEF08A] text-[#854D0E]';
    case 'olive':
      return 'bg-[#DCFCE7] text-[#166534]';
    default:
      return 'bg-[#E0E7FF] text-[#1E40AF]';
  }
}

export default function Education() {
  const currentUser = authService.getCurrentUser();
  const firstName = (currentUser?.displayName || 'Doctor').replace(/^Dr\.?\s*/i, '').split(/\s+/)[0];

  const [progress, setProgress] = useState<EducationProgress>({ bookmarks: [], completed: [], claimed: [] });
  const [progressState, setProgressState] = useState<'loading' | 'ready' | 'error'>('loading');
  const [search, setSearch] = useState('');
  const [specialty, setSpecialty] = useState('All');
  const [savedOnly, setSavedOnly] = useState(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [selectedCourse, setSelectedCourse] = useState<ClinicalCourse | null>(null);
  const [selectedUpdate, setSelectedUpdate] = useState<FieldUpdate | null>(null);
  const [pendingActionId, setPendingActionId] = useState<string | null>(null);

  const showToast = (message: string) => {
    setToastMessage(message);
    window.setTimeout(() => setToastMessage(null), 3400);
  };

  useEffect(() => {
    clinicApi
      .getEducationProgress()
      .then(({ progress: stored }) => {
        setProgress(stored);
        setProgressState('ready');
      })
      .catch(() => setProgressState('error'));
  }, []);

  const persist = async (next: EducationProgress, actionId: string) => {
    const previous = progress;
    setProgress(next);
    setPendingActionId(actionId);
    try {
      const { progress: saved } = await clinicApi.updateEducationProgress(next);
      setProgress(saved);
      return true;
    } catch (error) {
      setProgress(previous);
      showToast((error as Error).message || 'Your learning progress could not be saved.');
      return false;
    } finally {
      setPendingActionId(null);
    }
  };

  const toggleBookmark = async (course: ClinicalCourse) => {
    const isSaved = progress.bookmarks.includes(course.id);
    const next = {
      ...progress,
      bookmarks: isSaved
        ? progress.bookmarks.filter((id) => id !== course.id)
        : [...progress.bookmarks, course.id]
    };
    const saved = await persist(next, `save-${course.id}`);
    if (saved) {
      showToast(isSaved ? `Removed "${course.title}" from saved resources.` : `Saved "${course.title}" to your resources.`);
    }
  };

  const markComplete = async (course: ClinicalCourse) => {
    if (progress.completed.includes(course.id)) return;
    const next = { ...progress, completed: [...progress.completed, course.id] };
    const saved = await persist(next, `complete-${course.id}`);
    if (saved) showToast(`Marked "${course.title}" as completed.`);
  };

  const claimCredit = async (course: ClinicalCourse) => {
    const alreadyClaimed = progress.claimed.includes(course.id);
    if (alreadyClaimed) {
      downloadCertificate(course);
      return;
    }
    const next = {
      ...progress,
      completed: progress.completed.includes(course.id)
        ? progress.completed
        : [...progress.completed, course.id],
      claimed: [...progress.claimed, course.id]
    };
    const saved = await persist(next, `claim-${course.id}`);
    if (!saved) return;

    downloadCertificate(course);
    showToast(`Credit claimed for "${course.title}". Certificate downloaded.`);
  };

  const downloadCertificate = (course: ClinicalCourse) => {
    const issued = new Date();
    const text = [
      'PROTON CLINICAL LEARNING — CERTIFICATE OF COMPLETION',
      '',
      `Clinician: ${currentUser?.displayName || 'Attending physician'}`,
      `NPI: ${currentUser?.npi || 'Not recorded'}`,
      `Organization: ${currentUser?.organizationId || 'Not recorded'}`,
      '',
      `Course: ${course.title}`,
      `Specialty: ${course.specialty}`,
      `Faculty: ${course.speaker || 'Clinical faculty'}`,
      `Duration: ${course.duration}`,
      `Credit: ${course.cmeCredits || 'No CME credit offered'}`,
      '',
      `Date issued: ${issued.toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}`,
      `Referenced standard: ${course.fullContent.slice(0, 120)}…`,
      '',
      'This certificate records completion inside the Proton training workspace.',
      'Retain it with your continuing education records.'
    ].join('\n');
    downloadTextFile(`${course.id}-certificate.txt`, text);
  };

  const exportCourse = (course: ClinicalCourse) => {
    downloadTextFile(
      `${course.id}-notes.txt`,
      [
        `${course.title}`,
        `${course.specialty} · ${course.speaker || 'Clinical faculty'} · ${course.duration}`,
        course.cmeCredits ? `Credit: ${course.cmeCredits}` : '',
        '',
        course.fullContent
      ]
        .filter(Boolean)
        .join('\n')
    );
    showToast(`Course notes exported for "${course.title}".`);
  };

  const shareCourse = async (course: ClinicalCourse) => {
    const url = `${window.location.origin}/education#${course.id}`;
    try {
      await navigator.clipboard.writeText(url);
      showToast(`Link to "${course.title}" copied.`);
    } catch {
      showToast('Clipboard access is blocked by the browser. Copy the address from the URL bar instead.');
    }
  };

  const specialties = useMemo(
    () => ['All', ...Array.from(new Set(COURSES.map((course) => course.specialty)))],
    []
  );

  const filteredCourses = useMemo(() => {
    const query = search.trim().toLowerCase();
    return COURSES.filter((course) => {
      if (specialty !== 'All' && course.specialty !== specialty) return false;
      if (savedOnly && !progress.bookmarks.includes(course.id)) return false;
      if (!query) return true;
      return [course.title, course.description, course.specialty, course.speaker || '']
        .join(' ')
        .toLowerCase()
        .includes(query);
    });
  }, [search, specialty, savedOnly, progress.bookmarks]);

  const savedCourses = COURSES.filter((course) => progress.bookmarks.includes(course.id));
  const completedCount = progress.completed.length;
  const claimedCredits = COURSES.filter((course) => progress.claimed.includes(course.id)).reduce(
    (sum, course) => sum + (course.creditValue || 0),
    0
  );
  const featured = COURSES[0];

  return (
    <Layout>
      <div className="space-y-6 animate-in fade-in pb-12 relative">
        {toastMessage && (
          <div className="fixed bottom-6 right-6 z-50 flex items-center gap-2.5 px-4 py-2.5 bg-[#151719] text-white rounded-2xl shadow-xl text-xs font-semibold animate-in fade-in slide-in-from-bottom-2">
            <CheckCircle2 size={16} className="text-emerald-400 shrink-0" />
            <span>{toastMessage}</span>
          </div>
        )}

        <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-[#151719]">
              Keep learning, Dr. {firstName}
            </h1>
            <p className="text-xs sm:text-sm text-[#575D65] mt-0.5">
              A working clinical library. Bookmarks, completions and claimed credits are saved to your account.
            </p>
          </div>

          <div className="flex w-full flex-col gap-2 sm:flex-row lg:w-auto">
            <div className="relative flex-1 lg:w-72">
              <Search size={14} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[#88909A]" />
              <input
                type="search"
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Search courses, faculty, topics…"
                className="w-full rounded-full border border-[#E8E5DC] bg-white py-2 pl-9 pr-3 text-xs text-[#151719] shadow-xs placeholder:text-[#9AA0A6] focus:border-[#151719] focus:outline-none"
              />
            </div>
            <button
              type="button"
              onClick={() => setSavedOnly((current) => !current)}
              className={`inline-flex items-center justify-center gap-1.5 rounded-full border px-3.5 py-2 text-xs font-semibold transition-colors cursor-pointer ${
                savedOnly
                  ? 'border-[#151719] bg-[#151719] text-white'
                  : 'border-[#E8E5DC] bg-white text-[#575D65] hover:text-[#151719]'
              }`}
            >
              <BookOpen size={13} />
              Saved only
            </button>
          </div>
        </div>

        {progressState === 'error' && (
          <div className="flex items-start gap-2 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-xs text-amber-900">
            <AlertTriangle size={15} className="mt-0.5 shrink-0" />
            <div>
              <p className="font-semibold">Learning progress is read-only right now</p>
              <p className="mt-0.5 opacity-80">
                The clinic API is unreachable. You can still read the library, but bookmarks will not persist.
              </p>
            </div>
          </div>
        )}

        {/* Progress strip */}
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          <div className="rounded-2xl border border-[#E8E5DC] bg-white p-4">
            <div className="flex items-center justify-between">
              <span className="proton-micro-label text-[#88909A]">Completed</span>
              <CheckCircle2 size={14} className="text-emerald-600" />
            </div>
            <div className="mt-1 font-mono text-2xl font-black text-[#151719]">
              {progressState === 'loading' ? '—' : `${completedCount}/${COURSES.length}`}
            </div>
            <div className="mt-1 text-[10.5px] text-[#6E767E]">Core clinical courses</div>
          </div>
          <div className="rounded-2xl border border-[#E8E5DC] bg-white p-4">
            <div className="flex items-center justify-between">
              <span className="proton-micro-label text-[#88909A]">Claimed credit</span>
              <Award size={14} className="text-amber-600" />
            </div>
            <div className="mt-1 font-mono text-2xl font-black text-[#151719]">
              {progressState === 'loading' ? '—' : `${claimedCredits.toFixed(2)}`}
            </div>
            <div className="mt-1 text-[10.5px] text-[#6E767E]">AMA PRA Category 1 Credits™</div>
          </div>
          <div className="rounded-2xl border border-[#E8E5DC] bg-white p-4">
            <div className="flex items-center justify-between">
              <span className="proton-micro-label text-[#88909A]">Saved</span>
              <BookOpen size={14} className="text-[#1E40AF]" />
            </div>
            <div className="mt-1 font-mono text-2xl font-black text-[#151719]">
              {progressState === 'loading' ? '—' : savedCourses.length}
            </div>
            <div className="mt-1 text-[10.5px] text-[#6E767E]">Resources in your library</div>
          </div>
        </div>

        <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
          <div className="space-y-6 lg:col-span-8">
            {/* Featured course */}
            <div className="rounded-3xl border border-[#FBCFE8] bg-[#FCE7F3] p-5 sm:p-6 shadow-[0_2px_12px_rgba(0,0,0,0.02)]">
              <div className="flex flex-col items-center gap-6 md:flex-row">
                <div
                  onClick={() => setSelectedCourse(featured)}
                  className="group relative flex h-44 w-full shrink-0 cursor-pointer items-center justify-center overflow-hidden rounded-2xl bg-zinc-900 md:w-64"
                >
                  <img
                    src="https://images.unsplash.com/photo-1579684385127-1ef15d508118?auto=format&fit=crop&w=600&q=80"
                    alt="Clinical learning session"
                    className="h-full w-full object-cover opacity-80 transition-transform group-hover:scale-105"
                  />
                  <span className="absolute left-3 top-3 rounded-full bg-black/70 px-2.5 py-1 text-[10px] font-bold text-white">
                    On-demand · {featured.duration}
                  </span>
                  <span className="flex h-12 w-12 items-center justify-center rounded-full bg-white/90 text-[#9D174D] shadow-lg transition-transform group-hover:scale-110">
                    <Play className="ml-0.5 h-5 w-5 fill-current" />
                  </span>
                </div>

                <div className="min-w-0 flex-1 space-y-3">
                  <span className="inline-block rounded-full border border-[#FBCFE8] bg-white/80 px-3 py-1 text-[11px] font-bold text-[#9D174D]">
                    {featured.specialty}
                  </span>
                  <h3
                    onClick={() => setSelectedCourse(featured)}
                    className="cursor-pointer text-base font-bold leading-snug text-[#151719] transition-colors hover:text-[#9D174D] sm:text-lg"
                  >
                    {featured.title}
                  </h3>
                  <p className="line-clamp-2 text-xs text-[#575D65]">{featured.description}</p>
                  <div className="flex flex-wrap items-center gap-4 border-t border-[#FBCFE8]/60 pt-2 text-xs text-[#575D65]">
                    <span className="font-semibold text-[#151719]">{featured.speaker}</span>
                    <span>{featured.cmeCredits}</span>
                    {progress.completed.includes(featured.id) && (
                      <span className="inline-flex items-center gap-1 font-semibold text-emerald-700">
                        <CheckCircle2 size={12} /> Completed
                      </span>
                    )}
                  </div>
                </div>
              </div>
            </div>

            {/* Filters */}
            <div className="flex flex-wrap items-center gap-2">
              {specialties.map((entry) => (
                <button
                  key={entry}
                  type="button"
                  onClick={() => setSpecialty(entry)}
                  className={`rounded-full px-3 py-1 text-[11px] font-semibold transition-colors cursor-pointer ${
                    specialty === entry
                      ? 'bg-[#151619] text-white shadow-xs'
                      : 'border border-[#E8E5DC] bg-white text-[#575D65] hover:text-[#151719]'
                  }`}
                >
                  {entry}
                </button>
              ))}
            </div>

            {/* Course grid */}
            <div>
              <div className="mb-3 flex items-center justify-between">
                <h2 className="text-sm font-bold uppercase tracking-wider text-[#151719]">Course library</h2>
                <span className="font-mono text-[10.5px] text-[#88909A]">{filteredCourses.length} results</span>
              </div>

              {filteredCourses.length === 0 ? (
                <div className="flex flex-col items-center justify-center gap-2 rounded-2xl border border-[#E8E5DC] bg-white py-14 text-center">
                  <Search size={20} className="text-[#9AA0A6]" />
                  <p className="text-sm font-semibold text-[#151719]">No courses match that search</p>
                  <p className="text-[11.5px] text-[#6E767E]">Try a different term or clear the specialty filter.</p>
                  <button
                    type="button"
                    onClick={() => { setSearch(''); setSpecialty('All'); setSavedOnly(false); }}
                    className="mt-1 rounded-full bg-[#151719] px-3.5 py-1.5 text-[11px] font-semibold text-white cursor-pointer"
                  >
                    Reset filters
                  </button>
                </div>
              ) : (
                <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                  {filteredCourses.map((course) => {
                    const isSaved = progress.bookmarks.includes(course.id);
                    const isCompleted = progress.completed.includes(course.id);
                    return (
                      <div
                        key={course.id}
                        onClick={() => setSelectedCourse(course)}
                        className="group cursor-pointer space-y-2 rounded-2xl border border-[#E8E5DC] bg-white p-4 transition-all hover:shadow-md"
                      >
                        <div className="flex items-start justify-between gap-2">
                          <span className={`inline-block rounded-full px-2.5 py-0.5 text-[10px] font-bold ${specialtyBadge(course.specialtyVariant)}`}>
                            {course.specialty}
                          </span>
                          {isCompleted && (
                            <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2 py-0.5 text-[9.5px] font-semibold text-emerald-700">
                              <Check size={10} /> Done
                            </span>
                          )}
                        </div>
                        <h4 className="line-clamp-2 text-xs font-bold leading-snug text-[#151719] transition-colors group-hover:text-[#1E40AF]">
                          {course.title}
                        </h4>
                        <p className="line-clamp-2 text-[11px] text-[#575D65]">{course.description}</p>
                        <div className="flex items-center justify-between border-t border-[#F0ECE1] pt-2">
                          <span className="inline-flex items-center gap-1 text-[10px] font-mono text-[#88909A]">
                            <Clock size={10} /> {course.duration}
                          </span>
                          <button
                            type="button"
                            onClick={(event) => {
                              event.stopPropagation();
                              void toggleBookmark(course);
                            }}
                            disabled={pendingActionId === `save-${course.id}`}
                            className={`rounded-full p-1.5 transition-colors cursor-pointer disabled:opacity-50 ${
                              isSaved
                                ? 'bg-[#151619] text-white'
                                : 'bg-[#F9F8F5] text-[#575D65] hover:bg-[#FCE7F3] hover:text-[#9D174D]'
                            }`}
                            title={isSaved ? 'Remove from saved' : 'Save to your library'}
                          >
                            {pendingActionId === `save-${course.id}`
                              ? <LoaderCircle size={13} className="animate-spin" />
                              : isSaved
                                ? <Check size={13} />
                                : <Plus size={13} />}
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>

          {/* Right rail */}
          <div className="space-y-6 lg:col-span-4">
            <div className="space-y-3">
              <h3 className="text-xs font-bold uppercase tracking-wider text-[#151719]">Saved resources</h3>
              {savedCourses.length === 0 ? (
                <div className="rounded-2xl border border-dashed border-[#E8E5DC] bg-white p-5 text-center">
                  <BookOpen size={18} className="mx-auto text-[#9AA0A6]" />
                  <p className="mt-2 text-[11.5px] leading-relaxed text-[#6E767E]">
                    Nothing saved yet. Use the <Plus size={11} className="inline" /> button on any course to keep it here.
                  </p>
                </div>
              ) : (
                <div className="divide-y divide-[#F0ECE1] rounded-2xl border border-[#E8E5DC] bg-white">
                  {savedCourses.map((course) => (
                    <div key={course.id} className="flex items-center justify-between gap-3 p-3">
                      <button
                        type="button"
                        onClick={() => setSelectedCourse(course)}
                        className="min-w-0 text-left cursor-pointer"
                      >
                        <p className="truncate text-xs font-semibold text-[#151719]">{course.title}</p>
                        <p className="text-[10px] text-[#88909A]">{course.specialty} · {course.duration}</p>
                      </button>
                      <button
                        type="button"
                        onClick={() => { void toggleBookmark(course); }}
                        className="shrink-0 rounded-full p-1 text-[#88909A] hover:text-[#9D174D] cursor-pointer"
                        title="Remove bookmark"
                      >
                        <X size={13} />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="space-y-3">
              <h3 className="text-xs font-bold uppercase tracking-wider text-[#151719]">Guideline updates</h3>
              <div className="space-y-3">
                {FIELD_UPDATES.map((update, index) => (
                  <div
                    key={update.id}
                    onClick={() => setSelectedUpdate(update)}
                    className={`cursor-pointer space-y-2 rounded-2xl border p-4 shadow-xs transition-shadow hover:shadow-md ${
                      index === 0
                        ? 'border-[#FDE047] bg-[#FEF08A] text-[#854D0E]'
                        : index === 1
                          ? 'border-[#C7D2FE] bg-[#E0E7FF] text-[#1E40AF]'
                          : 'border-[#E8E5DC] bg-white text-[#151719]'
                    }`}
                  >
                    <div className="flex items-center gap-2">
                      <div className="flex h-6 w-6 items-center justify-center rounded-lg bg-black/10">
                        <BookOpen size={13} />
                      </div>
                      <h4 className="text-xs font-bold leading-tight">{update.title}</h4>
                    </div>
                    <div className="font-mono text-[10px] opacity-80">{update.date} · {update.guideline}</div>
                    <p className="line-clamp-2 text-[11px] leading-relaxed opacity-90">{update.content}</p>
                    <div className="flex items-center justify-between border-t border-current/20 pt-2">
                      <span className="inline-flex items-center gap-1 text-[11px] font-bold">
                        Read update <ArrowUpRight size={12} />
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="rounded-2xl border border-[#E8E5DC] bg-[#FAF9F6] p-4">
              <div className="flex items-center gap-2 text-[#151719]">
                <Sparkles size={14} />
                <span className="text-xs font-bold">How progress works</span>
              </div>
              <p className="mt-1.5 text-[10.5px] leading-relaxed text-[#6E767E]">
                Bookmarks, completions and claimed credits are stored per clinician in the clinic database. Claiming a
                credit also marks the course complete and downloads a certificate with your name and NPI.
              </p>
            </div>
          </div>
        </div>

        {/* Course detail modal */}
        {selectedCourse && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm animate-in fade-in">
            <div className="max-h-[92vh] w-full max-w-xl overflow-y-auto rounded-3xl border border-[#E8E5DC] bg-white shadow-2xl animate-in zoom-in-95">
              <div className="sticky top-0 flex items-center justify-between border-b border-[#F0ECE1] bg-[#FAF9F5] px-6 py-5">
                <div className="flex items-center gap-2.5">
                  <div className="flex h-8 w-8 items-center justify-center rounded-2xl bg-[#151719] text-white">
                    <BookOpen size={16} />
                  </div>
                  <div>
                    <span className="text-[10px] font-bold uppercase text-[#88909A]">{selectedCourse.specialty}</span>
                    <h3 className="text-sm font-bold leading-tight text-[#151719]">{selectedCourse.title}</h3>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setSelectedCourse(null)}
                  className="flex h-8 w-8 items-center justify-center rounded-full text-[#575D65] transition-colors hover:bg-[#EAE8E3] cursor-pointer"
                  aria-label="Close course"
                >
                  <X size={16} />
                </button>
              </div>

              <div className="space-y-4 p-6 text-xs">
                <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[#F0ECE1] pb-2 text-[#88909A]">
                  <span>Faculty: <strong>{selectedCourse.speaker || 'Clinical faculty'}</strong></span>
                  <span className="font-mono">{selectedCourse.duration} · {selectedCourse.date}</span>
                </div>

                <div className="space-y-2">
                  <h4 className="font-bold text-[#151719]">Clinical summary</h4>
                  <p className="text-xs leading-relaxed text-[#575D65]">{selectedCourse.fullContent}</p>
                </div>

                {selectedCourse.cmeCredits && (
                  <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-[#E8E5DC] bg-[#FAF9F6] p-3">
                    <div className="flex items-center gap-2 font-medium text-[#151719]">
                      <Award size={16} className="shrink-0 text-amber-600" />
                      <span>{selectedCourse.cmeCredits}</span>
                    </div>
                    <button
                      type="button"
                      disabled={pendingActionId === `claim-${selectedCourse.id}`}
                      onClick={() => { void claimCredit(selectedCourse); }}
                      className={`rounded-full px-3 py-1 text-xs font-semibold transition-colors cursor-pointer disabled:opacity-60 ${
                        progress.claimed.includes(selectedCourse.id)
                          ? 'bg-emerald-600 text-white hover:bg-emerald-700'
                          : 'bg-[#151719] text-white hover:bg-[#252830]'
                      }`}
                    >
                      {pendingActionId === `claim-${selectedCourse.id}`
                        ? 'Saving…'
                        : progress.claimed.includes(selectedCourse.id)
                          ? 'Download certificate'
                          : 'Claim credit'}
                    </button>
                  </div>
                )}

                <div className="flex flex-wrap items-center justify-between gap-2 border-t border-[#F0ECE1] pt-3">
                  <div className="flex flex-wrap items-center gap-2">
                    <button
                      type="button"
                      onClick={() => { void toggleBookmark(selectedCourse); }}
                      className="inline-flex items-center gap-1.5 rounded-full border border-[#E8E5DC] px-3 py-1.5 font-semibold text-[#151719] transition-colors hover:bg-[#F9F8F5] cursor-pointer"
                    >
                      {progress.bookmarks.includes(selectedCourse.id)
                        ? <><Check size={13} className="text-emerald-600" /> Saved</>
                        : <><Plus size={13} /> Save</>}
                    </button>
                    <button
                      type="button"
                      onClick={() => { void markComplete(selectedCourse); }}
                      disabled={progress.completed.includes(selectedCourse.id) || pendingActionId === `complete-${selectedCourse.id}`}
                      className="inline-flex items-center gap-1.5 rounded-full border border-[#E8E5DC] px-3 py-1.5 font-semibold text-[#151719] transition-colors hover:bg-[#F9F8F5] disabled:opacity-60 cursor-pointer"
                    >
                      <CheckCircle2 size={13} className={progress.completed.includes(selectedCourse.id) ? 'text-emerald-600' : ''} />
                      {progress.completed.includes(selectedCourse.id) ? 'Completed' : 'Mark complete'}
                    </button>
                  </div>

                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => exportCourse(selectedCourse)}
                      className="inline-flex items-center gap-1.5 rounded-full border border-[#E8E5DC] px-3 py-1.5 font-semibold text-[#575D65] transition-colors hover:text-[#151719] cursor-pointer"
                      title="Export course notes"
                    >
                      <Download size={13} />
                    </button>
                    <button
                      type="button"
                      onClick={() => { void shareCourse(selectedCourse); }}
                      className="inline-flex items-center gap-1.5 rounded-full bg-[#151719] px-4 py-1.5 font-semibold text-white shadow-xs transition-colors hover:bg-[#252830] cursor-pointer"
                    >
                      <Share2 size={13} />
                      Share
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Guideline update modal */}
        {selectedUpdate && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm animate-in fade-in">
            <div className="w-full max-w-lg overflow-hidden rounded-3xl border border-[#E8E5DC] bg-white shadow-2xl animate-in zoom-in-95">
              <div className="flex items-center justify-between border-b border-[#F0ECE1] bg-[#FAF9F5] px-6 py-5">
                <div className="flex items-center gap-2.5">
                  <div className="flex h-8 w-8 items-center justify-center rounded-2xl bg-[#151719] text-white">
                    <BookOpen size={16} />
                  </div>
                  <div>
                    <span className="text-[10px] font-bold uppercase text-[#88909A]">{selectedUpdate.guideline}</span>
                    <h3 className="text-sm font-bold leading-tight text-[#151719]">{selectedUpdate.title}</h3>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setSelectedUpdate(null)}
                  className="flex h-8 w-8 items-center justify-center rounded-full text-[#575D65] transition-colors hover:bg-[#EAE8E3] cursor-pointer"
                  aria-label="Close update"
                >
                  <X size={16} />
                </button>
              </div>

              <div className="space-y-4 p-6 text-xs">
                <div className="font-mono text-[11px] text-[#88909A]">Published: {selectedUpdate.date}</div>
                <div className="rounded-2xl border border-[#E8E5DC] bg-[#FAF9F6] p-4 leading-relaxed text-[#151719]">
                  {selectedUpdate.content}
                </div>
                <div className="flex items-center justify-end gap-2 border-t border-[#F0ECE1] pt-3">
                  <button
                    type="button"
                    onClick={() => {
                      downloadTextFile(
                        `${selectedUpdate.id}.txt`,
                        `${selectedUpdate.title}\n${selectedUpdate.guideline} · ${selectedUpdate.date}\n\n${selectedUpdate.content}`
                      );
                      showToast('Guideline summary downloaded.');
                    }}
                    className="inline-flex items-center gap-1.5 rounded-full bg-[#151719] px-4 py-2 font-semibold text-white shadow-xs transition-colors hover:bg-[#252830] cursor-pointer"
                  >
                    <Download size={13} />
                    Download summary
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </Layout>
  );
}
