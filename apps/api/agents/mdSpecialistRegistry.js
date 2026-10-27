/**
 * PROTON 68 NMC MD SPECIALIST BOARD REGISTRY
 * 
 * Comprehensive catalog of all 68 National Medical Commission (NMC) MD Specializations
 * mapped into a 3-tier operational hospital board with canonical alias clustering.
 * 
 * TIERS:
 * - Tier 1: Primary & Super-Specialty Clinical Leads (Direct Patient Diagnosis & Treatment Drafting)
 * - Tier 2: Para-Clinical & Diagnostic Consultants (Workup, Lab, Imaging & Pharmacology Verification)
 * - Tier 3: Pre-Clinical & Population Science Advisors (First-Principles Pathophysiology & Epidemiology)
 */

const MD_SPECIALIST_TIERS = {
  TIER_1: 'TIER_1_CLINICAL_LEAD',
  TIER_2: 'TIER_2_PARA_CLINICAL_CONSULTANT',
  TIER_3: 'TIER_3_PRE_CLINICAL_ADVISOR'
};

// Canonical 68 NMC MD Specialization Catalog
const NMC_MD_SPECIALIZATIONS = [
  // =========================================================================
  // TIER 1: CORE CLINICAL & DIRECT SUPER-SPECIALTY LEADS (34 SPECIALIZATIONS)
  // =========================================================================
  {
    id: 'MD_01',
    nmcNumber: 1,
    title: 'MD General Medicine (Internal Medicine)',
    canonicalGroup: 'GENERAL_INTERNAL_MEDICINE',
    tier: MD_SPECIALIST_TIERS.TIER_1,
    operationalRole: 'Chief of Medical Service, Multi-System Synthesis, Polypharmacy Oversight',
    aliases: ['internal medicine', 'general medicine', 'physician', 'adult medicine'],
    keywords: ['fever', 'fatigue', 'diabetes', 'hypertension', 'infection', 'multimorbid', 'dyspnea', 'chest pain', 'edema', 'cold', 'cough'],
    guidelineAuthorities: ['API (Association of Physicians of India)', 'ACP (American College of Physicians)', 'WHO'],
    cptLoincScopes: ['99213', '99214', '99215', '80053', '85025']
  },
  {
    id: 'MD_02',
    nmcNumber: 2,
    title: 'MD Paediatrics',
    canonicalGroup: 'PAEDIATRICS',
    tier: MD_SPECIALIST_TIERS.TIER_1,
    operationalRole: 'Infant, Child & Adolescent Growth, Development & Acute Pediatric Care',
    aliases: ['pediatrics', 'paediatric medicine', 'child specialist'],
    keywords: ['infant', 'child', 'toddler', 'vaccination', 'growth failure', 'pediatric fever', 'stridor', 'croup'],
    guidelineAuthorities: ['IAP (Indian Academy of Pediatrics)', 'AAP (American Academy of Pediatrics)'],
    cptLoincScopes: ['99381', '99382', '99383']
  },
  {
    id: 'MD_03',
    nmcNumber: 3,
    title: 'MD Dermatology, Venereology & Leprosy',
    canonicalGroup: 'DERMATOLOGY_VENEREOLOGY_LEPROSY',
    tier: MD_SPECIALIST_TIERS.TIER_1,
    operationalRole: 'Cutaneous Pathology, Papulosquamous Disorders, Allergic Eruptions & STIs',
    aliases: ['dermatology', 'skin specialist', 'venereology', 'leprology', 'md venereology and leprosy', 'md dermatology'],
    keywords: ['rash', 'urticaria', 'pimples', 'papules', 'macules', 'pruritus', 'itching', 'skin eruption', 'hives', 'facial swelling', 'angioedema', 'eczema', 'psoriasis'],
    guidelineAuthorities: ['IADVL (Indian Association of Dermatologists, Venereologists and Leprologists)', 'AAD'],
    cptLoincScopes: ['11100', '11101', '87210']
  },
  {
    id: 'MD_04',
    nmcNumber: 4,
    title: 'MD Psychiatry',
    canonicalGroup: 'PSYCHIATRY',
    tier: MD_SPECIALIST_TIERS.TIER_1,
    operationalRole: 'Neuropsychiatric Assessment, Affective Disorders, Psychosis & Substance Dependence',
    aliases: ['psychiatry', 'mental health', 'psychiatrist', 'behavioral health'],
    keywords: ['depression', 'anxiety', 'insomnia', 'hallucinations', 'panic', 'bipolar', 'suicidal ideation', 'addiction'],
    guidelineAuthorities: ['IPS (Indian Psychiatric Society)', 'APA (American Psychiatric Association)', 'NICE'],
    cptLoincScopes: ['90791', '90832', '90834']
  },
  {
    id: 'MD_05',
    nmcNumber: 5,
    title: 'MD Emergency Medicine',
    canonicalGroup: 'EMERGENCY_MEDICINE',
    tier: MD_SPECIALIST_TIERS.TIER_1,
    operationalRole: 'Acute Resuscitation, Hemodynamic Stabilization, Toxicological & Trauma Triage',
    aliases: ['emergency medicine', 'er physician', 'casualty', 'urgent care'],
    keywords: ['anaphylaxis', 'cardiac arrest', 'shock', 'trauma', 'hypotension', 'acute poisoning', 'stridor', 'unconscious', 'severe dyspnea'],
    guidelineAuthorities: ['SEMI (Society for Emergency Medicine India)', 'ACEP', 'AHA ACLS'],
    cptLoincScopes: ['99284', '99285', '92950']
  },
  {
    id: 'MD_06',
    nmcNumber: 6,
    title: 'MD Pulmonary Medicine',
    canonicalGroup: 'PULMONARY_RESPIRATORY_MEDICINE',
    tier: MD_SPECIALIST_TIERS.TIER_1,
    operationalRole: 'Obstructive & Restrictive Lung Diseases, Thoracic Infections & Tuberculosis Care',
    aliases: ['respiratory medicine', 'pulmonology', 'chest diseases', 'tuberculosis and chest diseases', 'tuberculosis and respiratory diseases'],
    keywords: ['cough', 'wheezing', 'asthma', 'copd', 'hemoptysis', 'tuberculosis', 'pneumonia', 'pleuritic chest pain', 'shortness of breath'],
    guidelineAuthorities: ['ICS (Indian Chest Society)', 'ATS (American Thoracic Society)', 'GINA', 'GOLD', 'NTEP'],
    cptLoincScopes: ['94010', '94060', '36572-6']
  },
  {
    id: 'MD_07',
    nmcNumber: 7,
    title: 'MD Family Medicine',
    canonicalGroup: 'FAMILY_MEDICINE',
    tier: MD_SPECIALIST_TIERS.TIER_1,
    operationalRole: 'Whole-Person Primary Care, Preventive Lifecycle Health, Chronic Disease Continuity',
    aliases: ['family medicine', 'general practice', 'family physician'],
    keywords: ['primary care', 'health checkup', 'lifestyle', 'preventive', 'family health', 'common cold', 'sore throat'],
    guidelineAuthorities: ['AFPI (Academy of Family Physicians of India)', 'WONCA'],
    cptLoincScopes: ['99203', '99213', '99395']
  },
  {
    id: 'MD_08',
    nmcNumber: 8,
    title: 'MD Physical Medicine & Rehabilitation (PMR)',
    canonicalGroup: 'PHYSICAL_MED_REHAB',
    tier: MD_SPECIALIST_TIERS.TIER_1,
    operationalRole: 'Functional Restoration, Neuro-Rehab, Musculoskeletal Pain & Spinal Injury Management',
    aliases: ['pmr', 'physiatry', 'rehabilitation medicine'],
    keywords: ['paralysis', 'stroke rehab', 'spasticity', 'sciatica', 'back pain', 'amputation', 'neuropathic pain', 'mobility'],
    guidelineAuthorities: ['IAPMR', 'AAPM&R'],
    cptLoincScopes: ['97110', '97750']
  },
  {
    id: 'MD_09',
    nmcNumber: 9,
    title: 'MD Geriatrics',
    canonicalGroup: 'GERIATRICS',
    tier: MD_SPECIALIST_TIERS.TIER_1,
    operationalRole: 'Comprehensive Geriatric Assessment, Frailty Syndromes, Polypharmacy Deprescribing',
    aliases: ['geriatric medicine', 'elderly care', 'gerontology'],
    keywords: ['elderly', 'frailty', 'falls', 'memory loss', 'dementia', 'polypharmacy', 'delirium', 'osteoporosis'],
    guidelineAuthorities: ['Geriatric Society of India', 'AGS (American Geriatrics Society)'],
    cptLoincScopes: ['99214', '99341', '99483']
  },
  {
    id: 'MD_10',
    nmcNumber: 10,
    title: 'MD Sports Medicine',
    canonicalGroup: 'SPORTS_MEDICINE',
    tier: MD_SPECIALIST_TIERS.TIER_1,
    operationalRole: 'Athletic Injuries, Biomechanical Overuse, Exercise Prescription & Return-to-Play',
    aliases: ['sports medicine', 'sports physician'],
    keywords: ['ligament tear', 'sprain', 'concussion', 'athletes', 'runner knee', 'tendonitis', 'sports injury'],
    guidelineAuthorities: ['IASM (Indian Association of Sports Medicine)', 'ACSM'],
    cptLoincScopes: ['29881', '97110']
  },
  {
    id: 'MD_11',
    nmcNumber: 11,
    title: 'MD Palliative Medicine',
    canonicalGroup: 'PALLIATIVE_MEDICINE',
    tier: MD_SPECIALIST_TIERS.TIER_1,
    operationalRole: 'Cancer Pain Management, End-of-Life Symptom Relief, Holistic Supportive Care',
    aliases: ['palliative care', 'hospice medicine'],
    keywords: ['terminal illness', 'refractory pain', 'dyspnea at rest', 'cachexia', 'end of life', 'morphine titration'],
    guidelineAuthorities: ['IAPC (Indian Association of Palliative Care)', 'EAPC'],
    cptLoincScopes: ['99371', '99497']
  },
  {
    id: 'MD_12',
    nmcNumber: 12,
    title: 'MD Infectious Diseases',
    canonicalGroup: 'INFECTIOUS_DISEASES',
    tier: MD_SPECIALIST_TIERS.TIER_1,
    operationalRole: 'Complex Sepsis, Antimicrobial Resistance, Zoonoses, HIV & Systemic Infections',
    aliases: ['infectious diseases', 'id specialist', 'clinical infectious disease'],
    keywords: ['prolonged fever', 'pyrexia of unknown origin', 'puo', 'hiv', 'mdr-tb', 'malaria', 'dengue', 'septicemia', 'bacteremia'],
    guidelineAuthorities: ['CIDS (Clinical Infectious Diseases Society India)', 'IDSA'],
    cptLoincScopes: ['87040', '87070', '87186']
  },
  {
    id: 'MD_13',
    nmcNumber: 13,
    title: 'MD Tropical Medicine',
    canonicalGroup: 'TROPICAL_MEDICINE',
    tier: MD_SPECIALIST_TIERS.TIER_1,
    operationalRole: 'Vector-Borne Epidemics, Parasitic Infections, Helminthiasis & Geo-Climatic Illnesses',
    aliases: ['tropical medicine', 'travel medicine'],
    keywords: ['malaria', 'kala-azar', 'filariasis', 'leptospirosis', 'dengue', 'chikungunya', 'typhoid', 'scrub typhus'],
    guidelineAuthorities: ['National Vector Borne Disease Control Programme (NVBDCP)', 'WHO-SEARO'],
    cptLoincScopes: ['87207', '87802']
  },
  {
    id: 'MD_14',
    nmcNumber: 14,
    title: 'MD Maternal and Child Health',
    canonicalGroup: 'MATERNAL_CHILD_HEALTH',
    tier: MD_SPECIALIST_TIERS.TIER_1,
    operationalRole: 'Perinatal Continuity, Antenatal Risk Stratification, Child Survival & Nutrition',
    aliases: ['mch', 'maternal child health'],
    keywords: ['pregnancy checkup', 'antenatal', 'eclampsia', 'gestational diabetes', 'postpartum', 'child nutrition'],
    guidelineAuthorities: ['FOGSI', 'IAP', 'MOHFW India'],
    cptLoincScopes: ['59400', '99381']
  },
  {
    id: 'MD_15',
    nmcNumber: 15,
    title: 'MD Allergy and Clinical Immunology',
    canonicalGroup: 'ALLERGY_CLINICAL_IMMUNOLOGY',
    tier: MD_SPECIALIST_TIERS.TIER_1,
    operationalRole: 'Anaphylaxis, Food Allergies, Drug Hypersensitivity, Mast Cell & Urticarial Disorders',
    aliases: ['allergy', 'immunology', 'clinical immunology', 'allergist', 'immunologist', 'allergy and immunology'],
    keywords: ['allergy', 'food allergy', 'fruit allergy', 'banana allergy', 'hives', 'urticaria', 'angioedema', 'facial swelling', 'anaphylaxis', 'mast cell', 'ige', 'eosinophilia', 'pruritus', 'rhinitis'],
    guidelineAuthorities: ['WAO (World Allergy Organization)', 'EAACI', 'BSACI', 'Indian College of Allergy'],
    cptLoincScopes: ['86003', '86005', '82785', '19113-0', '26449-9']
  },
  {
    id: 'MD_16',
    nmcNumber: 16,
    title: 'MD Neonatology',
    canonicalGroup: 'NEONATOLOGY',
    tier: MD_SPECIALIST_TIERS.TIER_1,
    operationalRole: 'Newborn Resuscitation, Prematurity, Neonatal Jaundice & Congenital Malformations',
    aliases: ['neonatal medicine', 'nicu specialist'],
    keywords: ['newborn', 'preterm', 'low birth weight', 'neonatal sepsis', 'hyperbilirubinemia', 'rds'],
    guidelineAuthorities: ['NNF (National Neonatology Forum India)', 'AAP'],
    cptLoincScopes: ['99468', '99471']
  },
  {
    id: 'MD_17',
    nmcNumber: 17,
    title: 'MD Cardiology',
    canonicalGroup: 'CARDIOLOGY',
    tier: MD_SPECIALIST_TIERS.TIER_1,
    operationalRole: 'Coronary Syndromes, Valvular Heart Disease, Heart Failure & Arrhythmia Stratification',
    aliases: ['cardiology', 'cardiologist', 'heart specialist'],
    keywords: ['chest pain', 'palpitations', 'syncope', 'angina', 'stemi', 'heart failure', 'troponin', 'ecg', 'edema'],
    guidelineAuthorities: ['CSI (Cardiological Society of India)', 'AHA/ACC', 'ESC'],
    cptLoincScopes: ['93000', '93306', '49563-0']
  },
  {
    id: 'MD_18',
    nmcNumber: 18,
    title: 'MD Neurology',
    canonicalGroup: 'NEUROLOGY',
    tier: MD_SPECIALIST_TIERS.TIER_1,
    operationalRole: 'Acute Stroke Intervention, Seizures, Movement Disorders, Neuropathies & Demyelination',
    aliases: ['neurology', 'neurologist', 'brain specialist'],
    keywords: ['stroke', 'hemiparesis', 'seizure', 'convulsion', 'headache', 'tremor', 'neuropathy', 'facial palsy'],
    guidelineAuthorities: ['IAN (Indian Academy of Neurology)', 'AAN (American Academy of Neurology)', 'ESO'],
    cptLoincScopes: ['95819', '95907', '70553']
  },
  {
    id: 'MD_19',
    nmcNumber: 19,
    title: 'MD Gastroenterology',
    canonicalGroup: 'GASTROENTEROLOGY',
    tier: MD_SPECIALIST_TIERS.TIER_1,
    operationalRole: 'Luminal Disorders, Chronic Liver Disease, Pancreato-Biliary & GI Hemorrhage',
    aliases: ['gastroenterology', 'gi specialist', 'hepatologist'],
    keywords: ['jaundice', 'hematemesis', 'melena', 'abdominal pain', 'ascites', 'cirrhosis', 'pancreatitis', 'diarrhea'],
    guidelineAuthorities: ['ISG (Indian Society of Gastroenterology)', 'ACG', 'AASLD'],
    cptLoincScopes: ['43239', '45380', '1975-2']
  },
  {
    id: 'MD_20',
    nmcNumber: 20,
    title: 'MD Oncology',
    canonicalGroup: 'MEDICAL_ONCOLOGY',
    tier: MD_SPECIALIST_TIERS.TIER_1,
    operationalRole: 'Solid Tumor & Hematologic Malignancy Staging, Systemic Chemotherapy & Immunotherapy',
    aliases: ['medical oncology', 'cancer specialist', 'oncologist'],
    keywords: ['tumor', 'malignancy', 'weight loss', 'lymphadenopathy', 'carcinoma', 'chemotherapy', 'biopsy'],
    guidelineAuthorities: ['ISMPO (Indian Society of Medical & Paediatric Oncology)', 'NCCN', 'ASCO'],
    cptLoincScopes: ['96413', '77067']
  },
  {
    id: 'MD_21',
    nmcNumber: 21,
    title: 'MD Nephrology',
    canonicalGroup: 'NEPHROLOGY',
    tier: MD_SPECIALIST_TIERS.TIER_1,
    operationalRole: 'Acute Kidney Injury, Chronic Glomerulonephritis, Dialysis & Cardiorenal Syndromes',
    aliases: ['nephrology', 'kidney specialist', 'renal medicine'],
    keywords: ['creatinine', 'oliguria', 'proteinuria', 'hematuria', 'dialysis', 'egfr', 'uremia', 'fluid overload'],
    guidelineAuthorities: ['ISN (Indian Society of Nephrology)', 'KDIGO'],
    cptLoincScopes: ['2160-0', '33914-3', '90935']
  },
  {
    id: 'MD_22',
    nmcNumber: 22,
    title: 'MD Endocrinology',
    canonicalGroup: 'ENDOCRINOLOGY',
    tier: MD_SPECIALIST_TIERS.TIER_1,
    operationalRole: 'Complex Diabetes Titration, Thyroid Dysfunctions, Adrenal, Pituitary & Bone Metabolism',
    aliases: ['endocrinology', 'diabetes specialist', 'thyroid specialist'],
    keywords: ['diabetes', 'hba1c', 'hypothyroidism', 'hyperthyroidism', 'cushing', 'addison', 'dka', 'polyuria'],
    guidelineAuthorities: ['ESICON (Endocrine Society of India)', 'ADA 2026', 'AACE'],
    cptLoincScopes: ['4544-3', '3016-3', '80053']
  },
  {
    id: 'MD_23',
    nmcNumber: 23,
    title: 'MD Clinical Haematology',
    canonicalGroup: 'CLINICAL_HAEMATOLOGY',
    tier: MD_SPECIALIST_TIERS.TIER_1,
    operationalRole: 'Hemoglobinopathies, Coagulopathies, Bone Marrow Failures & Leukemias',
    aliases: ['hematology', 'blood specialist', 'haematology'],
    keywords: ['anemia', 'thrombocytopenia', 'petechiae', 'bleeding diathesis', 'leukemia', 'thalassemia', 'hemophilia'],
    guidelineAuthorities: ['ISHTM', 'ASH', 'EHA'],
    cptLoincScopes: ['85025', '85060', '85610']
  },
  {
    id: 'MD_24',
    nmcNumber: 24,
    title: 'MD Immunology & Rheumatology',
    canonicalGroup: 'RHEUMATOLOGY_AUTOIMMUNE',
    tier: MD_SPECIALIST_TIERS.TIER_1,
    operationalRole: 'Systemic Autoimmune Connective Tissue Diseases, Vasculitides & Biologics Therapy',
    aliases: ['rheumatology', 'joint specialist', 'autoimmune specialist', 'md rheumatology'],
    keywords: ['joint pain', 'arthritis', 'lupus', 'sle', 'rheumatoid factor', 'ana positive', 'morning stiffness', 'vasculitis'],
    guidelineAuthorities: ['IRA (Indian Rheumatology Association)', 'ACR', 'EULAR'],
    cptLoincScopes: ['86225', '86431', '86038']
  },
  {
    id: 'MD_25',
    nmcNumber: 25,
    title: 'MD Rheumatology',
    canonicalGroup: 'RHEUMATOLOGY_AUTOIMMUNE',
    tier: MD_SPECIALIST_TIERS.TIER_1,
    operationalRole: 'Inflammatory Arthropathies, Spondylitis, Gout & Crystal Arthropathies',
    aliases: ['rheumatology clinical', 'arthritis medicine'],
    keywords: ['synovitis', 'gout', 'ankylosing spondylitis', 'psoriatic arthritis', 'hyperuricemia'],
    guidelineAuthorities: ['IRA', 'ACR'],
    cptLoincScopes: ['86431', '20610']
  },
  {
    id: 'MD_26',
    nmcNumber: 26,
    title: 'MD Critical Care Medicine',
    canonicalGroup: 'CRITICAL_CARE',
    tier: MD_SPECIALIST_TIERS.TIER_1,
    operationalRole: 'Multi-Organ Dysfunction (MODS), Invasive Mechanical Ventilation & Vasopressor Titration',
    aliases: ['critical care', 'intensivist', 'icu medicine'],
    keywords: ['septic shock', 'ards', 'ventilator', 'vasopressor', 'intubation', 'lactate', 'hypoperfusion'],
    guidelineAuthorities: ['ISCCM (Indian Society of Critical Care Medicine)', 'SCCM Surviving Sepsis'],
    cptLoincScopes: ['99291', '99292', '31500']
  },
  {
    id: 'MD_27',
    nmcNumber: 27,
    title: 'MD Paediatric Neurology',
    canonicalGroup: 'PAEDIATRIC_SUPER_SPECIALTY',
    tier: MD_SPECIALIST_TIERS.TIER_1,
    operationalRole: 'Pediatric Epilepsy Syndromes, Cerebral Palsy, Neurometabolic & Developmental Delays',
    aliases: ['pediatric neurology', 'child neurologist'],
    keywords: ['infantile spasms', 'febrile seizure', 'developmental regression', 'ataxia', 'floppy infant'],
    guidelineAuthorities: ['AOCN (Association of Child Neurology India)', 'CNS'],
    cptLoincScopes: ['95816', '95900']
  },
  {
    id: 'MD_28',
    nmcNumber: 28,
    title: 'MD Paediatric Intensive Care',
    canonicalGroup: 'PAEDIATRIC_SUPER_SPECIALTY',
    tier: MD_SPECIALIST_TIERS.TIER_1,
    operationalRole: 'Pediatric Septic Shock, Status Epilepticus & Severe Acute Malnutrition in PICU',
    aliases: ['picu', 'pediatric intensivist', 'pediatric critical care'],
    keywords: ['pediatric shock', 'picu', 'pediatric ards', 'fluid refractory shock in child'],
    guidelineAuthorities: ['IAP PICU Chapter', 'WFPICCS'],
    cptLoincScopes: ['99471', '99472']
  },
  {
    id: 'MD_29',
    nmcNumber: 29,
    title: 'MD Geriatric Mental Health',
    canonicalGroup: 'GERIATRIC_PSYCHIATRY',
    tier: MD_SPECIALIST_TIERS.TIER_1,
    operationalRole: 'Late-Life Depression, Behavioral & Psychological Symptoms of Dementia (BPSD)',
    aliases: ['geriatric psychiatry', 'psychogeriatrics'],
    keywords: ['alzheimers', 'dementia wandering', 'sundowning', 'late life depression', 'vascular dementia'],
    guidelineAuthorities: ['IPS Geriatric Chapter', 'AAGP'],
    cptLoincScopes: ['90791', '99483']
  },
  {
    id: 'MD_30',
    nmcNumber: 30,
    title: 'MD Child and Adolescent Psychiatry',
    canonicalGroup: 'CHILD_PSYCHIATRY',
    tier: MD_SPECIALIST_TIERS.TIER_1,
    operationalRole: 'ADHD, Autism Spectrum Disorders, Conduct Disorders & School Refusal',
    aliases: ['child psychiatry', 'adolescent psychiatry'],
    keywords: ['adhd', 'autism', 'hyperactivity', 'oppositional defiant', 'childhood trauma', 'learning disability'],
    guidelineAuthorities: ['AACAP', 'IACAM (Indian Association for Child & Adolescent Mental Health)'],
    cptLoincScopes: ['90791', '96116']
  },
  {
    id: 'MD_31',
    nmcNumber: 31,
    title: 'MD Occupational Health',
    canonicalGroup: 'OCCUPATIONAL_HEALTH',
    tier: MD_SPECIALIST_TIERS.TIER_1,
    operationalRole: 'Workplace Ergonomics, Industrial Toxicology, Pneumoconiosis & Fitness for Duty',
    aliases: ['occupational medicine', 'industrial health'],
    keywords: ['silicosis', 'asbestosis', 'lead toxicity at work', 'ergonomic injury', 'occupational asthma'],
    guidelineAuthorities: ['IAOH (Indian Association of Occupational Health)', 'ACOEM'],
    cptLoincScopes: ['99455', '94010']
  },
  {
    id: 'MD_32',
    nmcNumber: 32,
    title: 'MD Nutrition',
    canonicalGroup: 'CLINICAL_NUTRITION',
    tier: MD_SPECIALIST_TIERS.TIER_1,
    operationalRole: 'Total Parenteral Nutrition (TPN), Micronutrient Deficiencies & Metabolic Syndrome Dietetics',
    aliases: ['clinical nutrition', 'nutritional medicine'],
    keywords: ['malnutrition', 'kwashiorkor', 'marasmus', 'vitamin deficiency', 'tpn', 'cachexia diet', 'obesity'],
    guidelineAuthorities: ['IDA (Indian Dietetic Association)', 'ASPEN', 'ESPEN'],
    cptLoincScopes: ['97802', '97803']
  },
  {
    id: 'MD_33',
    nmcNumber: 33,
    title: 'MD Marine Medicine',
    canonicalGroup: 'ENVIRONMENTAL_MEDICINE',
    tier: MD_SPECIALIST_TIERS.TIER_1,
    operationalRole: 'Diving Medicine, Decompression Sickness, Hyperbaric Oxygen & Maritime Health',
    aliases: ['undersea medicine', 'diving medicine', 'naval medicine'],
    keywords: ['decompression sickness', 'bends', 'hyperbaric oxygen', 'barotrauma', 'submersion injury'],
    guidelineAuthorities: ['UHMS (Undersea and Hyperbaric Medical Society)', 'Indian Navy Medical Services'],
    cptLoincScopes: ['99183']
  },
  {
    id: 'MD_34',
    nmcNumber: 34,
    title: 'MD Aerospace Medicine',
    canonicalGroup: 'ENVIRONMENTAL_MEDICINE',
    tier: MD_SPECIALIST_TIERS.TIER_1,
    operationalRole: 'Aviation Physiology, Spatial Disorientation, Hypoxia & Pilot Medical Certification',
    aliases: ['aviation medicine', 'flight surgeon'],
    keywords: ['hypoxia at altitude', 'spatial disorientation', 'g-force syncope', 'cabin pressure', 'pilot fitness'],
    guidelineAuthorities: ['ISAM (Indian Society of Aerospace Medicine)', 'AsMA', 'DGCA India'],
    cptLoincScopes: ['99450']
  },

  // =========================================================================
  // TIER 2: PARA-CLINICAL & DIAGNOSTIC CONSULTANTS (17 SPECIALIZATIONS)
  // =========================================================================
  {
    id: 'MD_PARA_01',
    nmcNumber: 35,
    title: 'MD Pathology',
    canonicalGroup: 'PATHOLOGY_LABORATORY',
    tier: MD_SPECIALIST_TIERS.TIER_2,
    operationalRole: 'Histopathology, Cytopathology, Biopsy Interpretation & Hematological Morphometry',
    aliases: ['pathology', 'pathologist', 'surgical pathology'],
    keywords: ['biopsy', 'histology', 'malignant cells', 'cytology', 'fine needle aspiration', 'fnac', 'smear'],
    guidelineAuthorities: ['IAPM (Indian Association of Pathologists and Microbiologists)', 'CAP'],
    cptLoincScopes: ['88305', '88173', '88342']
  },
  {
    id: 'MD_PARA_02',
    nmcNumber: 36,
    title: 'MD Laboratory Medicine',
    canonicalGroup: 'PATHOLOGY_LABORATORY',
    tier: MD_SPECIALIST_TIERS.TIER_2,
    operationalRole: 'Clinical Chemistry Quality, Automated Panel Diagnostics, Reference Range Standards',
    aliases: ['laboratory medicine', 'clinical pathology', 'lab specialist'],
    keywords: ['loinc mapping', 'critical high lab', 'delta check', 'interference', 'reference interval', 'cbc', 'cmp', 'aec', 'ige'],
    guidelineAuthorities: ['ACBI (Association of Clinical Biochemists of India)', 'CLSI', 'IFCC'],
    cptLoincScopes: ['80053', '85025', '26449-9', '19113-0']
  },
  {
    id: 'MD_PARA_03',
    nmcNumber: 37,
    title: 'MD Pharmacology',
    canonicalGroup: 'PHARMACOLOGY_SAFETY',
    tier: MD_SPECIALIST_TIERS.TIER_2,
    operationalRole: 'Therapeutic Drug Monitoring (TDM), CYP450 Pharmacokinetics, DDI Matrix & Adverse Events',
    aliases: ['clinical pharmacology', 'pharmacology', 'drug specialist'],
    keywords: ['drug interaction', 'cyp450', 'half life', 'renal clearance', 'adverse drug reaction', 'adr', 'dosage calculation', 'food drug timing'],
    guidelineAuthorities: ['IPS (Indian Pharmacological Society)', 'FDA', 'CDSCO India', 'WHO PV'],
    cptLoincScopes: ['80156', '80164']
  },
  {
    id: 'MD_PARA_04',
    nmcNumber: 38,
    title: 'MD Microbiology',
    canonicalGroup: 'MICROBIOLOGY_VIROLOGY',
    tier: MD_SPECIALIST_TIERS.TIER_2,
    operationalRole: 'Bacterial Cultures, Antimicrobial Sensitivity Panels, Fungal & Parasitic Smears',
    aliases: ['medical microbiology', 'microbiologist'],
    keywords: ['gram stain', 'blood culture', 'antibiogram', 'mrsa', 'fungal hyphae', 'acid fast bacilli', 'afb'],
    guidelineAuthorities: ['IAMM (Indian Association of Medical Microbiologists)', 'EUCAST', 'CLSI'],
    cptLoincScopes: ['87040', '87070', '87205']
  },
  {
    id: 'MD_PARA_05',
    nmcNumber: 39,
    title: 'MD Virology',
    canonicalGroup: 'MICROBIOLOGY_VIROLOGY',
    tier: MD_SPECIALIST_TIERS.TIER_2,
    operationalRole: 'Viral PCR Panels, Viral Load Kinetics, Serological Titers & Emerging Viral Surveillance',
    aliases: ['clinical virology', 'virologist'],
    keywords: ['viral load', 'real time pcr', 'influenza pcr', 'hepatitis b dna', 'covid pcr', 'dengue ns1'],
    guidelineAuthorities: ['NIV Pune (National Institute of Virology)', 'WHO'],
    cptLoincScopes: ['87502', '87517', '87798']
  },
  {
    id: 'MD_PARA_06',
    nmcNumber: 40,
    title: 'MD Immunohematology & Blood Transfusion',
    canonicalGroup: 'TRANSFUSION_MEDICINE',
    tier: MD_SPECIALIST_TIERS.TIER_2,
    operationalRole: 'Blood Banking, Component Therapy, Apheresis & Alloimmunization Management',
    aliases: ['transfusion medicine', 'blood bank specialist'],
    keywords: ['blood cross match', 'packed red cells', 'prbc', 'fresh frozen plasma', 'platelet concentrate', 'hemolytic transfusion reaction'],
    guidelineAuthorities: ['ISBTI (Indian Society of Blood Transfusion and Immunohaematology)', 'AABB'],
    cptLoincScopes: ['86900', '86901', '86920']
  },
  {
    id: 'MD_PARA_07',
    nmcNumber: 41,
    title: 'MD Forensic Medicine & Toxicology',
    canonicalGroup: 'FORENSIC_TOXICOLOGY',
    tier: MD_SPECIALIST_TIERS.TIER_2,
    operationalRole: 'Clinical Forensic Examinations, Envenomation, Poisoning Toxidromes & Medico-Legal Care',
    aliases: ['forensic medicine', 'toxicology', 'fmt specialist', 'medical jurist'],
    keywords: ['snake bite envenomation', 'organophosphate poisoning', 'overdose toxidrome', 'medico-legal injury', 'arsenic toxicity'],
    guidelineAuthorities: ['IAFM (Indian Academy of Forensic Medicine)', 'AACT'],
    cptLoincScopes: ['80307', '80320']
  },
  {
    id: 'MD_PARA_08',
    nmcNumber: 42,
    title: 'MD Radio-diagnosis (Radiology)',
    canonicalGroup: 'DIAGNOSTIC_IMAGING',
    tier: MD_SPECIALIST_TIERS.TIER_2,
    operationalRole: 'Cross-Sectional Imaging (CT, MRI), Ultrasound, Radiographic Interpretation & Rad-Safety',
    aliases: ['radiology', 'radiodiagnosis', 'radiologist'],
    keywords: ['x-ray', 'ct scan', 'mri', 'ultrasound', 'consolidation on cxr', 'filling defect ctpa', 'radiopacity'],
    guidelineAuthorities: ['IRIA (Indian Radiological and Imaging Association)', 'RSNA', 'ACR'],
    cptLoincScopes: ['71046', '71275', '70553', '74177', '30743-9']
  },
  {
    id: 'MD_PARA_09',
    nmcNumber: 43,
    title: 'MD Nuclear Medicine',
    canonicalGroup: 'DIAGNOSTIC_IMAGING',
    tier: MD_SPECIALIST_TIERS.TIER_2,
    operationalRole: 'PET-CT Metabolic Imaging, SPECT, Radioisotope Scintigraphy & Theranostics',
    aliases: ['nuclear medicine', 'pet ct specialist'],
    keywords: ['pet scan', 'fdg avidity', 'spect', 'bone scan', 'thyroid uptake scan', 'radioiodine'],
    guidelineAuthorities: ['SNMI (Society of Nuclear Medicine India)', 'SNMMI'],
    cptLoincScopes: ['78815', '78306']
  },
  {
    id: 'MD_PARA_10',
    nmcNumber: 44,
    title: 'MD Radiotherapy (Radiation Oncology)',
    canonicalGroup: 'RADIATION_SCIENCES',
    tier: MD_SPECIALIST_TIERS.TIER_2,
    operationalRole: 'Linear Accelerator Planning, IMRT/IGRT, Brachytherapy & Stereotactic Radiosurgery',
    aliases: ['radiation oncology', 'radiotherapy'],
    keywords: ['radiation therapy', 'imrt', 'brachytherapy', 'radiation dose', 'tumor bed radiation'],
    guidelineAuthorities: ['AROI (Association of Radiation Oncologists of India)', 'ASTRO'],
    cptLoincScopes: ['77301', '77427']
  },
  {
    id: 'MD_PARA_11',
    nmcNumber: 45,
    title: 'MD Radiation Medicine',
    canonicalGroup: 'RADIATION_SCIENCES',
    tier: MD_SPECIALIST_TIERS.TIER_2,
    operationalRole: 'Nuclear Disaster Medical Triage, Radiation Sickness & Radioprotection',
    aliases: ['radiation medicine specialist'],
    keywords: ['acute radiation syndrome', 'radiation exposure', 'biodosimetry'],
    guidelineAuthorities: ['AERB India (Atomic Energy Regulatory Board)', 'IAEA'],
    cptLoincScopes: ['77263']
  },
  {
    id: 'MD_PARA_12',
    nmcNumber: 46,
    title: 'MD Radiological Physics',
    canonicalGroup: 'RADIATION_SCIENCES',
    tier: MD_SPECIALIST_TIERS.TIER_2,
    operationalRole: 'Radiation Dosimetry, Machine Calibration, Image Artifact Rectification & Shielding',
    aliases: ['medical physics', 'radiological physics'],
    keywords: ['dosimetry', 'alara', 'gy dose', 'radiation calibration'],
    guidelineAuthorities: ['AMPI (Association of Medical Physicists of India)', 'AAPM'],
    cptLoincScopes: ['77336']
  },
  {
    id: 'MD_PARA_13',
    nmcNumber: 47,
    title: 'MD Anaesthesiology',
    canonicalGroup: 'ANAESTHESIA_PERIOPERATIVE',
    tier: MD_SPECIALIST_TIERS.TIER_2,
    operationalRole: 'Pre-Anesthetic Evaluation, Difficult Airway Algorithm, Hemodynamic Monitoring & Pain Control',
    aliases: ['anesthesiology', 'anaesthesia', 'anaesthetist'],
    keywords: ['asa physical status', 'mallampati score', 'endotracheal intubation', 'spinal anesthesia', 'general anesthesia'],
    guidelineAuthorities: ['ISA (Indian Society of Anaesthesiologists)', 'ASA (American Society of Anesthesiologists)'],
    cptLoincScopes: ['00100', '99100', '31500']
  },
  {
    id: 'MD_PARA_14',
    nmcNumber: 48,
    title: 'MD Neuro Anaesthesia & Critical Care',
    canonicalGroup: 'ANAESTHESIA_PERIOPERATIVE',
    tier: MD_SPECIALIST_TIERS.TIER_2,
    operationalRole: 'Intracranial Pressure (ICP) Control, Cerebral Perfusion & Intraoperative Neuro-Monitoring',
    aliases: ['neuroanaesthesia', 'neuro intensive care'],
    keywords: ['cerebral perfusion pressure', 'elevated icp', 'craniotomy anesthesia', 'evoked potentials'],
    guidelineAuthorities: ['ISNACC (Indian Society of Neuroanaesthesiology and Critical Care)', 'SNACC'],
    cptLoincScopes: ['00210']
  },
  {
    id: 'MD_PARA_15',
    nmcNumber: 49,
    title: 'MD Cardiac Anaesthesia',
    canonicalGroup: 'ANAESTHESIA_PERIOPERATIVE',
    tier: MD_SPECIALIST_TIERS.TIER_2,
    operationalRole: 'Cardiopulmonary Bypass Monitoring, Transesophageal Echocardiography (TEE) & Inotropes',
    aliases: ['cardiac anaesthesia', 'cardiac anesthesiologist'],
    keywords: ['tee intraoperative', 'cardiopulmonary bypass', 'afterload reduction', 'weaning from pump'],
    guidelineAuthorities: ['IACTA (Indian Association of Cardiovascular Thoracic Anaesthesiologists)', 'SCA'],
    cptLoincScopes: ['00562', '93312']
  },
  {
    id: 'MD_PARA_16',
    nmcNumber: 50,
    title: 'MD Organ Transplant Anaesthesia',
    canonicalGroup: 'ANAESTHESIA_PERIOPERATIVE',
    tier: MD_SPECIALIST_TIERS.TIER_2,
    operationalRole: 'Liver & Renal Transplant Reperfusion Syndrome, Coagulopathy & Hemodynamic Stability',
    aliases: ['transplant anaesthesia'],
    keywords: ['reperfusion syndrome', 'anhepatic phase', 'thromboelastography', 'graft survival'],
    guidelineAuthorities: ['Indian Society of Organ Transplantation (ISOT)'],
    cptLoincScopes: ['00796', '00868']
  },
  {
    id: 'MD_PARA_17',
    nmcNumber: 51,
    title: 'MD Paediatric & Neonatal Anaesthesia',
    canonicalGroup: 'ANAESTHESIA_PERIOPERATIVE',
    tier: MD_SPECIALIST_TIERS.TIER_2,
    operationalRole: 'Pediatric Airway Physics, Micro-Laryngeal Anesthesia & Weight-Calibrated Drug Dilutions',
    aliases: ['pediatric anaesthesia'],
    keywords: ['pediatric laryngospasm', 'microcuff tube', 'weight based volatile anesthetic'],
    guidelineAuthorities: ['IAPA (Indian Association of Paediatric Anaesthesiologists)', 'SPA'],
    cptLoincScopes: ['00100', '99100']
  },

  // =========================================================================
  // TIER 3: PRE-CLINICAL & POPULATION SCIENCE ADVISORS (17 SPECIALIZATIONS)
  // =========================================================================
  {
    id: 'MD_PRE_01',
    nmcNumber: 52,
    title: 'MD Anatomy',
    canonicalGroup: 'BASIC_MEDICAL_SCIENCES',
    tier: MD_SPECIALIST_TIERS.TIER_3,
    operationalRole: 'Fascial Plane Spread, Neuro-Vascular Topography, Dermatomal & Referred Pain Pathways',
    aliases: ['anatomy', 'clinical anatomy'],
    keywords: ['dermatome', 'fascial space', 'neurovascular bundle', 'lymphatic drainage path'],
    guidelineAuthorities: ['Anatomical Society of India (ASI)'],
    cptLoincScopes: []
  },
  {
    id: 'MD_PRE_02',
    nmcNumber: 53,
    title: 'MD Physiology',
    canonicalGroup: 'BASIC_MEDICAL_SCIENCES',
    tier: MD_SPECIALIST_TIERS.TIER_3,
    operationalRole: 'Cellular Action Potentials, Cardiopulmonary Homeostasis, Autonomic Balance & Endocrine Feedback',
    aliases: ['physiology', 'clinical physiology'],
    keywords: ['autonomic tone', 'mast cell degranulation', 'action potential', 'starling forces', 'baroreceptor reflex', 'acid base buffer'],
    guidelineAuthorities: ['APPI (Association of Physiologists and Pharmacologists of India)'],
    cptLoincScopes: []
  },
  {
    id: 'MD_PRE_03',
    nmcNumber: 54,
    title: 'MD Biochemistry',
    canonicalGroup: 'BASIC_MEDICAL_SCIENCES',
    tier: MD_SPECIALIST_TIERS.TIER_3,
    operationalRole: 'Inborn Errors of Metabolism, Receptor Signal Transduction, Histamine Pathways & Biomarkers',
    aliases: ['biochemistry', 'medical biochemistry'],
    keywords: ['mast cell degranulation', 'ige mediation', 'histamine release', 'leukotrienes', 'prostaglandins', 'chitinase cross reactivity', 'enzymatic kinetics'],
    guidelineAuthorities: ['AMBSI (Association of Medical Biochemists of India)', 'IUBMB'],
    cptLoincScopes: []
  },
  {
    id: 'MD_PRE_04',
    nmcNumber: 55,
    title: 'MD Biophysics',
    canonicalGroup: 'BASIC_MEDICAL_SCIENCES',
    tier: MD_SPECIALIST_TIERS.TIER_3,
    operationalRole: 'Membrane Transport Energetics, Ion Channel Kinetics & Optical Laser Diagnostics',
    aliases: ['biophysics', 'medical biophysics'],
    keywords: ['membrane potential', 'ion channel gating', 'molecular mechanics'],
    guidelineAuthorities: ['Indian Biophysical Society (IBS)'],
    cptLoincScopes: []
  },
  {
    id: 'MD_PRE_05',
    nmcNumber: 56,
    title: 'MD Medical Genetics',
    canonicalGroup: 'BASIC_MEDICAL_SCIENCES',
    tier: MD_SPECIALIST_TIERS.TIER_3,
    operationalRole: 'Mendelian Pedigree Analysis, Next-Gen Sequencing (NGS), Karyotyping & Pharmacogenomics',
    aliases: ['medical genetics', 'clinical geneticist'],
    keywords: ['chromosomal abnormality', 'monogenic mutation', 'brca', 'cyp2c19 polymorphism', 'pedigree chart', 'carrier screening'],
    guidelineAuthorities: ['SIAMGEN (Society of Indian Academy of Medical Genetics)', 'ACMG'],
    cptLoincScopes: ['81200', '81408']
  },
  {
    id: 'MD_PRE_06',
    nmcNumber: 57,
    title: 'MD Community Medicine',
    canonicalGroup: 'COMMUNITY_POPULATION_HEALTH',
    tier: MD_SPECIALIST_TIERS.TIER_3,
    operationalRole: 'Epidemiological Outbreak Investigation, Mass Immunization, Environmental Water/Food Hygiene',
    aliases: ['community medicine', 'psm', 'preventive and social medicine', 'md preventive and social medicine'],
    keywords: ['outbreak', 'street food contamination', 'unfiltered water', 'rain surge', 'epidemic cluster', 'vaccine schedule', 'sanitation'],
    guidelineAuthorities: ['IAPSM (Indian Association of Preventive and Social Medicine)', 'MOHFW India', 'WHO'],
    cptLoincScopes: []
  },
  {
    id: 'MD_PRE_07',
    nmcNumber: 58,
    title: 'MD Preventive & Social Medicine',
    canonicalGroup: 'COMMUNITY_POPULATION_HEALTH',
    tier: MD_SPECIALIST_TIERS.TIER_3,
    operationalRole: 'Primary Health Center Surveillance, Vector Control & Lifestyle NCD Prevention',
    aliases: ['psm clinical', 'preventive medicine'],
    keywords: ['primary prevention', 'vector breeding', 'hygiene audit', 'community contact tracing'],
    guidelineAuthorities: ['IAPSM'],
    cptLoincScopes: []
  },
  {
    id: 'MD_PRE_08',
    nmcNumber: 59,
    title: 'MD Public Health',
    canonicalGroup: 'COMMUNITY_POPULATION_HEALTH',
    tier: MD_SPECIALIST_TIERS.TIER_3,
    operationalRole: 'Population Health Metrics, Epidemiological Surveillance & Antimicrobial Policy',
    aliases: ['public health'],
    keywords: ['incidence rate', 'morbidity survey', 'public health advisory'],
    guidelineAuthorities: ['IPHA (Indian Public Health Association)'],
    cptLoincScopes: []
  },
  {
    id: 'MD_PRE_09',
    nmcNumber: 60,
    title: 'MD Field Epidemiology',
    canonicalGroup: 'COMMUNITY_POPULATION_HEALTH',
    tier: MD_SPECIALIST_TIERS.TIER_3,
    operationalRole: 'Point-Source Food/Waterborne Outbreak Tracing & Spatiotemporal Case Mapping',
    aliases: ['epidemiology', 'field epidemiologist'],
    keywords: ['point source outbreak', 'foodborne cluster', 'attack rate', 'incubation period'],
    guidelineAuthorities: ['NCDC India (National Centre for Disease Control)', 'CDC FETP'],
    cptLoincScopes: []
  },
  {
    id: 'MD_PRE_10',
    nmcNumber: 61,
    title: 'MD Health Education',
    canonicalGroup: 'COMMUNITY_POPULATION_HEALTH',
    tier: MD_SPECIALIST_TIERS.TIER_3,
    operationalRole: 'Patient Comprehension Design, Treatment Adherence Psychology & Visual Discharge Guidance',
    aliases: ['health education', 'patient communication'],
    keywords: ['plain language summary', 'health literacy', 'adherence barrier', 'patient education'],
    guidelineAuthorities: ['CHEB India (Central Health Education Bureau)'],
    cptLoincScopes: []
  },
  {
    id: 'MD_PRE_11',
    nmcNumber: 62,
    title: 'MD Health Administration',
    canonicalGroup: 'HEALTH_SYSTEMS',
    tier: MD_SPECIALIST_TIERS.TIER_3,
    operationalRole: 'Quality Assurance, Clinical Audit Protocols & Health Information Exchange Standards',
    aliases: ['health administration', 'healthcare management'],
    keywords: ['nabh audit', 'clinical governance', 'standard operating procedure'],
    guidelineAuthorities: ['NABH India', 'QCI'],
    cptLoincScopes: []
  },
  {
    id: 'MD_PRE_12',
    nmcNumber: 63,
    title: 'MD Hospital Administration',
    canonicalGroup: 'HEALTH_SYSTEMS',
    tier: MD_SPECIALIST_TIERS.TIER_3,
    operationalRole: 'Bed Capacity Management, Infection Control Infrastructure & Pharmacy Formulary Logistics',
    aliases: ['hospital administration', 'medical superintendent'],
    keywords: ['hospital acquired infection', 'sterilization cycle', 'formulary stock'],
    guidelineAuthorities: ['AHA India (Academy of Hospital Administration)'],
    cptLoincScopes: []
  },
  // Canonical links and remaining direct specializations completing the 68 NMC catalog
  {
    id: 'MD_64',
    nmcNumber: 64,
    title: 'MD Respiratory Medicine',
    canonicalGroup: 'PULMONARY_RESPIRATORY_MEDICINE',
    tier: MD_SPECIALIST_TIERS.TIER_1,
    operationalRole: 'Acute Bronchospastic Disorders, Inhaler Technique Verification & Spirometry',
    aliases: ['respiratory diseases', 'md respiratory medicine'],
    keywords: ['bronchospasm', 'inhaler', 'wheezing', 'rhonchi', 'cough with expectoration'],
    guidelineAuthorities: ['ICS', 'ATS'],
    cptLoincScopes: ['94010']
  },
  {
    id: 'MD_65',
    nmcNumber: 65,
    title: 'MD Tuberculosis & Respiratory Diseases',
    canonicalGroup: 'PULMONARY_RESPIRATORY_MEDICINE',
    tier: MD_SPECIALIST_TIERS.TIER_1,
    operationalRole: 'Acid-Fast Bacilli Detection, GeneXpert MTB/RIF & Second-Line Antitubercular Therapy',
    aliases: ['tuberculosis specialist', 'tb chest diseases'],
    keywords: ['hemoptysis', 'night sweats', 'tuberculosis', 'genexpert', 'mantoux'],
    guidelineAuthorities: ['NTEP India', 'WHO'],
    cptLoincScopes: ['87556', '86580']
  },
  {
    id: 'MD_66',
    nmcNumber: 66,
    title: 'MD Venereology & Leprosy',
    canonicalGroup: 'DERMATOLOGY_VENEREOLOGY_LEPROSY',
    tier: MD_SPECIALIST_TIERS.TIER_1,
    operationalRole: 'Hansen Disease Nerve Palpation, Slit-Skin Smears & Genital Ulcerative Diseases',
    aliases: ['leprosy specialist', 'venereologist'],
    keywords: ['hypopigmented patch', 'thickened nerve', 'claw hand', 'syphilis', 'genital ulcer'],
    guidelineAuthorities: ['NLEP India', 'IADVL'],
    cptLoincScopes: ['87205']
  },
  {
    id: 'MD_67',
    nmcNumber: 67,
    title: 'MD Tuberculosis & Chest Diseases',
    canonicalGroup: 'PULMONARY_RESPIRATORY_MEDICINE',
    tier: MD_SPECIALIST_TIERS.TIER_1,
    operationalRole: 'Cavitory Lung Lesions, Pleural Effusions & Thoracentesis Coordination',
    aliases: ['chest physician', 'tuberculosis and chest'],
    keywords: ['pleural tap', 'thoracentesis', 'exudative effusion', 'adenosine deaminase ada'],
    guidelineAuthorities: ['ICS', 'ATS'],
    cptLoincScopes: ['32554']
  },
  {
    id: 'MD_68',
    nmcNumber: 68,
    title: 'MD Dermatology',
    canonicalGroup: 'DERMATOLOGY_VENEREOLOGY_LEPROSY',
    tier: MD_SPECIALIST_TIERS.TIER_1,
    operationalRole: 'Dermatosurgical Interventions, Patch Testing & Complex Inflammatory Dermatoses',
    aliases: ['dermatologist', 'skin physician'],
    keywords: ['papule', 'pimple', 'erythema', 'pruritus', 'urticaria', 'patch test'],
    guidelineAuthorities: ['IADVL', 'AAD'],
    cptLoincScopes: ['95044', '11100']
  }
];

class MDSpecialistRegistry {
  constructor() {
    this._specialists = NMC_MD_SPECIALIZATIONS;
    this._indexById = new Map();
    this._aliasMap = new Map();
    this._groupMap = new Map();
    this._buildIndexes();
  }

  _buildIndexes() {
    for (const spec of this._specialists) {
      this._indexById.set(spec.id, spec);
      
      // Index title
      this._aliasMap.set(spec.title.toLowerCase(), spec);
      
      // Index group
      if (!this._groupMap.has(spec.canonicalGroup)) {
        this._groupMap.set(spec.canonicalGroup, []);
      }
      this._groupMap.get(spec.canonicalGroup).push(spec);

      // Index aliases
      for (const alias of spec.aliases || []) {
        this._aliasMap.set(alias.toLowerCase(), spec);
      }
    }
  }

  getAllSpecialists() {
    return this._specialists;
  }

  getTotalCount() {
    return this._specialists.length;
  }

  getSpecialistById(id) {
    return this._indexById.get(id) || null;
  }

  /**
   * Resolves any query string, title, or alias to the canonical MD Specialization.
   * Prevents router confidence splits across synonymous titles.
   */
  resolveCanonicalSpecialist(query) {
    if (!query || typeof query !== 'string') return null;
    const clean = query.trim().toLowerCase();

    // Direct alias hit
    if (this._aliasMap.has(clean)) {
      return this._aliasMap.get(clean);
    }

    // Substring token match
    for (const [alias, spec] of this._aliasMap.entries()) {
      if (clean.includes(alias) || alias.includes(clean)) {
        return spec;
      }
    }

    return null;
  }

  /**
   * Retrieves all specialists belonging to a tier.
   */
  getByTier(tier) {
    return this._specialists.filter(s => s.tier === tier);
  }

  /**
   * Scores and matches patient symptoms/triggers to the top Tier-1 Clinical Leads.
   */
  routeTier1ClinicalLeads(symptomsAndContext = '', maxLeads = 3) {
    const text = String(symptomsAndContext || '').toLowerCase();
    const scored = [];

    const tier1Specs = this.getByTier(MD_SPECIALIST_TIERS.TIER_1);

    for (const spec of tier1Specs) {
      let score = 0;
      for (const kw of spec.keywords) {
        if (text.includes(kw)) {
          // Weight exact or high-specificity keywords higher
          score += (kw.length > 5 ? 3 : 1);
        }
      }

      // Default baseline priority for General Medicine in multimorbid presentations
      if (spec.id === 'MD_01' && score > 0) {
        score += 2;
      }

      if (score > 0) {
        scored.push({
          specialist: spec,
          score
        });
      }
    }

    // Sort descending by score
    scored.sort((a, b) => b.score - a.score);

    // If no specific match, default to General Medicine
    if (scored.length === 0) {
      return [{
        id: 'MD_01',
        title: 'MD General Medicine (Internal Medicine)',
        confidence: 0.85,
        canonicalGroup: 'GENERAL_INTERNAL_MEDICINE'
      }];
    }

    const topScore = scored[0].score;
    return scored.slice(0, maxLeads).map(item => ({
      id: item.specialist.id,
      title: item.specialist.title,
      confidence: Math.min(0.96, Math.max(0.70, Number((0.75 + (item.score / (topScore * 4))).toFixed(2)))),
      canonicalGroup: item.specialist.canonicalGroup
    }));
  }
}

const mdSpecialistRegistry = new MDSpecialistRegistry();

module.exports = {
  MD_SPECIALIST_TIERS,
  NMC_MD_SPECIALIZATIONS,
  MDSpecialistRegistry,
  mdSpecialistRegistry
};
