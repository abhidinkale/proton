/**
 * PROTON DESIGN SYSTEM 2.0 (PDS-2)
 * Centralized Design Tokens
 * 
 * Clinical Ergonomics: "Bloomberg Terminal meets Linear meets modern clinical software"
 * Soft, calm, dense, fast, trustworthy, human.
 */

export const PDS_TOKENS = {
  color: {
    // Canvas & Layout Surfaces
    canvas: '#F9F8F5',
    rail: '#151619',
    railHover: '#202227',
    railActive: '#2B2E35',
    railBorder: '#23252B',
    surface: '#FFFFFF',
    surfaceSubtle: '#FAF9F6',
    surfaceElevated: '#FFFFFF',
    surfaceHover: '#F4F3EE',
    border: '#E8E5DC',
    borderLight: '#F0ECE1',
    borderDark: '#D5D2C9',

    // Typography
    textPrimary: '#151719',
    textSecondary: '#575D65',
    textMuted: '#88909A',
    textOnDark: '#FFFFFF',
    textOnDarkMuted: '#A0A5AD',

    // Clinical Semantic Tokens (Never use color alone — pair with label, icon, severity)
    semantic: {
      normal: {
        bg: '#ECFDF5',
        text: '#065F46',
        border: '#A7F3D0',
        badgeBg: '#D1FAE5',
        dot: '#10B981'
      },
      info: {
        bg: '#EFF6FF',
        text: '#1E40AF',
        border: '#BFDBFE',
        badgeBg: '#DBEAFE',
        dot: '#3B82F6'
      },
      attention: {
        bg: '#FEF08A',
        text: '#854D0E',
        border: '#FDE047',
        badgeBg: '#FEF9C3',
        dot: '#EAB308'
      },
      warning: {
        bg: '#FFEDD5',
        text: '#9A3412',
        border: '#FED7AA',
        badgeBg: '#FFEDD5',
        dot: '#F97316'
      },
      critical: {
        bg: '#FEF2F2',
        text: '#991B1B',
        border: '#FECACA',
        badgeBg: '#FEE2E2',
        dot: '#EF4444'
      },
      ai: {
        bg: '#FCE7F3',
        text: '#9D174D',
        border: '#FBCFE8',
        badgeBg: '#FDF2F8',
        dot: '#EC4899'
      },
      physician: {
        bg: '#F3E8FF',
        text: '#6B21A8',
        border: '#E9D5FF',
        badgeBg: '#FAF5FF',
        dot: '#A855F7'
      },
      system: {
        bg: '#F4F3EE',
        text: '#3F3F46',
        border: '#E4E4E7',
        badgeBg: '#E4E4E7',
        dot: '#71717A'
      }
    }
  },

  geometry: {
    radiusCardLarge: '24px',   // 1.5rem (rounded-3xl)
    radiusCardMedium: '16px',  // 1rem (rounded-2xl)
    radiusControl: '12px',     // 0.75rem (rounded-xl)
    radiusPill: '9999px',      // rounded-full
    borderStandard: '1px solid #E8E5DC',
    shadowSubtle: '0 1px 2px 0 rgba(0, 0, 0, 0.03)',
    shadowCard: '0 1px 3px 0 rgba(0, 0, 0, 0.05), 0 1px 2px -1px rgba(0, 0, 0, 0.05)',
    shadowElevated: '0 10px 15px -3px rgba(0, 0, 0, 0.08), 0 4px 6px -4px rgba(0, 0, 0, 0.04)',
    shadowFloating: '0 20px 25px -5px rgba(0, 0, 0, 0.15), 0 8px 10px -6px rgba(0, 0, 0, 0.1)'
  },

  motion: {
    micro: '120ms cubic-bezier(0.16, 1, 0.3, 1)',
    transition: '200ms cubic-bezier(0.16, 1, 0.3, 1)',
    workspace: '300ms cubic-bezier(0.16, 1, 0.3, 1)',
    reduced: '0ms linear'
  },

  typography: {
    fontFamily: '"Source Sans 3", -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
    tabularNums: 'font-variant-numeric: tabular-nums',
    weights: {
      regular: 400,
      medium: 500,
      semibold: 600,
      bold: 700,
      black: 900
    }
  },

  zIndex: {
    base: 1,
    stickyHeader: 20,
    navigationRail: 30,
    copilotFloating: 40,
    modalBackdrop: 50,
    modalContent: 51,
    toastNotifications: 60,
    safetyHardStop: 70
  }
} as const;

export type SemanticVariant = keyof typeof PDS_TOKENS.color.semantic;
