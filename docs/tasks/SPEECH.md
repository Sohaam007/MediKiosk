# Speech pipeline tasks

**Area reviewer:** Lead AI Engineer
**Rubric:** Latency (40%), Accuracy (40%), Scalability (20%)

**Goal:**
- Implement state-of-the-art ASR pipeline with Whisper/IndicASR
- Deploy high-quality TTS for patient interaction
- Support multiple Indian languages seamlessly
- Ensure real-time processing and noise robustness for hospital environments

**Paths in this area:**
- src/speech/asr/pipeline.py
- src/speech/asr/models.py
- src/speech/tts/engine.py
- src/speech/utils/audio.py
- src/speech/streaming/server.py

### SPH-1: Core ASR pipeline with Whisper/IndicASR
Owner: Agent-C · Phase: P0 · Depends on: nothing · Status: todo

**Why:** Robust speech-to-text is the primary input modality for the MediKiosk. A reliable core pipeline is essential before advanced features can be added.

**Build:**
- Implement `ASRPipeline` in `src/speech/asr/pipeline.py`.
- Wrap Whisper (OpenAI) and IndicASR (Bhashini/AI4Bharat) models behind a common `SpeechRecognizer` interface.
- Implement an audio pre-processing pipeline in `src/speech/utils/audio.py` for resampling (16kHz), normalization, and silence trimming.
- Create a model multiplexer that routes audio to the appropriate model based on requested language or language detection.
- Expose a simple synchronous API `transcribe(audio_bytes) -> str`.

**Done when:**
- Pipeline successfully transcribes standard English and Hindi audio files.
- WER (Word Error Rate) is below 10% on clean clinical audio samples.
- Model loading times are optimized (using ONNX or torchscript) to sub-second initialization.

### SPH-2: TTS engine for patient prompts
Owner: Agent-D · Phase: P1 · Depends on: SPH-1 · Status: todo

**Why:** The kiosk must speak back to the patient to guide them through the intake process, especially for visually impaired or low-literacy users.

**Build:**
- Implement `TTSEngine` in `src/speech/tts/engine.py`.
- Integrate a high-quality TTS provider (e.g., ElevenLabs API, or local VITS models for Indian languages).
- Build a caching layer `AudioCache` that stores generated audio for static prompts to save compute/API costs.
- Ensure smooth playback with minimal latency between text generation and audio output.

**Done when:**
- Static prompts are served from cache in under 50ms.
- Dynamic prompt generation latency is under 500ms.
- Audio playback is clear, natural-sounding, and correctly paced for clinical environments.

### SPH-3: Indian language model integration (Hindi, Bengali, Tamil, Telugu, Marathi)
Owner: Agent-E · Phase: P1 · Depends on: SPH-1 · Status: todo

**Why:** Broad accessibility requires native language support. IndicASR provides the necessary coverage for the target demographic.

**Build:**
- Extend the `ASRPipeline` to explicitly support Hindi, Bengali, Tamil, Telugu, and Marathi.
- Implement language-specific post-processing rules in `src/speech/asr/post_processing.py` to handle transliteration or specific punctuation needs.
- Validate the integration with AI4Bharat's IndicWav2Vec or similar models.
- Set up automated evaluation scripts `scripts/eval_asr.py` with multi-language test sets.

**Done when:**
- WER for all 5 target languages is below 15% on the test corpus.
- The pipeline correctly handles code-mixing (e.g., speaking Hindi with English medical terms).
- Language switching can occur dynamically between utterances.

### SPH-4: Real-time streaming ASR with interim results
Owner: Agent-F · Phase: P1 · Depends on: SPH-1 · Status: todo

**Why:** Patients need immediate visual feedback that the kiosk is listening. Waiting for the end of a long sentence to see text creates poor UX.

**Build:**
- Implement a WebSocket-based streaming server in `src/speech/streaming/server.py`.
- Modify the ASR engine to process audio chunks (e.g., 200ms blocks) and emit interim transcripts.
- Manage state for ongoing utterances, resolving interim transcripts into final transcripts when silence is detected (VAD integration).
- Define precise JSON payloads for WebSocket messages: `{"type": "interim", "text": "..."}` and `{"type": "final", "text": "..."}`.

**Done when:**
- Interim results are displayed on the client within 300ms of speech.
- Final transcripts perfectly match the output of the synchronous pipeline.
- Streaming server can handle at least 5 concurrent connections per node.

### SPH-5: Noise-robust ASR for hospital environments
Owner: Agent-A · Phase: P2 · Depends on: SPH-3 · Status: todo

**Why:** Hospitals are loud (PA systems, equipment, crowds). The ASR must isolate the patient's voice from background noise.

**Build:**
- Integrate a deep-learning based noise suppression model (e.g., RNNoise or DeepFilterNet) into `src/speech/utils/audio.py` before the ASR step.
- Implement Voice Activity Detection (VAD) using Silero VAD to aggressively filter out non-speech audio.
- Test and tune VAD thresholds specifically for clinical background noise profiles.

**Done when:**
- SNR (Signal-to-Noise Ratio) improvements are measurable and significant.
- WER degradation in 65dB background noise is less than 5% compared to clean audio.
- Noise suppression adds no more than 50ms to the processing pipeline.

### SPH-6: Medical terminology ASR fine-tuning
Owner: Agent-B · Phase: P2 · Depends on: SPH-3, EVL-8 · Status: todo

**Why:** Generic ASR models struggle with complex medical phrasing, drug names, and anatomical terms, which are critical for clinical accuracy.

**Build:**
- Curate a dataset of common medical terminology, drug names (Indian pharmacopoeia), and Ayurvedic terms.
- Implement a spelling correction layer or biased language model (n-gram) to rescore ASR hypotheses favoring medical terms.
- If using Whisper, implement prompt-biasing with a standard list of expected medical terms provided in the initial prompt context.

**Done when:**
- Accuracy on a curated list of 500 complex medical terms improves by at least 30%.
- Common Ayurvedic terms (e.g., Ashwagandha, Triphala, Vata) are transcribed correctly 95% of the time.
- Implementation does not degrade performance on general conversational speech.
