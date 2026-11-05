import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Settings, Palette, LogOut, Edit3, X, Check } from 'lucide-react';

export interface ClinicianProfileModalProps {
  isOpen: boolean;
  onClose: () => void;
  onOpenThemeCustomizer?: () => void;
  onLogout?: () => void;
}

export interface DoctorProfileData {
  name: string;
  specialty: string;
  room: string;
  npi: string;
  facility: string;
}

export const DEFAULT_DOCTOR_PROFILE: DoctorProfileData = {
  name: 'Dr. Sarah Lin, MD',
  specialty: 'Internal Medicine',
  room: 'Room 1A',
  npi: '1928374650',
  facility: 'Proton Health Clinic'
};

export function readDoctorProfile(): DoctorProfileData {
  if (typeof window === 'undefined') return DEFAULT_DOCTOR_PROFILE;
  try {
    const raw = localStorage.getItem('proton_doctor_profile');
    if (raw) {
      return { ...DEFAULT_DOCTOR_PROFILE, ...JSON.parse(raw) };
    }
  } catch {
    // fallback
  }
  return DEFAULT_DOCTOR_PROFILE;
}

export function saveDoctorProfile(profile: DoctorProfileData) {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem('proton_doctor_profile', JSON.stringify(profile));
    window.dispatchEvent(new CustomEvent('proton.doctor_profile_updated', { detail: profile }));
  } catch {
    // ignore
  }
}

export default function ClinicianProfileModal({
  isOpen,
  onClose,
  onOpenThemeCustomizer,
  onLogout
}: ClinicianProfileModalProps) {
  const navigate = useNavigate();
  const [profile, setProfile] = useState<DoctorProfileData>(readDoctorProfile);
  const [isEditing, setIsEditing] = useState(false);
  const [editName, setEditName] = useState(profile.name);
  const [editSpecialty, setEditSpecialty] = useState(profile.specialty);
  const [editRoom, setEditRoom] = useState(profile.room);

  useEffect(() => {
    if (isOpen) {
      const current = readDoctorProfile();
      setProfile(current);
      setEditName(current.name);
      setEditSpecialty(current.specialty);
      setEditRoom(current.room);
      setIsEditing(false);
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const initials = profile.name
    .replace(/^(Dr\.?|Prof\.?)\s+/i, '')
    .replace(/,?\s*MD$/i, '')
    .split(/\s+/)
    .slice(0, 2)
    .map(p => p[0])
    .join('')
    .toUpperCase() || 'SL';

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    const updated: DoctorProfileData = {
      ...profile,
      name: editName.trim() || DEFAULT_DOCTOR_PROFILE.name,
      specialty: editSpecialty.trim() || DEFAULT_DOCTOR_PROFILE.specialty,
      room: editRoom.trim() || DEFAULT_DOCTOR_PROFILE.room
    };
    saveDoctorProfile(updated);
    setProfile(updated);
    setIsEditing(false);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center sm:justify-start sm:pl-16 p-3 select-none animate-in fade-in duration-150">
      {/* Click-outside backdrop */}
      <div 
        className="fixed inset-0 bg-black/40 backdrop-blur-2xs transition-opacity"
        onClick={onClose}
        aria-hidden="true"
      />

      {/* Floating Arc Profile Popover */}
      <div 
        role="dialog"
        aria-modal="true"
        aria-labelledby="profile-title"
        className="relative z-10 w-full max-w-[280px] rounded-[22px] bg-paper/95 dark:bg-[#18191c]/95 backdrop-blur-2xl border border-rule/70 dark:border-white/10 shadow-[0_16px_40px_rgba(0,0,0,0.35)] p-2.5 text-ink animate-in zoom-in-95 duration-150"
      >
        {!isEditing ? (
          <div>
            {/* Identity Row */}
            <div className="flex items-center gap-3 p-2">
              <div className="w-10 h-10 rounded-full bg-accent text-white flex items-center justify-center font-bold text-xs shrink-0 shadow-xs">
                {initials}
              </div>
              <div className="min-w-0 flex-1">
                <div id="profile-title" className="text-[13.5px] font-semibold text-ink truncate leading-tight">
                  {profile.name}
                </div>
                <div className="text-[11.5px] text-ink-3 truncate mt-0.5">
                  {profile.specialty} {profile.room ? `· ${profile.room}` : ''}
                </div>
              </div>
            </div>

            {/* Subtle Divider */}
            <div className="h-px bg-rule/60 dark:bg-white/6 my-1.5" />

            {/* Menu Items (Theme ABOVE, Profile & Settings BELOW) */}
            <div className="space-y-0.5">
              {onOpenThemeCustomizer && (
                <button
                  type="button"
                  onClick={() => {
                    onClose();
                    onOpenThemeCustomizer();
                  }}
                  className="w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-xs font-medium text-ink hover:bg-paper-2 dark:hover:bg-white/8 transition-colors cursor-pointer text-left"
                >
                  <Palette size={14} className="text-accent" />
                  <span>Theme & Colors</span>
                </button>
              )}

              <button
                type="button"
                onClick={() => setIsEditing(true)}
                className="w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-xs font-medium text-ink hover:bg-paper-2 dark:hover:bg-white/8 transition-colors cursor-pointer text-left"
              >
                <Edit3 size={14} className="text-ink-3" />
                <span>Edit Profile</span>
              </button>

              <button
                type="button"
                onClick={() => {
                  onClose();
                  navigate('/settings');
                }}
                className="w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-xs font-medium text-ink hover:bg-paper-2 dark:hover:bg-white/8 transition-colors cursor-pointer text-left"
              >
                <Settings size={14} className="text-ink-3" />
                <span>Settings</span>
              </button>
            </div>

            {/* Subtle Divider */}
            <div className="h-px bg-rule/60 dark:bg-white/6 my-1.5" />

            {/* Log Out */}
            {onLogout && (
              <button
                type="button"
                onClick={() => {
                  onClose();
                  onLogout();
                }}
                className="w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-xs font-medium text-critical hover:bg-critical-wash/50 transition-colors cursor-pointer text-left"
              >
                <LogOut size={14} />
                <span>Log Out</span>
              </button>
            )}
          </div>
        ) : (
          /* Simple Minimalist Edit State */
          <form onSubmit={handleSave} className="p-1 space-y-2.5 text-xs">
            <div className="flex items-center justify-between pb-1">
              <span className="font-semibold text-xs text-ink">Edit Details</span>
              <button
                type="button"
                onClick={() => setIsEditing(false)}
                className="p-1 text-ink-3 hover:text-ink cursor-pointer rounded-lg"
              >
                <X size={13} />
              </button>
            </div>

            <div>
              <label className="text-[11px] text-ink-3 block mb-1">Name</label>
              <input
                type="text"
                value={editName}
                onChange={e => setEditName(e.target.value)}
                className="w-full px-2.5 py-1.5 rounded-lg bg-paper-2 dark:bg-white/5 border border-rule dark:border-white/10 text-xs text-ink outline-none focus:border-accent"
                required
              />
            </div>

            <div>
              <label className="text-[11px] text-ink-3 block mb-1">Specialty / Role</label>
              <input
                type="text"
                value={editSpecialty}
                onChange={e => setEditSpecialty(e.target.value)}
                className="w-full px-2.5 py-1.5 rounded-lg bg-paper-2 dark:bg-white/5 border border-rule dark:border-white/10 text-xs text-ink outline-none focus:border-accent"
              />
            </div>

            <div>
              <label className="text-[11px] text-ink-3 block mb-1">Room / Station</label>
              <input
                type="text"
                value={editRoom}
                onChange={e => setEditRoom(e.target.value)}
                className="w-full px-2.5 py-1.5 rounded-lg bg-paper-2 dark:bg-white/5 border border-rule dark:border-white/10 text-xs text-ink outline-none focus:border-accent"
              />
            </div>

            <div className="flex items-center justify-end gap-2 pt-1.5 border-t border-rule/50 dark:border-white/6">
              <button
                type="button"
                onClick={() => setIsEditing(false)}
                className="px-2.5 py-1 rounded-lg text-ink-3 hover:text-ink text-xs font-medium cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="px-3 py-1 rounded-lg bg-accent text-white text-xs font-semibold cursor-pointer shadow-xs hover:opacity-90 flex items-center gap-1"
              >
                <Check size={12} />
                <span>Save</span>
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
