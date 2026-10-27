import sys
import os
from fpdf import FPDF
from fpdf.enums import XPos, YPos

def clean_text(s):
    if not isinstance(s, str):
        return s
    replacements = {
        '•': '-',
        '→': '->',
        '←': '<-',
        '–': '-',
        '—': '--',
        '’': "'",
        '‘': "'",
        '“': '"',
        '”': '"',
        'μ': 'u',
        '≥': '>=',
        '≤': '<=',
        '°': ' deg ',
        '±': '+/-',
        '×': 'x',
        'α': 'alpha',
        'β': 'beta',
        'γ': 'gamma'
    }
    for k, v in replacements.items():
        s = s.replace(k, v)
    return s.encode('latin-1', 'replace').decode('latin-1')

class ClinicalPDF(FPDF):
    def __init__(self):
        super().__init__(orientation='P', unit='mm', format='A4')
        self.set_auto_page_break(auto=True, margin=14)
        self.set_margins(14, 12, 14)

    def header(self):
        if self.page_no() > 1:
            self.set_font('Helvetica', 'I', 7.2)
            self.set_text_color(100, 110, 125)
            self.cell(0, 4.5, clean_text('EPISTEMIC CLINICAL CONSULTATION | CASE: MAYA R. (34F) - PROTON DIAGNOSTIC OS'), border=0, align='L', new_x=XPos.LMARGIN, new_y=YPos.NEXT)
            self.set_draw_color(215, 222, 232)
            self.line(14, self.get_y(), 196, self.get_y())
            self.ln(2.0)

    def footer(self):
        self.set_y(-11)
        self.set_font('Helvetica', 'I', 7.2)
        self.set_text_color(135, 145, 160)
        self.cell(0, 5, clean_text(f'Proton Epistemic Medical Intelligence  |  Page {self.page_no()} of {{nb}}  |  Calibrated Probabilistic Framework'), border=0, align='C')

    def chapter_title(self, num_str, title_str):
        self.set_font('Helvetica', 'B', 9.2)
        self.set_fill_color(22, 40, 70) # Deep Navy
        self.set_text_color(255, 255, 255)
        self.cell(0, 5.5, clean_text(f'  {num_str}. {title_str.upper()}'), fill=True, new_x=XPos.LMARGIN, new_y=YPos.NEXT)
        self.ln(1.2)

    def section_heading(self, title):
        self.set_font('Helvetica', 'B', 8.2)
        self.set_text_color(16, 48, 96) # Slate Blue
        self.cell(0, 4.2, clean_text(title), new_x=XPos.LMARGIN, new_y=YPos.NEXT)
        self.ln(0.5)

    def body_paragraph(self, text, style=''):
        self.set_font('Helvetica', style, 7.6)
        self.set_text_color(30, 40, 55)
        self.multi_cell(0, 3.5, clean_text(text))
        self.ln(1.2)

    def callout_box(self, title, text, bg_rgb=(245, 248, 255), border_rgb=(70, 120, 200), title_rgb=(18, 52, 102)):
        self.set_fill_color(*bg_rgb)
        self.set_draw_color(*border_rgb)
        self.set_line_width(0.3)
        y_start = self.get_y()
        self.rect(14, y_start, 182, 1.2, style='F') # Top accent border
        
        self.set_font('Helvetica', 'B', 8.2)
        self.set_text_color(*title_rgb)
        self.set_xy(16, y_start + 1.8)
        self.cell(178, 3.8, clean_text(title), new_x=XPos.LMARGIN, new_y=YPos.NEXT)
        
        self.set_font('Helvetica', '', 7.5)
        self.set_text_color(28, 38, 52)
        self.set_x(16)
        self.multi_cell(178, 3.3, clean_text(text))
        box_h = (self.get_y() - y_start) + 1.8
        
        self.rect(14, y_start, 182, box_h, style='D')
        self.set_xy(14, y_start + box_h + 2.0)

def generate_pdf(output_path):
    pdf = ClinicalPDF()
    pdf.alias_nb_pages()
    
    # ==================== PAGE 1 ====================
    pdf.add_page()

    # --- COVER / TITLE BLOCK ---
    pdf.set_fill_color(16, 32, 60) # Midnight Navy
    pdf.rect(14, 12, 182, 25, style='F')

    pdf.set_xy(18, 14.5)
    pdf.set_font('Helvetica', 'B', 13)
    pdf.set_text_color(255, 255, 255)
    pdf.cell(174, 5.5, clean_text('PROTON CLINICAL DIAGNOSTIC OS'), new_x=XPos.LMARGIN, new_y=YPos.NEXT)

    pdf.set_xy(18, 20.5)
    pdf.set_font('Helvetica', 'B', 9.0)
    pdf.set_text_color(90, 190, 255) # Cyan Accent
    pdf.cell(174, 4.5, clean_text('EPISTEMIC DIAGNOSTIC SYNTHESIS & CALIBRATED PROBABILISTIC MATRIX'), new_x=XPos.LMARGIN, new_y=YPos.NEXT)

    pdf.set_xy(18, 25.5)
    pdf.set_font('Helvetica', '', 7.2)
    pdf.set_text_color(210, 225, 245)
    pdf.cell(174, 3.8, clean_text('CASE: Maya R. (Fictional, 34F)  |  FRAMEWORK: What We Know, What We Suspect, Contradictions & Falsification  |  DATE: Oct 19, 2026'), new_x=XPos.LMARGIN, new_y=YPos.NEXT)

    pdf.set_y(39)

    # --- EPISTEMIC ARCHITECTURE CALLOUT ---
    pdf.callout_box(
        "CORE DIAGNOSTIC POSTURE: KNOWLEDGE, SUSPICIONS, UNPROVEN HYPOTHESES & CONTRADICTIONS",
        "A. WHAT WE KNOW WITH CERTAINTY (CONFIRMED OBJECTIVE DATA):\n"
        "   - Symmetric T2/FLAIR hyperintensity in bilateral medial thalami, periaqueductal gray, and mammillary bodies.\n"
        "   - Severe hypomagnesemia (1.5 mg/dL), hypophosphatemia (2.0 mg/dL), and elevated lactate (3.1 mmol/L).\n"
        "   - Functional cobalamin tissue deficiency: elevated methylmalonic acid (MMA) and markedly elevated homocysteine.\n"
        "   - Intramedullary hemolysis / ineffective erythropoiesis: LDH 612 U/L, low haptoglobin, negative Coombs/DAT, retics 4.8%.\n"
        "   - Severe orthostatic hypotension (92/58 -> 74/46 mmHg) with renal salt-wasting (U-Na 62 mmol/L) and hyperkalemia (5.7 mmol/L).\n\n"
        "B. WHAT WE STRONGLY SUSPECT (HIGH POST-TEST PLAUSIBILITY):\n"
        "   - Wernicke Encephalopathy & Early High-Output Wet Beriberi (~85%): Hallmark MRI and clinical triad, but requires proof by TPP response.\n"
        "   - Primary Adrenal Insufficiency (~65%): Salt wasting, orthostasis, and low stress cortisol (7.2 ug/dL); pending cosyntropin confirmation.\n\n"
        "C. WHAT REMAINS UNPROVEN & SPECULATIVE:\n"
        "   - Heavy Metal Intoxication (~35%): Metallic taste and colic raise suspicion, but blood lead/arsenic levels are pending. Not proven.\n"
        "   - True Thrombotic Thrombocytopenic Purpura (~10%): PLASMIC score is intermediate (5/7); ADAMTS13 is pending.\n\n"
        "D. THE ANOMALY REGISTER (FINDINGS CONTRADICTING A SINGLE TIDY EXPLANATION):\n"
        "   - Normal/Low-Normal ACTH (31 pg/mL) despite knuckle hyperpigmentation and primary salt wasting (anomalous for primary adrenal failure).\n"
        "   - Elevated reticulocyte count (4.8%) in the presence of presumed nutritional bone marrow failure.\n"
        "   - Disproportionate rhabdomyolysis (CK 1,760 U/L) and transaminitis not explained by Wernicke encephalopathy alone.",
        bg_rgb=(242, 247, 255), border_rgb=(45, 95, 175), title_rgb=(12, 38, 85)
    )

    # --- SECTION 1: PROBLEM REPRESENTATION ---
    pdf.chapter_title("1", "Problem Representation (Non-Presumptive)")
    pdf.body_paragraph(
        "A 34-year-old previously athletic woman presents with a 7-week progressive multisystem deterioration characterized by fluctuating encephalopathy, horizontal diplopia, and broad-based ataxia, accompanied by severe orthostatic hypotension, knuckle/scar hyperpigmentation, macrocytic pancytopenia with hemolytic markers, and progressive rhabdomyolysis (CK 1,184 -> 1,760 U/L), in the setting of a restrictive 3-month 'wellness' diet, unmonitored herbal powder ingestion, and renovation dust exposure. Key discriminating laboratory and imaging data demonstrate symmetric thalamic/periventricular MRI hyperintensities; hypovolemic hyponatremia with inappropriate renal sodium loss (Urine Na 62 mmol/L), hyperkalemia, and a low stress cortisol (7.2 ug/dL) with normal ACTH (31 pg/mL); elevated methylmalonic acid and homocysteine; and marked hypomagnesemia (1.5 mg/dL) and hypophosphatemia (2.0 mg/dL)."
    )

    # --- SECTION 2: CALIBRATED DIFFERENTIAL DIAGNOSIS ---
    pdf.chapter_title("2", "Calibrated Differential Diagnosis & Quantified Confidence")
    pdf.body_paragraph(
        "Rather than declaring dogmatic 'diagnostic confirmation,' each diagnostic entity is assigned an epistemic probability with explicit sensitivity to new data:\n\n"
        "- Wernicke Encephalopathy & High-Output Beriberi [Confidence: 85%]: Supported by classic medial thalamic/periaqueductal MRI signal, diplopia, and ataxia, but requires definitive confirmation by whole-blood thiamine diphosphate and rapid clinical reversal post-thiamine. (What moves it: prompt resolution of diplopia within 48h moves to 95%; lack of response or negative TPP drops to < 20%).\n"
        "- Combined Cobalamin (B12) & Copper Deficiency [Confidence: 85%]: Confirmed biochemical tissue deficiency (MMA and homocysteine elevated, low copper), explaining macro-ovalocytes, sensory ataxia, and intramedullary hemolysis. (What moves it: reticulocyte surge and resolving cytopenias post-B12/copper moves to 98%).\n"
        "- Primary Adrenal Insufficiency (Autoimmune vs Infiltrative/Toxic) [Confidence: 65%]: Strong clinical fit (orthostasis, salt-wasting, hyperkalemia, hypoglycemia, hyperpigmentation), but ACTH of 31 pg/mL is anomalous. (What moves it: post-cosyntropin cortisol < 18 ug/dL moves to 99%; peak > 18 ug/dL refutes it entirely and drops to < 5%).\n"
        "- Toxic Heavy Metal Ingestion (Lead / Arsenic / Mercury) [Confidence: 35% - UNPROVEN]: Suspected based on metallic taste, abdominal colic, and imported supplements, but remains an unconfirmed hypothesis until whole-blood heavy metal panel results return. (What moves it: elevated blood lead > 25 ug/dL or urine arsenic surges to 95%; normal levels drops to < 2%).\n"
        "- True Thrombotic Thrombocytopenic Purpura (TTP) [Confidence: 10%]: Lower probability due to negative DAT, prominent megaloblastic markers, and normal renal size, but cannot be dismissed while ADAMTS13 is pending."
    )

    # --- SECTION 3: CHALLENGING WERNICKE ENCEPHALOPATHY ---
    pdf.chapter_title("3", "Actively Challenging the Leading Hypothesis: What Wernicke CANNOT Explain")
    pdf.body_paragraph(
        "A rigorous diagnostician must ask: 'What clinical findings does my leading hypothesis fail to explain?' While Wernicke encephalopathy elegantly accounts for the diplopia, ataxia, confusion, and medial thalamic/periaqueductal MRI lesions, it completely fails to explain:\n"
        "1. Knuckle and scar cutaneous hyperpigmentation (requires an endocrine melanocortin drive).\n"
        "2. Refractory orthostatic hypotension with renal sodium wasting (U-Na 62 mmol/L) and hyperkalemia (5.7 mmol/L).\n"
        "3. Fasting hypoglycemia with appropriate ketosis (glucose 49 mg/dL, beta-OHB 3.8 mmol/L).\n"
        "4. Macrocytic pancytopenia, elevated LDH (612 U/L), low haptoglobin, and intramedullary hemolysis.\n"
        "5. Marked progressive rhabdomyolysis (CK rising to 1,760 U/L) and recurrent abdominal colic with a metallic taste.\n\n"
        "Conclusion: Wernicke encephalopathy is merely the acute neurologic manifestation of a broader, multisystem failure. Diagnosing Wernicke alone is dangerous tunnel vision that would leave the patient's adrenal crisis and toxic/metabolic collapse untreated."
    )

    # ==================== PAGE 2 ====================
    pdf.add_page()

    # --- SECTION 4: ADRENAL RIGOR & THE ACTH CONTRADICTION ---
    pdf.chapter_title("4", "Rigorous Adrenal Analysis: Addressing the ACTH Contradiction")
    pdf.body_paragraph(
        "The patient presents with hallmark features of adrenocortical failure: severe orthostatic hypotension (74/46 mmHg), hypovolemic hyponatremia (128 mmol/L), hyperkalemia (5.7 mmol/L), elevated plasma renin, low-normal aldosterone, and fasting hypoglycemia. In severe physiologic shock, a normal 8 AM cortisol should surge to > 18-20 ug/dL; Maya's cortisol of 7.2 ug/dL is inappropriately low, indicating an inadequate adrenocortical stress response.\n\n"
        "CRITICAL CONTRADICTION IDENTIFIED: In classic primary adrenal insufficiency (Addison's disease), the loss of cortisol feedback causes unchecked pituitary POMC hypersecretion, driving plasma ACTH levels markedly high (typically > 100-500 pg/mL). Here, Maya's ACTH is 31 pg/mL--well within the standard normal reference range (10-60 pg/mL).\n\n"
        "How is this contradiction reconciled?\n"
        "1. Biotin Analytical Immunoassay Interference: Maya is taking a high-dose biotin supplement. In competitive immunoassay formats, excess biotin falsely lowers measured analyte concentrations, potentially suppressing true ACTH and cortisol values in vitro.\n"
        "2. Early or Partial Primary Adrenal Failure: In subacute evolving adrenalitis, mineralocorticoid deficiency often precedes overt destruction of glucocorticoid-producing cells, producing a 'normal-range' ACTH that is nevertheless inappropriately low for a patient in shock.\n"
        "3. Combined / Central Component: Secondary adrenal insufficiency from toxic hypophysitis or pituitary stalk edema (though MRI pituitary was unremarkable), or coincidental familial hyperpigmentation.\n"
        "Resolution Mandate: The 250 mcg Cosyntropin Stimulation Test and 21-hydroxylase antibody panel are definitive. If 30/60-min cortisol fails to exceed 18 ug/dL, primary adrenal failure is proven regardless of baseline ACTH."
    )

    # --- SECTION 5: TTP VS PSEUDO-TTP & PLASMIC SCORE ---
    pdf.chapter_title("5", "TTP vs Pseudo-TTP: Formal PLASMIC Stratification & Decision Threshold")
    pdf.body_paragraph(
        "The presence of microangiopathic-like features (Hgb 8.9 g/dL, Platelets 101 x 10^9/L, LDH 612 U/L, low haptoglobin, 1-2 schistocytes/HPF, and confusion) raises the specter of Thrombotic Thrombocytopenic Purpura (TTP). Because TTP carries a > 90% mortality if plasma exchange (PLEX) is delayed, formal risk stratification is mandatory:\n\n"
        "Formal PLASMIC Score Calculation:\n"
        "- Platelet count < 30 x 10^9/L: NO (Platelets 101-118) -> 0 points\n"
        "- Hemolysis documented (LDH elevated, Haptoglobin low, reticulocytes): YES -> 1 point\n"
        "- No active cancer: YES -> 1 point\n"
        "- No history of solid organ or bone marrow transplant: YES -> 1 point\n"
        "- MCV < 90 fL: NO (MCV 101-103 fL) -> 0 points\n"
        "- INR < 1.5: YES -> 1 point\n"
        "- Creatinine < 2.0 mg/dL: YES (1.42 -> 1.02) -> 1 point\n"
        "TOTAL PLASMIC SCORE = 5 / 7 (INTERMEDIATE RISK: 5-24% probability of severe ADAMTS13 deficiency < 10%).\n\n"
        "Clinical Decision Threshold for Plasma Exchange (PLEX):\n"
        "Because the patient is in the Intermediate Risk tier (not High Risk 6-7), and because compelling alternative mechanisms exist (intramedullary hemolysis from documented cobalamin/copper deficiency, negative DAT, hypersegmented neutrophils), immediate emergent PLEX is NOT initiated. PLEX carries substantial risks of central line sepsis and circulatory volume shifts in an unstable patient.\n"
        "ACTION PROTOCOL: Draw STAT citrated plasma for ADAMTS13 activity immediately. Initiate parenteral cobalamin and copper. Recheck platelets and LDH every 6 hours. TRIGGER FOR PLEX: If platelet count precipitously drops < 50 x 10^9/L or new focal neurological deficits emerge before ADAMTS13 returns, PLEX must be initiated immediately."
    )

    # --- SECTION 6: THE FALSIFICATION MATRIX ---
    pdf.chapter_title("6", "The Falsification Matrix: What Specific Tests Will Change Our Mind")
    
    # Table of tests
    pdf.set_font('Helvetica', 'B', 7.2)
    pdf.set_fill_color(225, 235, 250)
    pdf.set_text_color(15, 35, 75)
    pdf.cell(48, 4.8, clean_text(" Pending Investigation"), fill=True, border=1)
    pdf.cell(66, 4.8, clean_text(" Finding That Confirms Hypothesis"), fill=True, border=1)
    pdf.cell(68, 4.8, clean_text(" Finding That Refutes Hypothesis"), fill=True, border=1, new_x=XPos.LMARGIN, new_y=YPos.NEXT)

    test_data = [
        ("Cosyntropin Stim Test (250 mcg)", "Peak cortisol < 18 ug/dL confirms adrenal failure (-> 99%)", "Peak cortisol >= 18 ug/dL refutes adrenal failure (-> < 5%)"),
        ("Whole-Blood Heavy Metals (ICP-MS)", "Blood Lead > 25 ug/dL or As > 50 ug/L confirms toxicity (-> 95%)", "Normal metal levels refutes heavy metal toxicity (-> < 2%)"),
        ("ADAMTS13 Activity Assay", "Activity < 10% confirms true TTP; mandates urgent PLEX (-> 99%)", "Activity > 20% definitively excludes TTP (-> 0%)"),
        ("Thiamine Diphosphate (HPLC)", "Low TDP confirms thiamine exhaustion (-> 98%)", "Normal TDP forces reconsideration of Leigh/mitochondrial (-> 15%)"),
        ("Biotin-Free Thyroid Washout", "Normal TSH & FT4 confirms in-vitro artifact (-> 99%)", "Persistent low TSH confirms true thyrotoxicosis (-> 85%)")
    ]

    pdf.set_font('Helvetica', '', 6.8)
    pdf.set_text_color(25, 35, 50)
    for test_name, confirms, refutes in test_data:
        pdf.cell(48, 4.5, clean_text(f" {test_name}"), border=1)
        pdf.cell(66, 4.5, clean_text(f" {confirms}"), border=1)
        pdf.cell(68, 4.5, clean_text(f" {refutes}"), border=1, new_x=XPos.LMARGIN, new_y=YPos.NEXT)

    pdf.ln(1.5)

    # --- SECTION 7: SEPARATED RESUSCITATIVE MANAGEMENT ---
    pdf.chapter_title("7", "Immediate Threats & Separated Resuscitative Management")
    pdf.callout_box(
        "EMPIRIC EMERGENCY INTERVENTIONS (SEPARATE FROM DIAGNOSTIC CONFIRMATION)",
        "These interventions are prophylactic safeguards against irreversible injury while diagnostic testing is pending:\n\n"
        "1. EMPIRIC THIAMINE PROPHYLAXIS: Thiamine HCl 500 mg IV in 100 mL 0.9% NS over 30 min STAT, Q8H for 72 hours.\n"
        "   - Mandatory Rule: Zero IV dextrose, glucose boluses, or enteral feeds until thiamine is infused to prevent acute brainstem necrosis.\n\n"
        "2. EMPIRIC STRESS-DOSE GLUCOCORTICOID: Dexamethasone 4 mg IV STAT, then 4 mg Q12H.\n"
        "   - Diagnostic Rationale: Dexamethasone does NOT cross-react with cortisol immunoassays, leaving the pending cosyntropin test valid.\n"
        "   - Resuscitate with 1,000-2,000 mL 0.9% Normal Saline IV to correct mineralocorticoid volume contraction.\n\n"
        "3. COFACTOR RESTORATION: Magnesium Sulfate 2.0 g IV over 60 min (Mg 1.5 blocks thiamine); Sodium Phosphate 15 mmol IV.",
        bg_rgb=(255, 243, 243), border_rgb=(210, 40, 40), title_rgb=(150, 15, 15)
    )

    # ==================== PAGE 3 ====================
    pdf.add_page()

    # --- SECTION 8: COGNITIVE ANCHORING PITFALLS ---
    pdf.chapter_title("8", "Cognitive Anchoring Traps & Diagnostic Biases")
    pdf.body_paragraph(
        "1. The 'TTP' Reflex Trap: Anchoring on cytopenias and schistocytes to immediately initiate plasma exchange (PLEX). In an intermediate PLASMIC risk setting with cobalamin/copper deficiency, emergent PLEX carries catheter infection and volume shift risks without addressing lethal thiamine/adrenal failure.\n"
        "2. The 'Thyrotoxicosis' Trap: Anchoring on low TSH (0.19) and high FT4 (1.9) as the cause of tachycardia, prescribing antithyroid drugs or beta-blockers. In reality, high-dose biotin causes in-vitro immunoassay displacement; beta-blockers in an adrenal crisis precipitate fatal vascular collapse.\n"
        "3. The 'Refeeding' Caloric Trap: Starting enteral feeding for severe weight loss without upfront parenteral thiamine, causing fulminant wet beriberi.\n"
        "4. The 'Psychiatric' Anchor: Attributing fatigue and forgetfulness to depression/anxiety (sertraline history), ignoring objective metabolic crisis."
    )

    # --- SECTION 9: SPECIALTY CONSULTATION MATRIX ---
    pdf.chapter_title("9", "Multidisciplinary Specialty Consultation Mandates")
    pdf.body_paragraph(
        "- Neurology: Perform serial cranial nerve exams; order continuous video-EEG to exclude non-convulsive status epilepticus (NCSE); monitor resolution of ophthalmoparesis post-thiamine to confirm clinical response.\n"
        "- Endocrinology: Execute the cosyntropin stimulation test under dexamethasone; measure 21-hydroxylase antibodies; if confirmed, guide long-term oral replacement with hydrocortisone (20 mg AM / 10 mg PM) and fludrocortisone (0.1 mg daily).\n"
        "- Medical Toxicology: Expedite whole-blood lead and urine arsenic fractionation; obtain physical samples of the patient's herbal powders for analytical mass spectrometry; establish threshold criteria for oral Succimer (DMSA) chelation therapy.\n"
        "- Hematology: Follow serial reticulocyte and LDH kinetics; maintain active surveillance over platelets; obtain STAT ADAMTS13 result."
    )

    # --- SECTION 10: THREE MOST DANGEROUS CAN'T-MISS ALTERNATIVES ---
    pdf.chapter_title("10", "The Three Most Dangerous Can't-Miss Alternatives")
    pdf.body_paragraph(
        "1. True Thrombotic Thrombocytopenic Purpura (TTP): > 90% mortality if missed. Intermediate PLASMIC score (5/7) requires active surveillance and STAT ADAMTS13 confirmation.\n"
        "2. Acute Decompensated Adrenal Crisis: Vascular collapse refractory to fluids. Addressed empirically with IV Dexamethasone.\n"
        "3. Basilar Artery Thrombosis / Non-Convulsive Status Epilepticus: Brainstem ischemia or subclinical seizures mimicking Wernicke syndrome. Normal MR Angiography rules out basilar occlusion; continuous bedside EEG required to rule out NCSE."
    )

    # --- SECTION 11: PLAUSIBLE CAUSAL CHAIN (NON-DOGMATIC) ---
    pdf.chapter_title("11", "Plausible Causal Model: From Exposure to Multi-Organ Injury")
    pdf.body_paragraph(
        "The following represents a plausible pathophysiologic model, explicitly acknowledged as a working hypothesis pending toxicology:\n"
        "1. Dietary & Toxic Exposure: A restrictive 3-month diet depleted water-soluble micronutrients (thiamine, B12, copper). Concurrently, unregulated herbal powders may have introduced toxic heavy metals (lead/arsenic), consistent with metallic taste and abdominal colic.\n"
        "2. Malabsorptive Wasting: Heavy metal enteropathy or dietary restriction induced chronic loose stools, leading to a 6.5 kg weight loss and total body exhaustion of thiamine and magnesium.\n"
        "3. Cellular Bioenergetic Arrest: Severe thiamine and magnesium depletion inactivated pyruvate dehydrogenase, halting the Krebs cycle. Unmetabolized pyruvate shunted into L-lactate (3.1 mmol/L). In parallel, autoimmune or toxic insult compromised adrenocortical reserve.\n"
        "4. Neurologic & Hemodynamic Failure: High-demand thalamic/brainstem nuclei suffered cytotoxic edema (Wernicke encephalopathy). Inability to retain sodium (U-Na 62 mmol/L) due to aldosterone deficiency produced severe orthostatic shock (74/46 mmHg).\n"
        "5. Ineffective Erythropoiesis & Rhabdomyolysis: Severe cobalamin/copper deficiency halted erythroid DNA maturation, causing intramedullary hemolysis (pseudo-TTP). Intracellular ATP depletion and hypomagnesemia triggered acute rhabdomyolysis (CK 1,760 U/L)."
    )

    # Sign-off box
    pdf.ln(1)
    pdf.set_fill_color(245, 248, 252)
    pdf.set_draw_color(180, 200, 225)
    y_sign = pdf.get_y()
    pdf.rect(14, y_sign, 182, 14, style='FD')
    pdf.set_xy(16, y_sign + 1.5)
    pdf.set_font('Helvetica', 'B', 8.0)
    pdf.set_text_color(16, 35, 75)
    pdf.cell(178, 3.5, clean_text("EPISTEMIC CLINICAL EVALUATION SIGN-OFF"), new_x=XPos.LMARGIN, new_y=YPos.NEXT)
    pdf.set_font('Helvetica', '', 7.0)
    pdf.set_text_color(50, 65, 85)
    pdf.set_x(16)
    pdf.cell(178, 3.0, clean_text("Evaluated by Proton Epistemic Medical Intelligence Engine (Version 2.5.0-PRO)."), new_x=XPos.LMARGIN, new_y=YPos.NEXT)
    pdf.set_x(16)
    pdf.cell(178, 3.0, clean_text("Calibrated certainty: Diagnoses quantified by post-test probability; contradictions registered; falsification criteria defined."), new_x=XPos.LMARGIN, new_y=YPos.NEXT)

    pdf.output(output_path)
    print(f"Successfully generated epistemic diagnostic PDF at: {output_path}")

if __name__ == '__main__':
    out = sys.argv[1] if len(sys.argv) > 1 else 'MAYA_R_COMPREHENSIVE_DIAGNOSTIC_REPORT.pdf'
    generate_pdf(out)
