# AI 2D-to-3D Asset Pipeline Research

Date: 2026-03-15
Context: Phase 12 of the fantasy-rpg prototype — first art-swap pass and imported asset integration.

## Problem Statement

We need a practical pipeline to convert 2D concept images (generated via OpenAI `gpt-image-1.5` or similar) into game-ready 3D `.glb` meshes for the castle slice. The pipeline should:

- Work primarily with props first (tables, bottles, furniture, fixtures)
- Eventually extend to characters (steward NPC, hands/arms)
- Favor low-cost or free solutions where possible
- Produce output compatible with Three.js and the existing `AssetCatalog` / `BlockoutFactory` swap path
- Support the existing concept → refinement → 3D → Blender cleanup → GLB export workflow documented in `docs/prop-asset-agent.md`

The current workflow already uses OpenAI for concept generation and has Meshy as the default 3D provider recommendation. This research explores whether better or cheaper alternatives exist, especially open-source models that can run locally or on free hosted infrastructure.

---

## Landscape Overview (March 2026)

The 2D-to-3D generation space has matured dramatically since late 2024. There are now three tiers of solutions:

1. **Open-source models** — run locally on your own GPU or via free Hugging Face Spaces
2. **Commercial cloud APIs** — pay-per-model services with free tiers (Meshy, Tripo, Rodin)
3. **Free web tools** — browser-based generators with limited daily quotas

For this project, the most promising path is a **hybrid approach**: use open-source models for bulk generation and iteration, fall back to commercial APIs for quality-critical or hard-to-generate assets, and use Blender as the universal cleanup/export authority.

---

## Tier 1: Open-Source Models (Free, Local GPU)

### TRELLIS 2 (Microsoft) — ⭐ Top Recommendation for Props

- **What it does**: Single-image to 3D mesh with PBR materials (albedo, roughness, metallic, opacity)
- **Architecture**: Structured Latent (SLAT) representation using sparse 3D voxels + rectified flow transformers, trained on 500K+ 3D models
- **Output**: GLB/OBJ with full PBR texture maps, also supports 3D Gaussians and Radiance Fields
- **Speed**: ~3 seconds per asset at 512³ resolution on an A100/RTX 4090
- **Quality**: Sharp edges, clean topology, convincing materials. 4B parameter model supports up to 1536³ voxel resolution
- **License**: MIT — fully open, no revenue restrictions
- **GPU requirement**: RTX 3090 (24GB VRAM) minimum; RTX 4090 or A100 recommended
- **Integration**: ComfyUI custom nodes available; also runs standalone via Python/CLI
- **Best for**: Hard-surface props, furniture, alchemy equipment, bottles — exactly our target category
- **Limitations**: Weaker on complex organic shapes, highly occluded views, or assets far from its training distribution

**Why this matters for us**: TRELLIS is the strongest free option for prop-class assets. Its PBR output means we get material maps that work directly in Three.js without manual texture painting. The MIT license means zero cost concerns. If you have (or can access) a 24GB GPU, this is the recommended first-try tool.

**Resources**:
- GitHub: https://github.com/microsoft/TRELLIS
- Project page: https://microsoft.github.io/TRELLIS/
- HuggingFace model: https://huggingface.co/microsoft/TRELLIS.2-4B
- ComfyUI guide: https://www.apatero.com/blog/trellis-2-comfyui-image-to-3d-complete-guide-2025

---

### Hunyuan3D 2.1 / 3.0 (Tencent) — ⭐ Best Multi-Modal Option

- **What it does**: Image-to-3D and text-to-3D with a two-stage pipeline (geometry then texturing)
- **Architecture**: Stage 1 uses a flow-based diffusion transformer for mesh generation; Stage 2 uses mesh-conditioned multi-view diffusion for 4K PBR texture synthesis
- **Output**: GLB/OBJ with 4K PBR texture maps
- **Speed**: 10–30 seconds for a standard asset
- **Quality**: Benchmark-leading on CLIP score, FID, and geometric accuracy. Outperforms TRELLIS in some texture realism benchmarks
- **License**: Open-source (Apache 2.0 for most components)
- **GPU requirement**: Standard pipeline needs ~12GB VRAM; "mini" variant runs on 6GB VRAM
- **Integration**: ComfyUI wrapper nodes available; Hunyuan3D Studio provides a GUI; API available via Tencent Cloud
- **Best for**: Assets where texture quality and artistic control matter more than raw geometric sharpness
- **Limitations**: Two-stage pipeline requires slightly more setup; geometry not quite as crisp as TRELLIS for hard-surface detail
- **Notable feature**: Hunyuan3D-PolyGen can generate clean quad-based topology directly, reducing retopology cleanup

**Why this matters for us**: The lower VRAM requirement (6–12GB) makes this more accessible if you don't have a high-end GPU. The two-stage architecture also lets you regenerate textures without redoing geometry, which is useful for our bottle-family workflow where we want shared mesh shapes with variant textures.

**Resources**:
- GitHub: https://github.com/Tencent/Hunyuan3D-2
- HuggingFace: https://huggingface.co/tencent/Hunyuan3D-2
- ComfyUI wrapper: https://github.com/kijai/ComfyUI-Hunyuan3DWrapper
- Tencent announcement: https://www.tencent.com/en-us/articles/2202235.html

---

### Stable Fast 3D / SF3D (Stability AI) — Fastest Option

- **What it does**: Ultra-fast single-image to UV-unwrapped, textured 3D mesh
- **Architecture**: Transformer-based feed-forward model built on TripoSR foundations
- **Output**: GLB/OBJ with UV maps and material parameter prediction (albedo, roughness, metallicity)
- **Speed**: ~0.5 seconds per asset on a modern GPU
- **Quality**: Good for rapid iteration; includes a "delighting" step to remove baked-in illumination
- **License**: Stability AI Community License — free for research, non-commercial, and commercial use under $1M/year revenue. Enterprise license required above that threshold
- **GPU requirement**: 7GB VRAM minimum
- **Best for**: Rapid iteration, quick previews, generating many variants to pick from
- **Limitations**: Lower geometric detail than TRELLIS or Hunyuan3D; better as a draft/preview tool than a final-asset generator

**Why this matters for us**: At 0.5 seconds per generation, SF3D is ideal for the "generate 5 variants, pick the best one" workflow. Use it for rapid concept-to-3D validation, then use TRELLIS or Hunyuan3D for the final production pass.

**Resources**:
- GitHub: https://github.com/Stability-AI/stable-fast-3d
- HuggingFace: https://huggingface.co/stabilityai/stable-fast-3d
- Paper: https://arxiv.org/abs/2408.00653

---

### TripoSR (Tripo / Stability AI)

- **What it does**: Feed-forward single-image to 3D mesh reconstruction
- **License**: MIT (open source)
- **Quality**: Good baseline quality; the foundation SF3D was built on
- **Best for**: Pipeline integration, custom fine-tuning, situations where MIT licensing matters
- **Note**: SF3D supersedes TripoSR in quality, but TripoSR remains useful for its simpler architecture and fully open license

---

## Tier 2: Commercial Cloud APIs (Pay-Per-Model)

### Meshy AI — Current Default Recommendation

- **Pricing**: Free tier = 100–200 credits/month (~3–6 textured models); Pro = $20/month for 1,000 credits (~33 models at ~$0.60 each)
- **API**: Yes, available on Pro tier and above
- **Output**: GLB/FBX/OBJ with PBR textures
- **Strengths**: Easy to use, good Blender integration, reasonable free tier for prototyping
- **Weaknesses**: Credits don't roll over; free tier is quite limited for production; CC BY 4.0 license on free-tier outputs
- **Current role in our workflow**: Already documented as the default 3D provider in `docs/prop-asset-agent.md` and `codex-skills/prop-asset-agent/references/workflow.md`

**Verdict**: Meshy remains a solid choice for occasional one-off generation, but for iterative work the free tier runs out fast. At $20/month for ~33 models, it's reasonable but adds up. Consider TRELLIS/Hunyuan3D for bulk work and reserve Meshy for comparison or when local GPU isn't available.

---

### Tripo3D — Strongest Commercial Value

- **Pricing**: Free tier = 300–600 credits/month (~10–24 models); Pro = ~$12–20/month for 3,000 credits (~75 models at ~$0.21 each)
- **API**: Yes, with flexible export formats
- **Output**: GLB/OBJ/FBX/USDZ/STL with PBR textures
- **Strengths**: Better cost-per-model than Meshy; more credits on free tier; supports HD textures, quad topology, segmentation, and rigging as add-on features
- **Weaknesses**: Free-tier models are public/CC-licensed; API requires paid plan
- **Note**: Tripo's underlying technology is related to TripoSR (they share foundational research)

**Verdict**: If we're paying for a commercial API, Tripo is currently better value than Meshy (~$0.21/model vs ~$0.60/model). Worth testing as a Meshy alternative.

---

### Rodin Gen-2 / Hyper3D — Best for Characters (Future)

- **What it does**: Image or text to production-grade 3D characters with clean quad topology, PBR textures, and T/A-pose generation
- **Strengths**: 4x improved geometry over Gen-1; supports multi-image input; outputs in GLB/FBX/OBJ/USD; designed specifically for character-class assets
- **Pricing**: Commercial API; pricing varies
- **Best for**: When we eventually need the steward NPC or character assets — this is the tool category to evaluate
- **Not needed yet**: Our current scope is props-first; character work is deferred per TD-015

**Resources**:
- Platform: https://hyper3d.io/
- API docs: https://developer.hyper3d.ai/api-specification/overview

---

## Tier 3: Free Browser-Based Generators (No GPU Required)

These are useful for quick experiments or when you don't have GPU access:

| Tool | Free Limit | Formats | Notes |
|------|-----------|---------|-------|
| [Triverse AI](https://triverse.ai/) | Daily credits | GLB/OBJ/FBX | PBR textures, no signup |
| [3D AI Maker](https://3daimaker.com/) | Unlimited basic | GLB/STL | Blender plugin available |
| [IMGto3D.ai](https://www.imgto3d.ai/) | Freemium | OBJ/GLB/STL | Polygon density control |
| [MeshMint.io](https://meshmint.io/) | Basic free | Various | PBR texture support |
| [SupaVoxel](https://supavoxel.com/) | 3/day | GLB/FBX/OBJ | Voxel-style output |
| [HuggingFace Spaces](https://huggingface.co/spaces/frogleo/Image-to-3D) | Free | OBJ/GLB | Cloud-hosted inference |

**Verdict**: These are great for zero-cost experimentation and proof-of-concept, but output quality is generally below what TRELLIS/Hunyuan3D/Meshy produce. Use them for quick tests when you don't want to spin up a local GPU or spend API credits.

---

## Character-Specific Tools (Future Reference)

Since the current scope explicitly defers character work (TD-015), these are noted for future phases:

### CharacterGen (Open Source)
- Single-image to rigged 3D character mesh in canonical pose
- Uses multi-view diffusion + transformer-based sparse-view reconstruction
- Outputs VRM/OBJ, compatible with Blender and Three.js
- Includes auto-rigging via UniRig
- Apache 2.0 license
- GitHub: https://github.com/zjp-shadow/CharacterGen
- Best for: Anime-style characters; may need adaptation for our grounded fantasy style

### Auto-Rigging Pipeline
- **Mixamo** (Adobe): Free web-based auto-rigging; upload a T-posed mesh, get a rigged FBX back
- **AccuRIG** (Reallusion): Free auto-rigging tool
- **UniRig**: AI-based skeletal rig generation included in CharacterGen
- These complement any image-to-3D character tool by handling the rigging step automatically

---

## The ComfyUI Orchestration Option

Both TRELLIS and Hunyuan3D integrate with [ComfyUI](https://github.com/comfyanonymous/ComfyUI), a node-based UI for chaining AI model pipelines. This enables a powerful local workflow:

```
OpenAI concept image
    → background removal node
    → TRELLIS or Hunyuan3D node
    → mesh export (GLB)
    → (optional) texture refinement node
```

**Advantages**:
- Visual, node-based pipeline you can iterate on
- Chain multiple AI models in a single workflow
- Save and share workflow configurations as JSON
- All processing stays local — no API costs

**Requirements**:
- NVIDIA GPU with 12–24GB VRAM (depending on model choice)
- Python 3.10+, CUDA toolkit
- Linux recommended (Windows experimental)

**Verdict**: ComfyUI is the most powerful option if you want a repeatable, automated local pipeline. It requires GPU hardware investment but eliminates per-model costs entirely.

---

## Post-Generation Cleanup (Universal Step)

Regardless of which 3D generation tool is used, all AI-generated meshes need cleanup before they're game-ready. This aligns with our existing Blender cleanup checklist in `codex-skills/prop-asset-agent/references/workflow.md`:

### Common Issues in AI-Generated Meshes
- Non-manifold edges and overlapping vertices
- Dense, uneven triangle soup (no clean edge loops)
- Floating faces and internal geometry
- Poor or missing UV unwrapping
- Baked-in lighting that fights the game's real-time lighting
- Scale, origin, and orientation mismatches

### Cleanup Workflow in Blender
1. **Import** the generated GLB/OBJ
2. **Inspect** for non-manifold geometry, loose vertices, internal faces
3. **Decimate** if polycount is too high for real-time use
4. **Retopologize** if the mesh needs clean edge flow (critical for characters, optional for static props)
5. **UV unwrap** or fix UVs if the generator produced poor UV maps
6. **Bake** normal/AO maps from high-poly to low-poly if needed
7. **Normalize** origin, scale, forward axis
8. **Export** as `.glb` to `public/assets/models`

### Helpful Blender Tools
- **Mesh cleanup operators**: Merge by Distance, Select Non-Manifold, Delete Loose
- **Decimate modifier**: Quick polycount reduction
- **Shrinkwrap modifier**: For manual retopology over a high-res source
- **RetopoFlow add-on**: More ergonomic manual retopology
- **SimpleBake add-on**: Streamlined texture baking
- **StableGen plugin**: AI-powered 3D texturing directly in Blender (https://github.com/sakalond/StableGen)

---

## Recommendations for This Project

### Immediate Next Steps (Phase 12 Asset Work)

1. **Try TRELLIS 2 first** if you have access to a 24GB+ GPU (RTX 3090/4090 or cloud GPU).
   - Feed the approved alchemy-table concept image directly into TRELLIS
   - Compare the output against a Meshy generation of the same concept
   - This gives us a quality baseline comparison at zero marginal cost

2. **Try Hunyuan3D** if your GPU has 6–12GB VRAM.
   - The mini variant runs on consumer hardware
   - The two-stage pipeline is especially useful for the bottle family: generate one mesh, apply different textures for each variant

3. **Use Meshy or Tripo as the cloud fallback** when:
   - Local GPU isn't available
   - A specific asset just doesn't work well with the open-source models
   - You want a quick comparison against the open-source output

4. **Keep Blender as the universal cleanup authority** — this is already documented and shouldn't change.

### Recommended Default Pipeline

```
Step 1: OpenAI gpt-image-1.5 → concept image (existing workflow)
Step 2: TRELLIS 2 (local) → raw 3D mesh + PBR textures
    OR: Hunyuan3D (local) → raw 3D mesh + PBR textures
    OR: Meshy/Tripo (cloud) → raw 3D mesh + textures
Step 3: Blender cleanup → normalize, decimate, fix UVs, export GLB
Step 4: Drop GLB into public/assets/models → auto-loaded by AssetCatalog
```

### Cost Analysis

| Approach | Cost per model | Monthly cost (20 models) | GPU required? |
|----------|---------------|-------------------------|---------------|
| TRELLIS 2 (local) | $0 | $0 | Yes (24GB) |
| Hunyuan3D (local) | $0 | $0 | Yes (6–12GB) |
| SF3D (local) | $0 | $0 | Yes (7GB) |
| Meshy Pro | ~$0.60 | $12 | No |
| Tripo Pro | ~$0.21 | $4.20 | No |
| Meshy Free | $0 | $0 (3–6 models) | No |
| Tripo Free | $0 | $0 (10–24 models) | No |
| Free web tools | $0 | $0 (limited) | No |

### For the Bottle Family Specifically

The bottle family workflow (tincture / draught / elixir) from our style guide is a perfect fit for:

1. **Hunyuan3D's two-stage pipeline**: Generate the base bottle mesh once, then run the texture stage multiple times with different tint/label/contents guidance. This produces variant bottles from a single geometry pass.

2. **TRELLIS with concept image variants**: Generate separate concept images for each bottle size via OpenAI, then run TRELLIS on each. The shared style guide language should keep them visually cohesive.

3. **Mesh reuse in Blender**: Generate one high-quality base mesh per bottle type, then create material/texture variants in Blender. This is the most controlled approach and aligns with our "shared family components" rule in the style guide.

### For Characters (Future Phases)

When we're ready for the steward NPC or modeled hands:

1. Evaluate **Rodin Gen-2 / Hyper3D** for character-class generation (T-pose output, clean topology)
2. Evaluate **CharacterGen** as the open-source alternative
3. Use **Mixamo** or **AccuRIG** for auto-rigging
4. The viewmodel pass architecture (TD-009) means hands/arms only need to look good from first-person perspective — this may simplify the mesh quality requirements significantly

---

## Resolved Questions

These were discussed interactively on 2026-03-15 and now inform the refined recommendations below.

### 1. GPU Access — Answered ✅

Available hardware:
- **PC 1**: NVIDIA RTX 3080 Ti (12GB VRAM)
- **PC 2**: NVIDIA RTX 5070 Ti (16GB VRAM)
- **Laptop**: MacBook Pro M3 Max (64GB unified memory)

**Impact on tool selection**:
- **Hunyuan3D** is the best fit — its standard pipeline needs ~12GB VRAM (3080 Ti), and it runs well on 16GB (5070 Ti). The mini variant would also work on all three machines.
- **TRELLIS 2** at full resolution (1536³) prefers 24GB, but lower resolutions (512³) should work on the 5070 Ti's 16GB. Worth testing.
- **Stable Fast 3D** runs comfortably on all three machines (needs only 7GB).
- **M3 Max path**: Both TRELLIS and Hunyuan3D have experimental MPS (Metal) support. The 64GB unified memory is more than enough, but Metal inference is slower than CUDA. Worth testing as a secondary option — especially for overnight batch generation where speed matters less.
- **No cloud GPU needed** — all three machines can run the open-source models locally.

### 2. Pipeline Orchestration — Answered ✅

**Decision**: Start with CLI-first tools callable from the existing `npm run asset-agent` workflow. Defer ComfyUI.

**Reasoning**: The asset-agent skill already has a command-line interface (`init`, `refresh`, `select`, `generate-concepts`, `generate-revisions`). Adding a `generate-3d` command that shells out to a Python CLI (TRELLIS or Hunyuan3D) is the most natural extension. ComfyUI's REST API *could* work but adds unnecessary infrastructure complexity for a pipeline that doesn't need visual node editing.

**Practical path**:
- TRELLIS and Hunyuan3D both have CLI/Python script entrypoints
- The asset-agent `generate-3d` command would: take the approved concept image → call the 3D model's inference script → save the raw GLB to `outputs/models/` in the session folder
- This keeps the workflow entirely within the existing repo-local command structure

### 3. Quality Bar — Answered ✅

**Target**: "Good enough to validate the art direction, polish later."

**Impact**:
- We don't need to invest in heavy retopology or hand-painted texture passes for the first imports
- AI-generated meshes with basic Blender cleanup (origin, scale, decimate if needed, axis fix) should be sufficient
- The goal is to prove the pipeline and art direction work together, not to ship final production assets
- This means we can accept slightly rough topology and rely on the blockout collision/gameplay authority (TD-014) while the visual presentation is upgraded

### 4. Automation Priority — Answered ✅

**Decision**: Automate the concept-to-3D handoff via `npm run asset-agent -- generate-3d` if it's straightforward to add.

**Assessment**: It *is* straightforward. The pattern would be:
1. The session already has `selectedConcept.id` in `session.json` pointing to a chosen concept image
2. The `generate-3d` command reads that, locates the concept image file
3. It calls the TRELLIS or Hunyuan3D inference script via `child_process`
4. It saves the output GLB/OBJ to `outputs/models/` in the session folder
5. It updates `session.json` stage to `"3d-generated"`

This follows the same pattern as the existing `generate-concepts` and `generate-revisions` commands.

---

## Refined Recommendations (Post-Discussion)

Given the available hardware, quality target, and automation preference, here is the refined recommended approach:

### Primary Tool: Hunyuan3D 2.1 (on 3080 Ti or 5070 Ti)

Hunyuan3D is the best default for this project because:
- Fits within the 12–16GB VRAM of both PCs
- Two-stage pipeline enables the bottle-family mesh-reuse strategy
- 4K PBR texture output works directly with Three.js
- PolyGen variant can produce cleaner quad topology, reducing Blender cleanup
- Apache 2.0 license — no restrictions
- CLI-callable, integrable into the asset-agent workflow

### Secondary Tool: TRELLIS 2 (on 5070 Ti for prop comparison)

Use TRELLIS as a comparison/alternative when:
- Hunyuan3D output for a specific prop isn't sharp enough
- Hard-surface detail matters (iron banding, carved wood, table construction)
- Test at 512³ resolution on the 5070 Ti first; if it fits, try higher

### Quick Preview Tool: Stable Fast 3D (on any machine)

Use SF3D for:
- Rapid 0.5-second previews to validate whether a concept image will translate well to 3D before investing in a full Hunyuan3D pass
- Batch previewing multiple concept variants

### Cloud Fallback: Tripo (better value than Meshy)

Use Tripo when:
- Neither PC is available
- A specific asset works better with Tripo's model than the open-source alternatives
- Free tier gives 10–24 models/month; Pro at ~$0.21/model if needed

### Experimental: M3 Max via MPS/Metal

Worth testing as a secondary path:
- 64GB unified memory means no VRAM bottleneck
- Metal inference is slower than CUDA but may be acceptable for batch/overnight jobs
- If it works, the MacBook becomes the "generate while traveling" option

### Recommended Setup Steps

1. **Install Hunyuan3D** on the 5070 Ti PC (best VRAM headroom):
   - Clone repo, install Python deps, download model weights from HuggingFace
   - Test with the approved alchemy-table concept image
   - Compare output quality against a Meshy generation of the same image

2. **Install Stable Fast 3D** on either PC (or the Mac):
   - Quick install, low VRAM needs
   - Use for rapid preview/validation before committing to full Hunyuan3D generation

3. **Add `generate-3d` command** to `scripts/asset-agent.mjs`:
   - Reads the selected concept image from the session
   - Calls Hunyuan3D inference CLI
   - Saves output to `outputs/models/`
   - Updates session stage

4. **Test the full pipeline** on the alchemy-table session:
   - Concept image → Hunyuan3D → raw GLB → Blender cleanup → `public/assets/models/alchemy-table.glb` → visible in castle slice

---

## Summary

The 2D-to-3D AI landscape has reached a point where **high-quality prop generation is essentially free** if you have GPU access. TRELLIS 2 and Hunyuan3D are both production-viable, open-source, and output PBR-ready GLB files that align directly with our Three.js pipeline. The existing Meshy/Tripo cloud path remains useful as a fallback but is no longer the only option — or even the best one for our use case.

The bottleneck has shifted from "can AI generate a 3D model from an image?" (yes, reliably) to "can we clean up and integrate AI-generated meshes into a coherent game world?" — which is exactly the Blender cleanup step our workflow already accounts for.
