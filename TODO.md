# Seva Kendra / JanKalyan Voice Gateway - Production Roadmap & TODOs

## Voice Architecture Notes
1. **Streaming STT & AudioWorklet Implementation**:
   - Streaming STT and AudioWorklet were omitted from new build scope per task instructions.
   - Robust synchronous REST STT endpoint (`/api/chat/audio`) with deterministic fallback and precise error mapping (`STT_API_ERROR` vs `EMPTY_SPEECH`) serves as the production voice pipeline.

## Safety & Governance
2. **Emergency Helpline Verification**:
   - Re-verify emergency helpline numbers (112, 181, 1098, 15100, 14416) with respective nodal state ministries and official gazette registries prior to nationwide public deployment.
   - Ensure local district-level child protection units (DCPU) and One Stop Centres (Sakhi Centres) routing integrations are tested in each deployment state.

## Scheme Verification Pipeline
3. **Continuous Scheme Verification**:
   - Re-audit state top-ups on IGNWPS and IGNOAPS for all 28 states and 8 union territories quarterly.
   - Track West Bengal Annapurna Yojana rollout updates as administrative circulars are published.
