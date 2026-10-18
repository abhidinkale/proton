import { type ReactNode } from 'react';
import AppShell from '../design-system/layout/AppShell';

export interface LayoutProps {
  children: ReactNode;
  fullBleed?: boolean;
  fillCanvas?: boolean;
  canvasBg?: string;
}

export default function Layout({
  children,
  fullBleed = false,
  fillCanvas = false
}: LayoutProps) {
  return (
    <AppShell fullBleed={fullBleed} fillCanvas={fillCanvas}>
      {children}
    </AppShell>
  );
}
