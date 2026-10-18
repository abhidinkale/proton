import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  Plus, 
  RefreshCw, 
  Calendar as CalendarIcon, 
  Clock, 
  Video, 
  Stethoscope, 
  FlaskConical, 
  Users, 
  FileText, 
  X,
  ExternalLink
} from 'lucide-react';
import Layout from '../components/Layout';
import ProtonButton from '../components/proton/ProtonButton';
import ProtonBadge from '../components/proton/ProtonBadge';

interface CalendarAppointment {
  id: string;
  patientId?: string;
  title: string;
  location: string;
  timeStart: string;
  timeEnd: string;
  dayIndex: number; // 0 = Mon, 1 = Tue, 2 = Wed, 3 = Thu, 4 = Fri, 5 = Sat, 6 = Sun
  type: 'emergency' | 'online' | 'diagnostic' | 'team' | 'followup' | 'interns';
  status: 'confirmed' | 'in-progress' | 'completed';
  participants?: string[];
  agendaDoc?: string;
  notes?: string;
}

const INITIAL_EVENTS: CalendarAppointment[] = [
  // Monday
  {
    id: 'evt-1',
    patientId: 'demo-scenario-b-eleanor',
    title: 'Emergency visit',
    location: 'West camp, Room 312',
    timeStart: '07:00',
    timeEnd: '07:30',
    dayIndex: 0,
    type: 'emergency',
    status: 'completed'
  },
  {
    id: 'evt-2',
    patientId: 'demo-scenario-a-clara',
    title: 'Diagnostic test',
    location: 'West camp, Room 312',
    timeStart: '07:30',
    timeEnd: '07:55',
    dayIndex: 0,
    type: 'diagnostic',
    status: 'completed'
  },
  {
    id: 'evt-3',
    title: 'Team planning',
    location: 'East camp, Room 200',
    timeStart: '08:00',
    timeEnd: '09:00',
    dayIndex: 0,
    type: 'team',
    status: 'completed',
    agendaDoc: 'Agenda.pdf',
    participants: ['TY', 'AB', 'NR', 'SS', '+3']
  },
  {
    id: 'evt-4',
    patientId: 'demo-scenario-c-robert',
    title: 'Emergency visit',
    location: 'West camp, Room 312',
    timeStart: '09:00',
    timeEnd: '09:30',
    dayIndex: 0,
    type: 'emergency',
    status: 'completed'
  },

  // Tuesday
  {
    id: 'evt-5',
    patientId: 'demo-scenario-d-arthur',
    title: 'Online visit',
    location: 'West camp, Room 312',
    timeStart: '07:00',
    timeEnd: '08:00',
    dayIndex: 1,
    type: 'online',
    status: 'confirmed',
    participants: ['TY']
  },
  {
    id: 'evt-6',
    title: 'Diagnostic test',
    location: 'West camp, Room 312',
    timeStart: '08:00',
    timeEnd: '08:15',
    dayIndex: 1,
    type: 'diagnostic',
    status: 'confirmed'
  },

  // Wednesday
  {
    id: 'evt-7',
    patientId: 'demo-scenario-e-marcus',
    title: 'Follow-up',
    location: 'West camp, Room 312',
    timeStart: '09:00',
    timeEnd: '09:30',
    dayIndex: 2,
    type: 'followup',
    status: 'confirmed'
  },
  {
    id: 'evt-8',
    title: 'Interns visit',
    location: 'West camp, Conference room 404',
    timeStart: '08:30',
    timeEnd: '09:30',
    dayIndex: 2,
    type: 'interns',
    status: 'confirmed',
    participants: ['TY', 'AB', 'NR', 'SS', '+12']
  },
  {
    id: 'evt-9',
    patientId: 'demo-scenario-b-eleanor',
    title: 'Emergency visit',
    location: 'West camp, Room 312',
    timeStart: '09:40',
    timeEnd: '10:00',
    dayIndex: 2,
    type: 'emergency',
    status: 'confirmed'
  },

  // Thursday (Current day in reference)
  {
    id: 'evt-10',
    patientId: 'demo-scenario-f-david',
    title: 'Online visit',
    location: 'West camp, Room 312',
    timeStart: '07:00',
    timeEnd: '08:00',
    dayIndex: 3,
    type: 'online',
    status: 'in-progress',
    participants: ['TY']
  },
  {
    id: 'evt-11',
    title: 'Team results review',
    location: 'East camp, Room 200',
    timeStart: '07:00',
    timeEnd: '08:00',
    dayIndex: 4,
    type: 'team',
    status: 'confirmed',
    agendaDoc: 'Agenda.pdf',
    participants: ['TY', 'AB', 'NR', 'SS', '+3']
  },

  // Friday
  {
    id: 'evt-12',
    patientId: 'demo-scenario-g-priya',
    title: 'Emergency visit',
    location: 'West camp, Room 312',
    timeStart: '07:00',
    timeEnd: '07:30',
    dayIndex: 4,
    type: 'emergency',
    status: 'confirmed'
  },
  {
    id: 'evt-13',
    title: 'Diagnostic test',
    location: 'West camp, Room 312',
    timeStart: '07:30',
    timeEnd: '07:55',
    dayIndex: 4,
    type: 'diagnostic',
    status: 'confirmed'
  },
  {
    id: 'evt-14',
    title: 'Interns visit',
    location: 'West camp, Conference room 404',
    timeStart: '08:30',
    timeEnd: '09:30',
    dayIndex: 4,
    type: 'interns',
    status: 'confirmed',
    participants: ['TY', 'AB', 'NR', 'SS', '+12']
  },

  // Saturday
  {
    id: 'evt-15',
    patientId: 'demo-scenario-h-evelyn',
    title: 'Online visit',
    location: 'West camp, Room 312',
    timeStart: '07:00',
    timeEnd: '08:00',
    dayIndex: 5,
    type: 'online',
    status: 'confirmed',
    participants: ['TY']
  },
  {
    id: 'evt-16',
    title: 'Follow-up',
    location: 'West camp, Room 312',
    timeStart: '09:00',
    timeEnd: '09:30',
    dayIndex: 5,
    type: 'followup',
    status: 'confirmed'
  }
];

const DAYS = [
  { name: 'MONDAY', date: '11/05' },
  { name: 'TUESDAY', date: '12/05' },
  { name: 'WEDNESDAY', date: '13/05' },
  { name: 'THU', date: '14/05', active: true },
  { name: 'FR', date: '15/05' },
  { name: 'SA', date: '16/05' },
  { name: 'SU', date: '17/05' }
];

const TIME_SLOTS = ['07:00', '07:30', '08:00', '08:30', '09:00', '09:30'];

export default function Schedule() {
  const navigate = useNavigate();
  const [viewMode, setViewMode] = useState<'today' | 'week' | 'month'>('week');
  const [events, setEvents] = useState<CalendarAppointment[]>(INITIAL_EVENTS);
  const [selectedEvent, setSelectedEvent] = useState<CalendarAppointment | null>(null);
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [newEventTitle, setNewEventTitle] = useState('');
  const [newEventPatient, setNewEventPatient] = useState('demo-scenario-a-clara');
  const [newEventType, setNewEventType] = useState<CalendarAppointment['type']>('followup');
  const [newEventTime, setNewEventTime] = useState('08:00');
  const [newEventDay, setNewEventDay] = useState(3);

  const handleCreateEvent = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newEventTitle) return;

    const newAppointment: CalendarAppointment = {
      id: `evt-${Date.now()}`,
      title: newEventTitle,
      patientId: newEventPatient,
      location: 'West camp, Room 312',
      timeStart: newEventTime,
      timeEnd: '08:30',
      dayIndex: newEventDay,
      type: newEventType,
      status: 'confirmed'
    };

    setEvents(prev => [...prev, newAppointment]);
    setIsAddModalOpen(false);
    setNewEventTitle('');
  };

  return (
    <Layout>
      <div className="space-y-6 animate-in fade-in pb-12">
        {/* Header section inspired by Reference 4 ("Stay up to date, Dr. Olivia") */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-[#151719]">
              Stay up to date, Dr. Olivia
            </h1>
            <p className="text-xs sm:text-sm text-[#575D65] mt-0.5">
              Multi-provider clinical schedule and real-time encounter timeline.
            </p>
          </div>

          <div className="flex items-center gap-3">
            {/* Date range badge */}
            <div className="flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-[#151619] text-white text-xs font-medium cursor-pointer shadow-xs">
              <CalendarIcon className="w-3.5 h-3.5" />
              <span>May 11/05 - 17/05</span>
            </div>

            {/* View switchers: Today, Week (active), Month */}
            <div className="flex items-center p-1 rounded-full bg-[#EAE7DE] border border-[#DDD9CE]">
              <button
                type="button"
                onClick={() => setViewMode('today')}
                className={`px-3 py-1 rounded-full text-xs font-semibold transition-all cursor-pointer ${
                  viewMode === 'today' ? 'bg-[#151619] text-white shadow-xs' : 'text-[#575D65] hover:text-[#151719]'
                }`}
              >
                Today
              </button>
              <button
                type="button"
                onClick={() => setViewMode('week')}
                className={`px-3 py-1 rounded-full text-xs font-semibold transition-all cursor-pointer ${
                  viewMode === 'week' ? 'bg-[#151619] text-white shadow-xs' : 'text-[#575D65] hover:text-[#151719]'
                }`}
              >
                Week
              </button>
              <button
                type="button"
                onClick={() => setViewMode('month')}
                className={`px-3 py-1 rounded-full text-xs font-semibold transition-all cursor-pointer ${
                  viewMode === 'month' ? 'bg-[#151619] text-white shadow-xs' : 'text-[#575D65] hover:text-[#151719]'
                }`}
              >
                Month
              </button>
            </div>

            {/* Actions */}
            <ProtonButton
              variant="primary"
              icon={<Plus className="w-3.5 h-3.5" />}
              onClick={() => setIsAddModalOpen(true)}
            >
              Add event
            </ProtonButton>

            <button
              type="button"
              onClick={() => setEvents([...INITIAL_EVENTS])}
              className="p-2 rounded-full bg-white border border-[#E8E5DC] text-[#575D65] hover:text-[#151719] hover:bg-[#F9F8F5] cursor-pointer shadow-xs"
              title="Refresh schedule"
            >
              <RefreshCw className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>

        {/* Master Schedule Grid */}
        <div className="bg-white rounded-3xl border border-[#E8E5DC] p-5 sm:p-6 shadow-[0_2px_12px_rgba(0,0,0,0.02)] overflow-x-auto">
          {/* Header Row: Days */}
          <div className="grid grid-cols-8 gap-3 min-w-[960px] pb-4 border-b border-[#E8E5DC]">
            <div className="text-center font-mono text-xs text-[#88909A] self-center">
              W 24
            </div>
            {DAYS.map((day) => (
              <div key={day.name} className="text-center">
                <div
                  className={`inline-flex flex-col items-center justify-center w-full py-1.5 px-2 rounded-2xl transition-colors ${
                    day.active
                      ? 'bg-[#151619] text-white shadow-xs'
                      : 'text-[#575D65] hover:bg-[#F9F8F5]'
                  }`}
                >
                  <span className="text-[11px] font-bold tracking-wider uppercase">{day.name}</span>
                  <span className="text-xs font-semibold opacity-90">{day.date}</span>
                </div>
              </div>
            ))}
          </div>

          {/* Time Rows */}
          <div className="relative min-w-[960px] mt-4 space-y-4">
            {/* Live Time Red/Pink Dashed Indicator line (07:21 in reference) */}
            <div 
              className="absolute left-0 right-0 z-20 pointer-events-none flex items-center"
              style={{ top: '68px' }}
            >
              <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-[#F43F5E] text-white shrink-0 ml-1 shadow-xs">
                07:21
              </span>
              <div className="flex-1 border-t-2 border-dashed border-[#F43F5E]/70 ml-2" />
            </div>

            {TIME_SLOTS.map((time) => (
              <div key={time} className="grid grid-cols-8 gap-3 min-h-[96px] border-b border-[#F0ECE1] pb-3">
                {/* Time Label */}
                <div className="text-right pr-4 font-mono text-xs text-[#88909A] pt-1">
                  {time}
                </div>

                {/* Day Slot Cells */}
                {DAYS.map((_, dayIdx) => {
                  const matchingEvents = events.filter(
                    e => e.dayIndex === dayIdx && e.timeStart === time
                  );

                  return (
                    <div key={dayIdx} className="space-y-2 min-h-[80px]">
                      {matchingEvents.map(evt => {
                        // Visual style mapping inspired by Reference 4
                        let cardBg = 'bg-[#F9F8F5] border-[#E8E5DC] text-[#151719]';
                        let icon = <Clock className="w-3.5 h-3.5 text-[#575D65]" />;

                        if (evt.type === 'team') {
                          cardBg = 'bg-[#FEF08A] border-[#FDE047] text-[#854D0E]';
                          icon = <Users className="w-3.5 h-3.5 text-[#854D0E]" />;
                        } else if (evt.type === 'emergency') {
                          cardBg = 'bg-[#FDF2F8] border-[#FBCFE8] text-[#9D174D]';
                          icon = <Stethoscope className="w-3.5 h-3.5 text-[#E11D48]" />;
                        } else if (evt.type === 'online') {
                          cardBg = 'bg-[#F9F8F5] border-[#E8E5DC] text-[#151719]';
                          icon = <Video className="w-3.5 h-3.5 text-[#7C3AED]" />;
                        } else if (evt.type === 'diagnostic') {
                          cardBg = 'bg-[#EFF6FF] border-[#BFDBFE] text-[#1E40AF]';
                          icon = <FlaskConical className="w-3.5 h-3.5 text-[#2563EB]" />;
                        } else if (evt.type === 'interns') {
                          cardBg = 'bg-[#E0E7FF] border-[#C7D2FE] text-[#3730A3]';
                          icon = <Users className="w-3.5 h-3.5 text-[#4F46E5]" />;
                        }

                        return (
                          <div
                            key={evt.id}
                            onClick={() => setSelectedEvent(evt)}
                            className={`p-3 rounded-2xl border transition-all hover:shadow-md cursor-pointer ${cardBg}`}
                          >
                            <div className="flex items-center justify-between gap-1 mb-1">
                              <span className="p-1 rounded-full bg-white/70 shadow-2xs">
                                {icon}
                              </span>
                              <span className="text-[10px] font-mono opacity-80">{evt.timeStart} - {evt.timeEnd}</span>
                            </div>

                            <h4 className="text-xs font-bold leading-tight line-clamp-1">{evt.title}</h4>
                            <p className="text-[10px] opacity-75 truncate mt-0.5">{evt.location}</p>

                            {/* Participant badges */}
                            {evt.participants && (
                              <div className="flex items-center gap-1 mt-2">
                                {evt.participants.slice(0, 3).map((p, i) => (
                                  <span key={i} className="w-4 h-4 rounded-full bg-black/10 flex items-center justify-center text-[8px] font-bold">
                                    {p}
                                  </span>
                                ))}
                              </div>
                            )}

                            {/* Agenda PDF pill */}
                            {evt.agendaDoc && (
                              <div className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md bg-black/5 text-[9px] font-medium mt-1.5">
                                <FileText className="w-2.5 h-2.5" />
                                <span>{evt.agendaDoc}</span>
                              </div>
                            )}

                            {/* In progress or Join button */}
                            {evt.status === 'in-progress' && (
                              <div className="mt-2 text-center">
                                <span className="inline-block px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-[#FCE7F3] text-[#9D174D] border border-[#FBCFE8]">
                                  In progress..
                                </span>
                              </div>
                            )}

                            {evt.type === 'online' && evt.status !== 'in-progress' && (
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  navigate('/consultation');
                                }}
                                className="w-full mt-2 py-1 rounded-xl bg-[#575D65] hover:bg-[#151719] text-white text-[10px] font-semibold transition-colors cursor-pointer"
                              >
                                Join
                              </button>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  );
                })}
              </div>
            ))}
          </div>
        </div>

        {/* Selected Event Details Modal */}
        {selectedEvent && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 backdrop-blur-xs p-4">
            <div className="bg-white rounded-3xl border border-[#E8E5DC] p-6 max-w-md w-full shadow-2xl space-y-4 animate-in zoom-in-95">
              <div className="flex items-center justify-between pb-2 border-b border-[#F0ECE1]">
                <div className="flex items-center gap-2">
                  <h3 className="text-base font-bold text-[#151719]">{selectedEvent.title}</h3>
                  <ProtonBadge
                    label={selectedEvent.type.toUpperCase()}
                    variant={selectedEvent.type === 'emergency' ? 'critical' : selectedEvent.type === 'online' ? 'info' : 'stable'}
                    size="sm"
                  />
                </div>
                <button
                  onClick={() => setSelectedEvent(null)}
                  className="p-1 rounded-full text-[#88909A] hover:text-[#151719] hover:bg-[#F9F8F5]"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              <div className="space-y-2 text-xs text-[#575D65]">
                <div className="flex items-center justify-between">
                  <span className="font-semibold text-[#151719]">Location:</span>
                  <span>{selectedEvent.location}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="font-semibold text-[#151719]">Time:</span>
                  <span className="font-mono">{selectedEvent.timeStart} - {selectedEvent.timeEnd}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="font-semibold text-[#151719]">Status:</span>
                  <span className="capitalize">{selectedEvent.status}</span>
                </div>
              </div>

              <div className="pt-3 border-t border-[#F0ECE1] flex items-center justify-end gap-2">
                <ProtonButton variant="secondary" onClick={() => setSelectedEvent(null)}>
                  Close
                </ProtonButton>
                {selectedEvent.patientId && (
                  <ProtonButton
                    variant="primary"
                    icon={<ExternalLink className="w-3.5 h-3.5" />}
                    onClick={() => {
                      navigate(`/consultation?patient=${selectedEvent.patientId}`);
                    }}
                  >
                    Open Encounter
                  </ProtonButton>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Add Event Modal */}
        {isAddModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 backdrop-blur-xs p-4">
            <form onSubmit={handleCreateEvent} className="bg-white rounded-3xl border border-[#E8E5DC] p-6 max-w-md w-full shadow-2xl space-y-4 animate-in zoom-in-95">
              <div className="flex items-center justify-between pb-2 border-b border-[#F0ECE1]">
                <h3 className="text-base font-bold text-[#151719]">Schedule New Appointment</h3>
                <button
                  type="button"
                  onClick={() => setIsAddModalOpen(false)}
                  className="p-1 rounded-full text-[#88909A] hover:text-[#151719]"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              <div className="space-y-3">
                <div>
                  <label className="block text-xs font-semibold text-[#151719] mb-1">Appointment Title</label>
                  <input
                    type="text"
                    required
                    value={newEventTitle}
                    onChange={(e) => setNewEventTitle(e.target.value)}
                    placeholder="e.g. Asthma Follow-up or Cardiometabolic Review"
                    className="w-full px-3 py-2 text-xs rounded-xl border border-[#E8E5DC] focus:outline-none focus:border-[#151719]"
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-semibold text-[#151719] mb-1">Visit Type</label>
                    <select
                      value={newEventType}
                      onChange={(e) => setNewEventType(e.target.value as any)}
                      className="w-full px-3 py-2 text-xs rounded-xl border border-[#E8E5DC] focus:outline-none focus:border-[#151719]"
                    >
                      <option value="followup">Follow-up</option>
                      <option value="emergency">Emergency visit</option>
                      <option value="online">Online visit</option>
                      <option value="diagnostic">Diagnostic test</option>
                      <option value="team">Team conference</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-[#151719] mb-1">Day</label>
                    <select
                      value={newEventDay}
                      onChange={(e) => setNewEventDay(Number(e.target.value))}
                      className="w-full px-3 py-2 text-xs rounded-xl border border-[#E8E5DC] focus:outline-none focus:border-[#151719]"
                    >
                      {DAYS.map((d, i) => (
                        <option key={d.name} value={i}>{d.name} ({d.date})</option>
                      ))}
                    </select>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-semibold text-[#151719] mb-1">Time Slot</label>
                    <select
                      value={newEventTime}
                      onChange={(e) => setNewEventTime(e.target.value)}
                      className="w-full px-3 py-2 text-xs rounded-xl border border-[#E8E5DC] focus:outline-none focus:border-[#151719]"
                    >
                      {TIME_SLOTS.map(t => (
                        <option key={t} value={t}>{t}</option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-[#151719] mb-1">Linked Patient</label>
                    <select
                      value={newEventPatient}
                      onChange={(e) => setNewEventPatient(e.target.value)}
                      className="w-full px-3 py-2 text-xs rounded-xl border border-[#E8E5DC] focus:outline-none focus:border-[#151719]"
                    >
                      <option value="demo-scenario-a-clara">Clara Hughes (Asthma)</option>
                      <option value="demo-scenario-b-eleanor">Eleanor Vance (T2DM)</option>
                      <option value="demo-scenario-c-robert">Robert Hayes (Cardiology)</option>
                      <option value="demo-scenario-d-arthur">Arthur Pendelton (Afib)</option>
                    </select>
                  </div>
                </div>
              </div>

              <div className="pt-3 border-t border-[#F0ECE1] flex items-center justify-end gap-2">
                <ProtonButton variant="secondary" type="button" onClick={() => setIsAddModalOpen(false)}>
                  Cancel
                </ProtonButton>
                <ProtonButton variant="primary" type="submit">
                  Save Appointment
                </ProtonButton>
              </div>
            </form>
          </div>
        )}
      </div>
    </Layout>
  );
}
