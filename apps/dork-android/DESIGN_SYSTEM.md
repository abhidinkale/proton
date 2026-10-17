# Dork Design System

## 1. Design Philosophy

Dork’s visual language is inspired by Apple-quality craftsmanship:
- **Restrained color palette**: Meaningful semantic color over decorative rainbow charts.
- **Generous whitespace**: Comfortable margins, card padding, and vertical rhythm.
- **Strong typography**: Large display headers, clear labels, and prominent medical numbers (e.g. *13.8 g/dL*, *72 bpm*, *68.5 kg*).
- **Subtle depth**: Refined 1dp borders and soft surface elevations instead of heavy drop shadows or glassmorphism.
- **Tactile feedback**: Subtle press states, fast 150–250ms transitions, and skeleton loading shimmer.

---

## 2. Centralized Tokens

### Color Palette (`Color.kt`)
| Token | Light Theme | Dark Theme | Purpose |
|---|---|---|---|
| `Background` | `#FBFBFA` | `#0F1115` | Clean neutral canvas |
| `Surface` | `#FFFFFF` | `#171A21` | Elevated container surface |
| `SurfaceSecondary` | `#F4F5F6` | `#1F232C` | Card fill & input fields |
| `SurfaceBorder` | `#E5E7EB` | `#2B303C` | Subtle structural division |
| `AccentTeal` (Primary) | `#0F766E` | `#2DD4BF` | Dork signature clinical teal |
| `AccentSlate` (Secondary)| `#0284C7` | `#38BDF8` | Technology & navigation links |
| `Success` | `#059669` | `#34D399` | Taken medications, normal labs |
| `Warning` | `#D97706` | `#FBBF24` | Dues doses, pending approvals |
| `Critical` | `#DC2626` | `#F87171` | Medical ID, severe allergies |

### Spacing Scale (`Spacing.kt`)
`4dp`, `8dp`, `12dp`, `16dp`, `20dp`, `24dp`, `32dp`, `40dp`, `48dp`, `64dp`.
- Minimum touch target: `48dp`.
- Card padding: `18dp`.
- Screen horizontal margin: `20dp`.

### Typography Hierarchy (`Type.kt`)
- `displayLarge` (34sp, Bold, -0.5sp letter spacing)
- `displayMedium` (28sp, SemiBold, -0.3sp letter spacing)
- `headlineLarge` (24sp, SemiBold)
- `headlineMedium` (20sp, SemiBold)
- `titleMedium` (15sp, Medium)
- `bodyLarge` (16sp, Normal, 24sp line height)
- `bodyMedium` (14sp, Normal, 20sp line height)
- `labelLarge` (14sp, SemiBold)

---

## 3. Reusable Components

- **`DorkButton`**: Primary, Secondary, Ghost, and Critical variants with loading spinners.
- **`DorkCard`**: Rounded corners (`16dp` / `20dp`), subtle 1dp borders, and accessible surface colors.
- **`DorkTextField`**: Clear floating labels, placeholder, error message animations, and icon slots.
- **`DorkSearchBar`**: Pill-shaped search bar with clear button and keyboard search action.
- **`DorkTopBar`**: Title, subtitle, navigation back button, and contextual action slots.
- **`DorkBottomNavigation`**: 5 core tabs (Home, Care, Records, Dork AI, Profile) with accessible indicators.
- **`DorkChip`**: Pill-shaped filter and selector chips with selected accent states.
- **`DorkStatusBadge`**: Multi-state badge with color + text for accessibility compliance.
- **`DorkMedicationCard`**: Card displaying scheduled time, dose, instructions, and Taken/Skip actions.
- **`DorkAppointmentCard`**: Displays clinician, time, clinic location, and action buttons.
- **`DorkDoctorCard`**: Displays avatar initials, specialty, qualifications, distance, and booking buttons.
- **`DorkTimelineItem`**: Longitudinal health journey node with date badges and category icons.
- **`DorkEmptyState`**: Meaningful empty states with supportive copy and primary CTA buttons.
- **`DorkErrorState`**: Non-technical friendly error messages with retry actions.
- **`DorkLoadingState`**: Skeleton shimmer cards during asynchronous data fetching.
