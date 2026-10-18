import { forwardRef } from 'react';

export type AvatarSize = 'xs' | 'sm' | 'md' | 'lg' | 'xl';

export interface AvatarProps {
  name: string;
  src?: string;
  size?: AvatarSize;
  status?: 'online' | 'busy' | 'offline';
  className?: string;
}

const sizeStyles: Record<AvatarSize, { container: string; text: string; dot: string }> = {
  xs: { container: 'w-6 h-6', text: 'text-[9px]', dot: 'w-1.5 h-1.5' },
  sm: { container: 'w-7 h-7', text: 'text-xs', dot: 'w-2 h-2' },
  md: { container: 'w-9 h-9', text: 'text-xs', dot: 'w-2.5 h-2.5' },
  lg: { container: 'w-11 h-11', text: 'text-sm', dot: 'w-3 h-3' },
  xl: { container: 'w-14 h-14', text: 'text-base', dot: 'w-3.5 h-3.5' }
};

export const Avatar = forwardRef<HTMLDivElement, AvatarProps>(function Avatar(
  {
    name,
    src,
    size = 'md',
    status,
    className = ''
  },
  ref
) {
  const initials = name
    .split(' ')
    .map(n => n[0])
    .filter(Boolean)
    .slice(0, 2)
    .join('')
    .toUpperCase();

  const cfg = sizeStyles[size];

  const statusColors = {
    online: 'bg-emerald-500',
    busy: 'bg-rose-500',
    offline: 'bg-[#88909A]'
  };

  return (
    <div
      ref={ref}
      className={`relative inline-flex items-center justify-center rounded-full bg-[#151619] text-white font-bold tracking-tight shrink-0 select-none ${cfg.container} ${cfg.text} ${className}`}
      title={name}
      aria-label={name}
    >
      {src ? (
        <img
          src={src}
          alt={name}
          className="w-full h-full rounded-full object-cover"
        />
      ) : (
        <span>{initials || 'P'}</span>
      )}

      {status && (
        <span
          className={`absolute bottom-0 right-0 rounded-full ring-2 ring-white ${cfg.dot} ${statusColors[status]}`}
          aria-label={`Status: ${status}`}
        />
      )}
    </div>
  );
});

export default Avatar;
