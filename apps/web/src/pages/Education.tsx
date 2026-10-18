import { useState } from 'react';
import { 
  Play, 
  Plus, 
  FileText, 
  Check, 
  Send,
  BookOpen,
  ArrowUpRight
} from 'lucide-react';
import Layout from '../components/Layout';

interface ClinicalArticle {
  id: string;
  title: string;
  specialty: string;
  specialtyVariant: 'rose' | 'canary' | 'olive' | 'periwinkle';
  description: string;
  duration: string;
  speaker?: string;
  imageUrl?: string;
  date: string;
}

const ARTICLES_MONDAY: ClinicalArticle[] = [
  {
    id: 'art-1',
    title: 'Health systems science in medical education',
    specialty: 'Clinical Immunology',
    specialtyVariant: 'rose',
    description: 'Do you know how to optimally manage moderate to severe asthma in your patients?',
    duration: '60 min',
    date: 'Monday, 15 May'
  },
  {
    id: 'art-2',
    title: 'Unravelling Complex Cases in Developmental & Epileptic Encephalopathies',
    specialty: 'Neurology',
    specialtyVariant: 'canary',
    description: 'Evidence-based refractory epilepsy protocols and genetic testing indications.',
    duration: '45 min',
    date: 'Monday, 15 May'
  }
];

const ARTICLES_TUESDAY: ClinicalArticle[] = [
  {
    id: 'art-3',
    title: 'Best Practices in Spinal Muscular Atrophy',
    specialty: 'Neurology',
    specialtyVariant: 'canary',
    description: 'Get expert insight on how to develop a personalized transition of care plan.',
    duration: '30 min',
    date: 'Tuesday, 16 May'
  }
];

const ARTICLES_WEDNESDAY: ClinicalArticle[] = [
  {
    id: 'art-4',
    title: 'Chronic Kidney Disease Co-Management',
    specialty: 'Primary Care',
    specialtyVariant: 'periwinkle',
    description: 'What tools and strategies can you leverage to help maximize a co-management approach to CKD.',
    duration: '120 min',
    date: 'Wednesday, 17 May'
  }
];

export default function Education() {
  const [savedArticles, setSavedArticles] = useState<string[]>([]);

  const toggleSave = (id: string) => {
    setSavedArticles(prev => 
      prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]
    );
  };

  return (
    <Layout>
      <div className="space-y-6 animate-in fade-in pb-12">
        {/* Header section inspired by Reference 3 ("Keep learning, Dr. Olivia") */}
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-[#151719]">
            Keep learning, Dr. Olivia
          </h1>
          <p className="text-xs sm:text-sm text-[#575D65] mt-0.5">
            This is your knowledge base. You can find here live and saved events, recent field updates, lots of articles and useful tips.
          </p>
        </div>

        {/* Master Layout: 2 Columns (Main feed + Right Rail) */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          
          {/* Main Left / Center Content (8 cols) */}
          <div className="lg:col-span-8 space-y-6">
            
            {/* Live Now Hero Banner */}
            <div>
              <div className="flex items-center justify-between mb-3">
                <h2 className="text-sm font-bold text-[#151719] uppercase tracking-wider">Live now</h2>
              </div>

              <div className="bg-[#FCE7F3] rounded-3xl border border-[#FBCFE8] p-5 sm:p-6 relative overflow-hidden flex flex-col md:flex-row items-center gap-6 shadow-[0_2px_12px_rgba(0,0,0,0.02)]">
                {/* Video thumbnail with play button */}
                <div className="relative w-full md:w-64 h-44 rounded-2xl bg-zinc-900 overflow-hidden shrink-0 group flex items-center justify-center">
                  <img
                    src="https://images.unsplash.com/photo-1579684385127-1ef15d508118?auto=format&fit=crop&w=600&q=80"
                    alt="Live clinical stream"
                    className="w-full h-full object-cover opacity-80 group-hover:scale-105 transition-transform"
                  />
                  {/* Live badge */}
                  <div className="absolute top-3 left-3 flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-black/70 text-white text-[10px] font-bold">
                    <span className="w-2 h-2 rounded-full bg-rose-500 animate-pulse" />
                    <span>In progress 02:15</span>
                  </div>

                  {/* Play circle button */}
                  <button 
                    type="button"
                    className="w-12 h-12 rounded-full bg-white/90 text-[#9D174D] flex items-center justify-center shadow-lg hover:scale-110 transition-transform cursor-pointer"
                  >
                    <Play className="w-5 h-5 fill-current ml-0.5" />
                  </button>
                </div>

                {/* Stream Info */}
                <div className="space-y-3 flex-1 min-w-0">
                  <span className="inline-block px-3 py-1 rounded-full text-[11px] font-bold bg-white/80 text-[#9D174D] border border-[#FBCFE8]">
                    Allergy & Clinical Immunology
                  </span>

                  <h3 className="text-base sm:text-lg font-bold text-[#151719] leading-snug">
                    Moderate to Severe Asthma: What You Need to Know to Gain Control
                  </h3>

                  <p className="text-xs text-[#575D65] line-clamp-2">
                    Do you know how to optimally manage moderate to severe asthma in your patients? Explore biologic therapies and GINA 2026 guidelines.
                  </p>

                  <div className="flex flex-wrap items-center gap-4 text-xs text-[#575D65] pt-1 border-t border-[#FBCFE8]/60">
                    <span className="font-semibold text-[#151719]">1.2 k watching</span>
                    <span>Speaker: <strong>Dr. Olwyn Westwood</strong></span>
                    <span>Duration: <strong>60 min</strong></span>
                  </div>
                </div>
              </div>
            </div>

            {/* Daily Columns */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              
              {/* Monday */}
              <div className="space-y-3">
                <div className="flex items-center justify-between pb-1 border-b border-[#E8E5DC]">
                  <span className="text-xs font-bold text-[#151719]">Monday, 15 May</span>
                  <span className="w-5 h-5 rounded-full bg-[#151619] text-white flex items-center justify-center text-[10px] font-bold">12</span>
                </div>

                {ARTICLES_MONDAY.map(art => (
                  <div key={art.id} className="bg-white rounded-2xl border border-[#E8E5DC] p-4 space-y-2 hover:shadow-md transition-shadow">
                    <span className={`inline-block px-2.5 py-0.5 rounded-full text-[10px] font-bold ${
                      art.specialtyVariant === 'rose' ? 'bg-[#FCE7F3] text-[#9D174D]' : 'bg-[#FEF08A] text-[#854D0E]'
                    }`}>
                      {art.specialty}
                    </span>
                    <h4 className="text-xs font-bold text-[#151719] leading-snug">{art.title}</h4>
                    <p className="text-[11px] text-[#575D65] line-clamp-2">{art.description}</p>
                    <div className="flex items-center justify-between pt-2 border-t border-[#F0ECE1]">
                      <span className="text-[10px] font-mono text-[#88909A]">{art.duration}</span>
                      <button
                        type="button"
                        onClick={() => toggleSave(art.id)}
                        className={`p-1.5 rounded-full transition-colors cursor-pointer ${
                          savedArticles.includes(art.id)
                            ? 'bg-[#151619] text-white'
                            : 'bg-[#F9F8F5] text-[#575D65] hover:bg-[#FCE7F3] hover:text-[#9D174D]'
                        }`}
                        title="Save article"
                      >
                        {savedArticles.includes(art.id) ? <Check className="w-3.5 h-3.5" /> : <Plus className="w-3.5 h-3.5" />}
                      </button>
                    </div>
                  </div>
                ))}
              </div>

              {/* Tuesday */}
              <div className="space-y-3">
                <div className="flex items-center justify-between pb-1 border-b border-[#E8E5DC]">
                  <span className="text-xs font-bold text-[#151719]">Tuesday, 16 May</span>
                  <span className="w-5 h-5 rounded-full bg-[#151619] text-white flex items-center justify-center text-[10px] font-bold">17</span>
                </div>

                {ARTICLES_TUESDAY.map(art => (
                  <div key={art.id} className="bg-white rounded-2xl border border-[#E8E5DC] p-4 space-y-2 hover:shadow-md transition-shadow">
                    <span className="inline-block px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-[#FEF08A] text-[#854D0E]">
                      {art.specialty}
                    </span>
                    <h4 className="text-xs font-bold text-[#151719] leading-snug">{art.title}</h4>
                    <p className="text-[11px] text-[#575D65] line-clamp-2">{art.description}</p>
                    <div className="flex items-center justify-between pt-2 border-t border-[#F0ECE1]">
                      <span className="text-[10px] font-mono text-[#88909A]">{art.duration}</span>
                      <button
                        type="button"
                        onClick={() => toggleSave(art.id)}
                        className={`p-1.5 rounded-full transition-colors cursor-pointer ${
                          savedArticles.includes(art.id)
                            ? 'bg-[#151619] text-white'
                            : 'bg-[#F9F8F5] text-[#575D65] hover:bg-[#FCE7F3] hover:text-[#9D174D]'
                        }`}
                        title="Save article"
                      >
                        {savedArticles.includes(art.id) ? <Check className="w-3.5 h-3.5" /> : <Plus className="w-3.5 h-3.5" />}
                      </button>
                    </div>
                  </div>
                ))}
              </div>

              {/* Wednesday */}
              <div className="space-y-3">
                <div className="flex items-center justify-between pb-1 border-b border-[#E8E5DC]">
                  <span className="text-xs font-bold text-[#151719]">Wednesday, 17 May</span>
                  <span className="w-5 h-5 rounded-full bg-[#151619] text-white flex items-center justify-center text-[10px] font-bold">14</span>
                </div>

                {ARTICLES_WEDNESDAY.map(art => (
                  <div key={art.id} className="bg-white rounded-2xl border border-[#E8E5DC] p-4 space-y-2 hover:shadow-md transition-shadow">
                    <span className="inline-block px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-[#E0E7FF] text-[#1E40AF]">
                      {art.specialty}
                    </span>
                    <h4 className="text-xs font-bold text-[#151719] leading-snug">{art.title}</h4>
                    <p className="text-[11px] text-[#575D65] line-clamp-2">{art.description}</p>
                    <div className="flex items-center justify-between pt-2 border-t border-[#F0ECE1]">
                      <span className="text-[10px] font-mono text-[#88909A]">{art.duration}</span>
                      <button
                        type="button"
                        onClick={() => toggleSave(art.id)}
                        className={`p-1.5 rounded-full transition-colors cursor-pointer ${
                          savedArticles.includes(art.id)
                            ? 'bg-[#151619] text-white'
                            : 'bg-[#F9F8F5] text-[#575D65] hover:bg-[#FCE7F3] hover:text-[#9D174D]'
                        }`}
                        title="Save article"
                      >
                        {savedArticles.includes(art.id) ? <Check className="w-3.5 h-3.5" /> : <Plus className="w-3.5 h-3.5" />}
                      </button>
                    </div>
                  </div>
                ))}
              </div>

            </div>
          </div>

          {/* Right Rail (4 cols): Recent Field Updates, Top Articles, New Uploads */}
          <div className="lg:col-span-4 space-y-6">
            
            {/* Recent Field Updates */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <h3 className="text-xs font-bold text-[#151719] uppercase tracking-wider">Recent field updates</h3>
                <span className="text-xs text-[#575D65] hover:text-[#151719] cursor-pointer font-medium">Show all ..</span>
              </div>

              {/* Canary Yellow Update Card */}
              <div className="bg-[#FEF08A] rounded-2xl border border-[#FDE047] p-4 text-[#854D0E] space-y-2 shadow-xs">
                <div className="flex items-center gap-2">
                  <div className="w-6 h-6 rounded-lg bg-black/10 flex items-center justify-center">
                    <BookOpen className="w-3.5 h-3.5" />
                  </div>
                  <h4 className="text-xs font-bold leading-tight">
                    Long-Term Use of ADHD Meds and CVD Risk: New Data
                  </h4>
                </div>
                <div className="text-[10px] font-mono opacity-80">22 April 2026</div>
                <p className="text-[11px] opacity-90 leading-relaxed">
                  In 2026, clinical trials demonstrated that cardiovascular risk is attenuated with monitored titration and baseline ECG screening.
                </p>
                <div className="pt-2 border-t border-[#854D0E]/20 flex items-center justify-between">
                  <button type="button" className="inline-flex items-center gap-1 text-xs font-bold hover:underline cursor-pointer">
                    <span>Open resource</span>
                    <ArrowUpRight className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>

              {/* Periwinkle Update Card */}
              <div className="bg-[#E0E7FF] rounded-2xl border border-[#C7D2FE] p-4 text-[#1E40AF] space-y-2 shadow-xs">
                <div className="flex items-center gap-2">
                  <div className="w-6 h-6 rounded-lg bg-black/10 flex items-center justify-center">
                    <BookOpen className="w-3.5 h-3.5" />
                  </div>
                  <h4 className="text-xs font-bold leading-tight">
                    Chronic Pain in the US: New Multimodal Guidelines
                  </h4>
                </div>
                <div className="text-[10px] font-mono opacity-80">22 April 2026</div>
                <p className="text-[11px] opacity-90 leading-relaxed">
                  Non-pharmacologic and interventional pathways prioritize physical therapy and cognitive behavioral pain reprocessing.
                </p>
                <div className="pt-2 border-t border-[#1E40AF]/20 flex items-center justify-between">
                  <button type="button" className="inline-flex items-center gap-1 text-xs font-bold hover:underline cursor-pointer">
                    <span>Open resource</span>
                    <ArrowUpRight className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            </div>

            {/* Top Articles for You Carousel / Cards */}
            <div className="space-y-3">
              <h3 className="text-xs font-bold text-[#151719] uppercase tracking-wider">Top articles for you</h3>
              <div className="grid grid-cols-3 gap-2">
                <div className="p-3 rounded-2xl bg-white border border-[#E8E5DC] text-center space-y-1 hover:shadow-xs cursor-pointer">
                  <div className="w-8 h-8 mx-auto rounded-xl bg-[#FEF08A] flex items-center justify-center text-xs font-bold">
                    TEL
                  </div>
                  <h5 className="text-[10px] font-bold text-[#151719] line-clamp-2">Setting Up Telemedicine</h5>
                </div>
                <div className="p-3 rounded-2xl bg-white border border-[#E8E5DC] text-center space-y-1 hover:shadow-xs cursor-pointer">
                  <div className="w-8 h-8 mx-auto rounded-xl bg-[#DCFCE7] flex items-center justify-center text-xs font-bold">
                    EHR
                  </div>
                  <h5 className="text-[10px] font-bold text-[#151719] line-clamp-2">Using EHRs to Improve Practice</h5>
                </div>
                <div className="p-3 rounded-2xl bg-white border border-[#E8E5DC] text-center space-y-1 hover:shadow-xs cursor-pointer">
                  <div className="w-8 h-8 mx-auto rounded-xl bg-[#FCE7F3] flex items-center justify-center text-xs font-bold">
                    DX
                  </div>
                  <h5 className="text-[10px] font-bold text-[#151719] line-clamp-2">Headache Etiology in Clinic</h5>
                </div>
              </div>
            </div>

            {/* New Uploads */}
            <div className="space-y-3">
              <h3 className="text-xs font-bold text-[#151719] uppercase tracking-wider">New uploads</h3>
              <div className="bg-white rounded-2xl border border-[#E8E5DC] divide-y divide-[#F0ECE1]">
                <div className="p-3 flex items-center justify-between gap-3">
                  <div className="flex items-center gap-2 min-w-0">
                    <span className="w-7 h-7 rounded-lg bg-[#151619] text-white flex items-center justify-center text-[9px] font-bold shrink-0">
                      PDF
                    </span>
                    <span className="text-xs font-semibold text-[#151719] truncate">Medical Prescription Rules Q3</span>
                  </div>
                  <div className="flex items-center gap-1 shrink-0">
                    <button className="p-1 rounded-md text-[#88909A] hover:text-[#151719]">
                      <FileText className="w-3.5 h-3.5" />
                    </button>
                    <button className="p-1 rounded-md text-[#88909A] hover:text-[#151719]">
                      <Send className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>

                <div className="p-3 flex items-center justify-between gap-3">
                  <div className="flex items-center gap-2 min-w-0">
                    <span className="w-7 h-7 rounded-lg bg-[#575D65] text-white flex items-center justify-center text-[9px] font-bold shrink-0">
                      DOC
                    </span>
                    <span className="text-xs font-semibold text-[#151719] truncate">X-Ray Bones broken - Example</span>
                  </div>
                  <div className="flex items-center gap-1 shrink-0">
                    <button className="p-1 rounded-md text-[#88909A] hover:text-[#151719]">
                      <FileText className="w-3.5 h-3.5" />
                    </button>
                    <button className="p-1 rounded-md text-[#88909A] hover:text-[#151719]">
                      <Send className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              </div>
            </div>

          </div>

        </div>
      </div>
    </Layout>
  );
}
