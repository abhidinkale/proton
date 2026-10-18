/**
 * PROTON DESIGN SYSTEM (PDS)
 * Master Public API & Design Tokens
 */

// Design Tokens
export {
  PDS_TOKENS,
  type SemanticVariant,
  type LifecycleVariant,
  type RadiiSize,
  type SpacingScale,
  type ElevationLevel
} from '../domain/theme/tokens';

// Core Primitives
export { Button, type ButtonProps, type ButtonVariant, type ButtonSize } from './core/Button';
export { IconButton, type IconButtonProps, type IconButtonVariant, type IconButtonSize } from './core/IconButton';
export { Input, type InputProps } from './core/Input';
export { Textarea, type TextareaProps } from './core/Textarea';
export { Select, type SelectProps, type SelectOption } from './core/Select';
export { Checkbox, type CheckboxProps } from './core/Checkbox';
export { RadioGroup, type RadioGroupProps, type RadioOption } from './core/Radio';
export { Toggle, type ToggleProps } from './core/Toggle';
export { Badge, type BadgeProps, type BadgeVariant } from './core/Badge';
export { Avatar, type AvatarProps, type AvatarSize } from './core/Avatar';
export { Tooltip, type TooltipProps } from './core/Tooltip';
export { Dropdown, type DropdownProps, type DropdownItem } from './core/Dropdown';
export { Tabs, type TabsProps, type TabItem } from './core/Tabs';
export { Breadcrumb, type BreadcrumbProps, type BreadcrumbItem } from './core/Breadcrumb';
export { Pagination, type PaginationProps } from './core/Pagination';

// Layout & Structural Primitives
export { AppShell, type AppShellProps } from './layout/AppShell';
export { Sidebar, type SidebarProps, type NavItem } from './layout/Sidebar';
export { TopBar, type TopBarProps } from './layout/TopBar';
export { PageHeader, type PageHeaderProps } from './layout/PageHeader';
export { Section, type SectionProps } from './layout/Section';
export { Panel, type PanelProps } from './layout/Panel';
export { Card, type CardProps, type CardVariant } from './layout/Card';
export { SplitPane, type SplitPaneProps } from './layout/SplitPane';
export { Drawer, type DrawerProps } from './layout/Drawer';
export { Modal, type ModalProps } from './layout/Modal';

// Clinical Primitives
export { PatientIdentity, type PatientIdentityProps } from './clinical/PatientIdentity';
export { PatientStatus, type PatientStatusProps, type PatientStatusType } from './clinical/PatientStatus';
export { ClinicalBadge, type ClinicalBadgeProps, type ClinicalBadgeType } from './clinical/ClinicalBadge';
export { VitalCard, type VitalCardProps } from './clinical/VitalCard';
export { LabValue, type LabValueProps } from './clinical/LabValue';
export { MedicationItem, type MedicationItemProps } from './clinical/MedicationItem';
export { AllergyItem, type AllergyItemProps } from './clinical/AllergyItem';
export { ClinicalTimeline, type ClinicalTimelineProps, type TimelineEntry } from './clinical/ClinicalTimeline';
export { EncounterCard, type EncounterCardProps } from './clinical/EncounterCard';
export { DiagnosisItem, type DiagnosisItemProps } from './clinical/DiagnosisItem';
export { DocumentCard, type DocumentCardProps } from './clinical/DocumentCard';
export { PhysicianApprovalIndicator, type PhysicianApprovalIndicatorProps } from './clinical/PhysicianApprovalIndicator';

// AI Intelligence & Safety Primitives
export { AIStatus, type AIStatusProps, type AIStatusMode } from './ai/AIStatus';
export { AIGeneratedContent, type AIGeneratedContentProps } from './ai/AIGeneratedContent';
export { AIConfidenceIndicator, type AIConfidenceIndicatorProps, type ConfidenceLevel } from './ai/AIConfidenceIndicator';
export { AIWarning, type AIWarningProps } from './ai/AIWarning';
export { AIRecommendation, type AIRecommendationProps } from './ai/AIRecommendation';
export { AIAction, type AIActionProps } from './ai/AIAction';
export { AIProcessingState, type AIProcessingStateProps } from './ai/AIProcessingState';
export { AIReviewRequired, type AIReviewRequiredProps } from './ai/AIReviewRequired';
