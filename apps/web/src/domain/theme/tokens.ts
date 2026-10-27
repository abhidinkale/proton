/**
 * PROTON DESIGN SYSTEM (PDS) — DESIGN TOKENS
 * Centralized Design Token Authority for Proton Clinical Operating System.
 * 
 * Clinical Ergonomics: "Bloomberg Terminal meets Linear meets modern clinical software"
 * Characteristics: Calm, restrained, information-dense, highly legible, accessible, trustworthy.
 * Invariant: AI assistance must be clearly demarcated from physician-approved clinical ground truth.
 */

export const PDS_TOKENS = {
  color: {
    // Canvas & Structural Surfaces
    canvas: '#F9F8F5',
    rail: '#151619',
    railHover: '#202227',
    railActive: '#2B2E35',
    railBorder: '#23252B',
    surface: '#FFFFFF',
    surfaceSubtle: '#FAF9F6',
    surfaceElevated: '#FFFFFF',
    surfaceSunken: '#F4F2EC',
    surfaceHover: '#F4F3EE',
    
    // Borders
    border: '#E8E5DC',
    borderLight: '#F0ECE1',
    borderDark: '#D5D2C9',
    borderStrong: '#D6D2C4',

    // Typography & Ink
    textPrimary: '#151719',
    textSecondary: '#575D65',
    textMuted: '#88909A',
    textOnDark: '#FFFFFF',
    textOnDarkMuted: '#A0A5AD',

    // Brand Accents
    brand: {
      primary: '#151619',
      primaryHover: '#2A2E37',
      rose: '#FCE7F3',
      roseText: '#9D174D',
      roseBorder: '#FBCFE8',
      roseAccent: '#F43F5E',
      canary: '#FEF08A',
      canaryText: '#854D0E',
      canaryBorder: '#FDE047',
      olive: '#DCFCE7',
      oliveText: '#166534',
      oliveBorder: '#BBF7D0',
      periwinkle: '#E0E7FF',
      periwinkleText: '#1E40AF',
      periwinkleBorder: '#C7D2FE'
    },

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
    },

    // Clinical Governance & Provenance Lifecycles
    lifecycle: {
      draft: {
        bg: '#F4F2EC',
        text: '#575D65',
        border: '#E5E1D6',
        label: 'Draft',
        description: 'Incomplete or unverified documentation'
      },
      aiGenerated: {
        bg: '#FCE7F3',
        text: '#9D174D',
        border: '#FBCFE8',
        label: 'AI Generated',
        description: 'Machine synthesized recommendation — requires physician sign-off'
      },
      physicianReviewRequired: {
        bg: '#FEF08A',
        text: '#854D0E',
        border: '#FDE047',
        label: 'Physician Review Required',
        description: 'Pending clinician attestation before EHR persistence'
      },
      physicianApproved: {
        bg: '#ECFDF5',
        text: '#065F46',
        border: '#A7F3D0',
        label: 'Physician Approved',
        description: 'Cryptographically bound & signed by attending physician'
      },
      amended: {
        bg: '#EFF6FF',
        text: '#1E40AF',
        border: '#BFDBFE',
        label: 'Amended',
        description: 'Clinically modified post-approval with immutable audit trace'
      },
      voided: {
        bg: '#F3F4F6',
        text: '#6B7280',
        border: '#E5E7EB',
        label: 'Voided',
        description: 'Nullified entry — retained for legal/audit purposes only'
      },
      pending: {
        bg: '#F3F4F6',
        text: '#4B5563',
        border: '#E5E7EB',
        label: 'Pending',
        description: 'Awaiting laboratory, imaging, or telemetry results'
      }
    }
  },

  // Consistent 4px Baseline Spacing Scale
  spacing: {
    1: '0.25rem',  // 4px
    2: '0.5rem',   // 8px
    3: '0.75rem',  // 12px
    4: '1rem',     // 16px
    5: '1.25rem',  // 20px
    6: '1.5rem',   // 24px
    8: '2rem',     // 32px
    10: '2.5rem',  // 40px
    12: '3rem',    // 48px
    16: '4rem'     // 64px
  },

  // Geometric Radii Hierarchy
  radii: {
    xs: '4px',       // Sub-controls / micro-badges
    sm: '6px',       // Inline tags / code chips
    md: '8px',       // Standard inputs / dropdown menus
    lg: '12px',      // Buttons / pill inputs / small cards
    xl: '16px',      // Medium cards / drawers / dialogs
    '2xl': '24px',   // Main panels / master workspace cards (rounded-3xl)
    pill: '9999px'   // Badges, avatar circles, search bars, action pills
  },

  // Backward compatibility aliases
  geometry: {
    radiusCardLarge: '24px',
    radiusCardMedium: '16px',
    radiusControl: '12px',
    radiusPill: '9999px',
    borderStandard: '1px solid #E8E5DC',
    shadowSubtle: '0 1px 2px 0 rgba(0, 0, 0, 0.03)',
    shadowCard: '0 1px 3px 0 rgba(0, 0, 0, 0.05), 0 1px 2px -1px rgba(0, 0, 0, 0.05)',
    shadowElevated: '0 10px 15px -3px rgba(0, 0, 0, 0.08), 0 4px 6px -4px rgba(0, 0, 0, 0.04)',
    shadowFloating: '0 20px 25px -5px rgba(0, 0, 0, 0.15), 0 8px 10px -6px rgba(0, 0, 0, 0.1)'
  },

  // Depth & Elevation
  elevation: {
    flat: 'none',
    subtle: '0 1px 2px 0 rgba(0, 0, 0, 0.03)',
    card: '0 1px 3px 0 rgba(0, 0, 0, 0.05), 0 1px 2px -1px rgba(0, 0, 0, 0.05)',
    raised: '0 4px 6px -1px rgba(0, 0, 0, 0.05), 0 2px 4px -2px rgba(0, 0, 0, 0.03)',
    overlay: '0 10px 15px -3px rgba(0, 0, 0, 0.08), 0 4px 6px -4px rgba(0, 0, 0, 0.04)',
    modal: '0 20px 25px -5px rgba(0, 0, 0, 0.15), 0 8px 10px -6px rgba(0, 0, 0, 0.1)'
  },

  // Motion Curves (WCAG 2.2 prefers-reduced-motion safe)
  motion: {
    micro: '120ms cubic-bezier(0.16, 1, 0.3, 1)',
    transition: '200ms cubic-bezier(0.16, 1, 0.3, 1)',
    workspace: '300ms cubic-bezier(0.16, 1, 0.3, 1)',
    reduced: '0ms linear'
  },

  // Typography Typography Scale & Rules
  typography: {
    fontFamily: '"Outfit", "Plus Jakarta Sans", -apple-system, BlinkMacSystemFont, "SF Pro Rounded", "SF Pro Display", sans-serif',
    fontDisplay: '"Outfit", "Plus Jakarta Sans", -apple-system, BlinkMacSystemFont, "SF Pro Rounded", "SF Pro Display", sans-serif',
    fontMono: '"JetBrains Mono", "SF Mono", ui-monospace, monospace',
    tabularNums: 'font-variant-numeric: tabular-nums',
    weights: {
      regular: 400,
      medium: 500,
      semibold: 600,
      bold: 700,
      extrabold: 800,
      black: 900
    },
    scale: {
      display: { size: '2rem', lineHeight: '2.5rem', weight: 800 },         // 32px
      pageHeading: { size: '1.5rem', lineHeight: '2rem', weight: 700 },      // 24px
      sectionHeading: { size: '1.125rem', lineHeight: '1.5rem', weight: 700 }, // 18px
      cardHeading: { size: '0.875rem', lineHeight: '1.25rem', weight: 700 },  // 14px
      body: { size: '0.875rem', lineHeight: '1.25rem', weight: 400 },        // 14px
      bodySmall: { size: '0.75rem', lineHeight: '1rem', weight: 400 },       // 12px
      caption: { size: '0.6875rem', lineHeight: '0.875rem', weight: 500 },   // 11px
      metadata: { size: '0.625rem', lineHeight: '0.75rem', weight: 600 },     // 10px
      clinicalLabel: { size: '0.625rem', lineHeight: '0.75rem', weight: 700 } // 10px uppercase
    }
  },

  // Responsive Breakpoints
  breakpoints: {
    sm: '640px',
    md: '768px',
    lg: '1024px',
    xl: '1280px',
    '2xl': '1536px'
  },

  // Layering & Stacking Context
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
export type LifecycleVariant = keyof typeof PDS_TOKENS.color.lifecycle;
export type RadiiSize = keyof typeof PDS_TOKENS.radii;
export type SpacingScale = keyof typeof PDS_TOKENS.spacing;
export type ElevationLevel = keyof typeof PDS_TOKENS.elevation;
