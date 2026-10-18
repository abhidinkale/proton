import { useState, useEffect } from 'react';
import { WifiOff, RefreshCw } from 'lucide-react';

export interface ProtonStatusChipProps {
  className?: string;
}

export default function ProtonStatusChip({ className = '' }: ProtonStatusChipProps) {
  const [isOnline, setIsOnline] = useState<boolean>(navigator.onLine);
  const [syncing, setSyncing] = useState<boolean>(false);

  useEffect(() => {
    const handleOnline = () => {
      setIsOnline(true);
      setSyncing(true);
      setTimeout(() => {
        setSyncing(false);
      }, 1400);
    };

    const handleOffline = () => {
      setIsOnline(false);
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  if (!isOnline) {
    return (
      <div 
        className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-[#FEF3C7] text-[#92400E] border border-[#FDE68A] shadow-sm select-none ${className}`}
        role="status"
        aria-label="Proton is currently offline. Clinical modifications are saved locally."
      >
        <WifiOff className="w-3.5 h-3.5 text-[#B45309]" />
        <span>Offline · Changes saved locally</span>
      </div>
    );
  }

  if (syncing) {
    return (
      <div 
        className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-[#EFF6FF] text-[#1E40AF] border border-[#BFDBFE] shadow-sm select-none ${className}`}
        role="status"
        aria-label="Synchronizing clinical cache with FHIR repository"
      >
        <RefreshCw className="w-3.5 h-3.5 text-[#2563EB] animate-spin" />
        <span>Syncing changes...</span>
      </div>
    );
  }

  return (
    <div 
      className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-[#F0FDF4] text-[#166534] border border-[#DCFCE7] select-none ${className}`}
      role="status"
      aria-label="Proton is securely connected to FHIR clinical server"
    >
      <span className="w-2 h-2 rounded-full bg-[#16A34A] animate-pulse" />
      <span className="font-semibold text-[11px] tracking-wide">Connected</span>
    </div>
  );
}
