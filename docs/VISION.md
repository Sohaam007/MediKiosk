# MediKiosk — Product Vision

## What MediKiosk is

MediKiosk is an **AI clinical intake platform** that replaces the manual patient history-taking
process in Indian hospitals. A patient walks up to a kiosk (or opens a web browser), speaks
in their language, scans their old prescriptions and reports, and walks away — leaving behind
a structured, bilingual, physician-ready clinical history backed by a FHIR-compliant health
record.

It is not a chatbot. It is not an EHR. It is the **missing bridge** between the patient
walking into the hospital and the physician opening their chart.

## Why MediKiosk exists

**The problem is time.** In Indian public hospitals, one physician serves 50–100+ OPD patients
per day. Each patient requires 10–20 minutes of history-taking. The physician is simultaneously
listening, writing, examining, and thinking. The result:

- Incomplete histories (symptoms missed, drug interactions uncaught)
- Illegible handwritten records that cannot be digitised or shared
- Patients waiting 2–4 hours for a 5-minute consultation
- No structured data for hospital analytics, research, or insurance

**The solution is structured automation.** MediKiosk conducts the history-taking conversation
using clinical protocols (SOCRATES, Review of Systems), digitises existing medical records
using vision AI, and synthesises everything into a bilingual, coded, physician-ready summary
— all in 5–8 minutes with zero physician time.

## The market

- **India has 1.4B people** and approximately 1 doctor per 1,000 population (WHO recommends 1:250).
- **Ministry of Ayush** oversees 800,000+ registered practitioners across Ayurveda, Yoga,
  Unani, Siddha, and Homeopathy — all of whom need clinical intake.
- **ABDM (Ayushman Bharat Digital Mission)** is building the national health data infrastructure
  with ABHA IDs and FHIR-based health records. MediKiosk plugs directly into this.
- **Private hospital chains** (Apollo, Fortis, Max, Narayana) spend ₹200–500 per OPD patient
  on administrative overhead. Structured intake reduces this by 40–60%.

## What MediKiosk is not

- **Not a diagnostic tool.** It captures history; it does not diagnose.
- **Not an EHR replacement.** It feeds INTO existing EHR/HIS systems via FHIR.
- **Not English-only.** It is built for India's linguistic diversity from day one.
- **Not cloud-dependent.** The core pipeline runs entirely offline. Only ABDM push requires network.

## The three-sentence pitch

> MediKiosk is an AI clinical intake platform that lets hospital patients self-report their
> medical history through voice and document scanning in any Indian language. It produces a
> structured, bilingual, FHIR-compliant clinical summary that eliminates 80% of the physician's
> history-taking workload. Deployed as a kiosk, web app, or API, it integrates with India's
> ABDM health infrastructure on day one.

## Success metrics

| Metric | Target | How we measure |
|---|---|---|
| Intake time reduction | From 15–20 min to 5–8 min | End-to-end session timing |
| Clinical completeness | ≥ 85% of physician-taken history | Rubric scoring vs. gold standard |
| Patient satisfaction | ≥ 4.2/5.0 rating | Post-intake survey |
| OCR entity accuracy | ≥ 80% F1 on Indian medical documents | Corpus benchmark |
| ASR WER (Hindi) | ≤ 15% on medical speech | Corpus benchmark |
| FHIR validation | 100% pass rate | HAPI validator |
| DPDP compliance | Zero violations in audit | Consent chain + invariant tests |
| Deployment modes | Kiosk + Web + API | Integration tests per mode |

## Revenue model (future)

1. **SaaS per-kiosk licensing** to hospitals and clinics (₹5,000–15,000/month/kiosk)
2. **API access** for health-tech platforms integrating clinical intake
3. **Government contracts** with Ministry of Ayush and state health departments
4. **White-label deployments** for hospital chains
