import { type ReactNode, forwardRef } from 'react';

export interface SplitPaneProps {
  primary: ReactNode;
  secondary: ReactNode;
  ratio?: '50-50' | '60-40' | '70-30' | '65-35';
  className?: string;
  reverseOnMobile?: boolean;
}

const ratioStyles = {
  '50-50': 'lg:grid-cols-2',
  '60-40': 'lg:grid-cols-12 [&>*:first-child]:lg:col-span-7 [&>*:last-child]:lg:col-span-5',
  '70-30': 'lg:grid-cols-12 [&>*:first-child]:lg:col-span-8 [&>*:last-child]:lg:col-span-4',
  '65-35': 'lg:grid-cols-12 [&>*:first-child]:lg:col-span-8 [&>*:last-child]:lg:col-span-4'
};

export const SplitPane = forwardRef<HTMLDivElement, SplitPaneProps>(function SplitPane(
  {
    primary,
    secondary,
    ratio = '70-30',
    className = '',
    reverseOnMobile = false
  },
  ref
) {
  return (
    <div
      ref={ref}
      className={`grid grid-cols-1 gap-6 items-start ${ratioStyles[ratio]} ${
        reverseOnMobile ? 'flex flex-col-reverse lg:grid' : ''
      } ${className}`}
    >
      <div className="min-w-0 w-full">{primary}</div>
      <div className="min-w-0 w-full">{secondary}</div>
    </div>
  );
});

export default SplitPane;
