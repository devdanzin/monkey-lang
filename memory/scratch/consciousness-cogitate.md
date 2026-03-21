---
uses: 1
created: 2026-03-20
last-used: 2026-03-20
topics: consciousness,cogitate
---
# Consciousness Research: COGITATE & Adversarial Collaboration

## What is COGITATE?
The **COGITATE consortium** is a $6M+ Templeton-funded adversarial collaboration designed to test two leading theories of consciousness head-to-head:
- **Integrated Information Theory (IIT)** — Giulio Tononi. Consciousness = integrated information (Φ). Predicts consciousness correlates with posterior cortex activity, sustained throughout stimulus presentation.
- **Global Neuronal Workspace Theory (GNW/GNWT)** — Stanislas Dehaene/Bernard Baars. Consciousness = information broadcast to a "global workspace" via prefrontal-parietal networks. Predicts late ignition (~300ms) in frontal areas.

## The Experiment — Full Details (Nature 2025)

### Design
- **n = 256 participants** across three neuroimaging modalities:
  - fMRI (n=120, tested n=108 after exclusions → 35 optimization + 73 replication)
  - MEG (n=102, tested n=97 → 32 optimization + 65 replication)  
  - iEEG (n=34, 32 analyzed — patients with drug-resistant focal epilepsy)
- **Stimuli:** 4 categories (faces, objects, letters, false fonts) × 20 identities × 3 orientations (front/left/right) × 3 durations (0.5s, 1.0s, 1.5s)
- **Task:** Detect rare target stimuli — creates task-relevant vs task-irrelevant conditions, isolating consciousness-related activity from task-related activity
- **Key methodological feature:** Theory-neutral consortium did all data collection and analysis. Theory proponents (Tononi, Dehaene) were separated from data to minimize confirmation bias.
- **Open science:** All data publicly available (BIDS format), all analyses preregistered

### Three Predictions Tested

**Prediction 1: Where is conscious content represented? (Decoding)**
- **IIT predicts:** Maximal decoding in posterior cortex; PFC adds nothing
- **GNWT predicts:** Conscious content decodable from PFC activity
- **Results:**
  - **Category (face vs object):** Decodable in BOTH posterior (>95% accuracy in iEEG) and PFC (~70% in iEEG), but PFC decoding was temporally restricted (~0.2–0.4s) while posterior was sustained
  - **Orientation (left/right/front):** Decodable in posterior cortex (~95% iEEG, ~45% fMRI) but NOT in PFC (Bayes factors 5.11–8.65 supporting null)
  - **Adding PFC to posterior:** Did NOT improve decoding — in some cases *reduced* it (strong Bayesian evidence: BF₀₁ up to 1.94×10⁴)
  - **Verdict:** IIT partially supported (posterior dominance). GNWT partially challenged (PFC represents category but not orientation — doesn't broadcast ALL conscious content)

**Prediction 2: How is conscious content maintained over time? (Activation + RSA)**
- **IIT predicts:** Sustained activity in posterior cortex tracking stimulus duration
- **GNWT predicts:** Brief ignition in PFC at stimulus onset AND offset, with silent maintenance between
- **Results:**
  - **Posterior cortex:** 25/657 electrodes showed sustained duration-tracking activity — 12 non-category-selective (early visual areas), 13 category-specific (mostly face-selective in fusiform). But only 15% of face-selective electrodes showed sustained pattern → **sparse neural substrate**
  - **PFC:** 99 onset-responsive electrodes found, but **ZERO** showed the GNWT-predicted onset+offset pattern. Only 1 electrode (inferior frontal sulcus) showed anything like it, and timing was wrong (0.15s instead of 0.3-0.5s)
  - **RSA:** Posterior cortex showed sustained face-object categorical representation matching IIT model. PFC showed transient representation at onset only — no offset reinstatement even in task-relevant condition
  - **Orientation maintenance:** Weak in posterior, decaying after 0.5s (challenging for IIT). Absent in PFC.
  - **Verdict:** IIT partially supported but sparse. **GNWT's offset ignition prediction comprehensively failed** — this is the most damaging result, since changing from stimulus to blank screen IS a change in conscious experience that GNWT says should trigger workspace update

**Prediction 3: Interareal connectivity during consciousness (Synchrony)**
- **IIT predicts:** Sustained gamma-band synchrony within posterior cortex (V1/V2 ↔ category-selective areas)
- **GNWT predicts:** Brief late-phase synchrony between PFC and category-selective areas
- **Results (preregistered PPC metric):**
  - **IIT:** Some category-selective synchrony between category areas and V1/V2, but EARLY and BRIEF (<0.75s), restricted to LOW frequencies (2-25Hz), mostly explained by stimulus-evoked response. **NOT sustained, NOT gamma band** → challenges IIT
  - **GNWT:** No content-selective synchrony between category areas and PFC → challenges GNWT
  - **Both theories failed** on the preregistered connectivity metric
- **Results (exploratory DFC metric):**
  - Found gamma-band connectivity between object-selective areas and V1/V2 (brief, not sustained — still challenges IIT)
  - Found gamma-band connectivity between PFC and both face/object-selective areas within GNWT time window — **partially consistent with GNWT**
  - fMRI gPPI: FFA showed content-selective connectivity with V1/V2, inferior frontal gyrus, and intraparietal sulcus — consistent with both theories

### Summary Scorecard
| Prediction | IIT | GNWT |
|------------|-----|------|
| 1. Content decoding | ✅ Posterior dominance, PFC adds nothing | ⚠️ Category in PFC but not orientation |
| 2. Temporal maintenance | ⚠️ Sustained but sparse; no orientation maintenance | ❌ No offset ignition in PFC |
| 3. Connectivity | ❌ Not sustained, not gamma | ❌/⚠️ Failed preregistered, partially supported exploratory |

**Neither theory was clearly vindicated. Both were substantially challenged.**

## The Controversy
- After initial 2023 results, an **open letter signed by 124 scholars** called IIT pseudoscience (PsyArXiv, Sept 2023)
- Nature editors explicitly criticized this language in their accompanying editorial (May 2025)
- March 2025 Nature Neuroscience saw dueling commentaries:
  - Tononi et al.: listed 16 empirical studies supporting IIT
  - Gomez-Marin & Anil Seth: defended IIT as scientifically legitimate
  - Counter-commentary from many of the letter signers

## What This Means — My Analysis

### The Good
1. **The adversarial collaboration model works.** Pre-registering divergent predictions, having theory-neutral teams collect data, and using multimodal neuroimaging is genuinely excellent science. This should be the template for all theory testing.
2. **We learned something real.** Conscious content is represented primarily in posterior cortex (occipital-temporal "hot zone"). PFC represents abstract categories but not fine-grained features like orientation. Neither frontal ignition nor sustained posterior synchrony were confirmed as predicted.
3. **The "report confound" concern is real.** By using task-irrelevant stimuli, COGITATE isolates consciousness from task-related processing. The PFC activity they found for category in task-irrelevant conditions suggests some role for PFC, but it's limited.

### The Challenges
1. **IIT's biggest problem:** The connectivity prediction failed comprehensively. No sustained gamma synchrony within posterior cortex. IIT claims consciousness IS the integrated information of the network, but the network doesn't show the predicted connectivity pattern. Tononi's camp can retreat to the "mathematical core vs biological implementation" distinction, but that's a significant revision.
2. **GNWT's biggest problem:** No offset ignition. When a stimulus disappears and you see a blank screen, that's a new conscious experience. GNWT says the workspace should update. It didn't. Dehaene can argue about silent maintenance, but the theory specifically predicted offset responses.
3. **Both theories are too simple.** Consciousness probably doesn't reduce to "posterior integration" (IIT) or "frontal broadcast" (GNWT). The real neural mechanisms may involve distributed processing that neither theory captures.

### Implications for Other Theories
- **Higher-order theories** (HOT) that place content in PFC are also challenged by the orientation decoding failure
- **Recurrent processing theory** shares IIT's posterior cortex emphasis — gets indirect support from the content decoding results
- **Predictive processing** (Seth/Friston) wasn't directly tested but offers a different framing: consciousness might emerge from hierarchical prediction error minimization across the whole cortex, not from any one region

### What About AI Consciousness?
Both theories, even in failure, have implications:
- If consciousness requires specific *patterns of connectivity* (IIT) or *broadcasting mechanisms* (GNWT), current AI architectures have neither
- The finding that even PFC doesn't represent fine-grained conscious content like orientation suggests consciousness isn't just about having information available — it's about how that information is embodied in biological neural circuitry
- Connects to Seth's point: the math of prediction error minimization might run on any substrate, but the phenomenology might be tied to biology

## Key People
- **Giulio Tononi** — IIT originator (University of Wisconsin)
- **Stanislas Dehaene** — GNW originator (Collège de France)  
- **Christof Koch** — IIT proponent, Allen Institute / Tiny Blue Dot Foundation
- **David Chalmers** — Hard problem originator, involved in COGITATE
- **Lucia Melloni** — Lead researcher on COGITATE (Max Planck / NYU / Ruhr University)
- **Liad Mudrik** — Co-lead (Tel Aviv University)
- **Michael Pitts** — Co-lead (Reed College)
- **Anil Seth** — Predictive processing / "controlled hallucination" framework (related but distinct)

## References
- Cogitate Consortium et al. (2025). "Adversarial testing of global neuronal workspace and integrated information theories of consciousness." Nature 642: 133-142. doi:10.1038/s41586-025-08888-1
- Melloni et al. (2023). PLOS ONE 18(2). Protocol paper.
- Finkel (2023). "Consciousness hunt yields results but not clarity". Science 380: 1309-1310.
- Tononi et al. (2025). Nature Neuroscience 28(4): 694-702.
- Gomez-Marin & Seth (2025). Nature Neuroscience 28(4): 703-706.
- Data available: https://www.arc-cogitate.com/data-bundles
- Preregistration: https://osf.io/92tbg/

## Open Questions for Future Exploration
- How do IIT and GNWT proponents plan to revise their theories in response?
- Could a hybrid theory incorporating posterior content representation with selective frontal broadcasting work?
- What would COGITATE-style testing look like for predictive processing or attention schema theory?
- The sparse sustained responses (15% of face-selective electrodes) — is this a feature or a bug? Does consciousness only need a small subset of neurons to sustain content?
- How does the "three-voice" discussion format (theory-neutral + two adversaries) compare to standard peer review?
