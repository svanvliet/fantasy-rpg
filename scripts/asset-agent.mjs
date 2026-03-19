#!/usr/bin/env node

import fs from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";

const ROOT = process.cwd();
const WORKBENCH_ROOT = path.join(ROOT, "asset-workbench");
const DEFAULT_ORCHESTRATOR_MODEL = "gpt-5-mini";
const DEFAULT_IMAGE_MODEL = "gpt-image-1.5";
const BOOLEAN_FLAGS = new Set(["download"]);
const ASSET_SCOPES = new Set(["single", "family", "set"]);
const ASSET_INTENTS = new Set(["production", "exploration"]);

loadLocalEnv();

const usage = `Usage:
  npm run asset-agent -- init --slug <slug> --room <room> --category <category> [--scope <single|family|set>] [--intent <production|exploration>] [--swap-id <id>] [--use "<intended use>"] [--mood "<mood words>"]
  npm run asset-agent -- spawn-child --session <asset-workbench/session-folder> --slug <slug> --category <category> [--swap-id <id>] [--use "<intended use>"] [--child-role <role>] [--source-image <path>]
  npm run asset-agent -- refresh --session <asset-workbench/session-folder>
  npm run asset-agent -- select --session <asset-workbench/session-folder> --concept <concept-id> [--notes "<revision notes>"]
  npm run asset-agent -- select-revision --session <asset-workbench/session-folder> --revision <revision-id> [--pass <pass-id>]
  npm run asset-agent -- generate-concepts --session <asset-workbench/session-folder> [--model <main-model>] [--image-model <image-model>] [--size <widthxheight>] [--quality <quality>]
  npm run asset-agent -- generate-revisions --session <asset-workbench/session-folder> [--model <main-model>] [--image-model <image-model>] [--size <widthxheight>] [--quality <quality>] [--count <n>] [--source-image <path>]
  npm run asset-agent -- prepare-3d --session <asset-workbench/session-folder> [--provider <provider>] [--source-image <path>]
  npm run asset-agent -- submit-meshy --session <asset-workbench/session-folder> [--source-image <path>]
  npm run asset-agent -- check-meshy --session <asset-workbench/session-folder> [--pass <pass-id>] [--download]
  npm run asset-agent -- cleanup-blender --session <asset-workbench/session-folder> [--pass <pass-id>] [--blender <blender-bin>] [--source-model <path>] [--target-height <meters>] [--skip-preview]

Commands:
  init     Create a new prop-asset session with briefs, prompts, and provider job manifests.
  spawn-child  Create a production-focused single-asset child session from a family or set session.
  refresh  Rebuild markdown and job manifests from session.json.
  select   Record the chosen concept and create revision / 3D follow-up job manifests.
  select-revision  Record the approved refinement image that should drive 3D generation.
  generate-concepts  Call OpenAI image generation for the session prompts and write concept outputs.
  generate-revisions  Call OpenAI image generation using the selected concept as the refinement source.
  prepare-3d  Materialize a concrete provider handoff from the approved concept or revision image.
  submit-meshy  Submit the prepared 3D job to Meshy and record the provider task id.
  check-meshy  Refresh Meshy task status and optionally download the generated GLB and preview image.
  cleanup-blender  Run Blender cleanup on a generated model pass and save a separate cleaned export.
`;

function fail(message) {
  console.error(message);
  process.exit(1);
}

function parseArgs(argv) {
  const [, , command, ...rest] = argv;
  if (!command) {
    console.log(usage);
    process.exit(0);
  }

  const args = {};
  for (let index = 0; index < rest.length; index += 1) {
    const token = rest[index];
    if (!token.startsWith("--")) {
      fail(`Unexpected argument: ${token}\n\n${usage}`);
    }

    const key = token.slice(2);
    const value = rest[index + 1];
    if ((!value || value.startsWith("--")) && BOOLEAN_FLAGS.has(key)) {
      args[key] = true;
      continue;
    }
    if (!value || value.startsWith("--")) {
      fail(`Missing value for --${key}\n\n${usage}`);
    }
    args[key] = value;
    index += 1;
  }

  return { command, args };
}

function slugify(value) {
  return value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function titleCase(value) {
  return value
    .split(/[-_\s]+/)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

function sentence(value) {
  const trimmed = value.trim();
  return /[.!?]$/.test(trimmed) ? trimmed : `${trimmed}.`;
}

function normalizeScope(value, fallback = "single") {
  if (!value) {
    return fallback;
  }
  const normalized = String(value).trim().toLowerCase();
  if (!ASSET_SCOPES.has(normalized)) {
    fail(`Unsupported asset scope: ${value}. Expected one of ${Array.from(ASSET_SCOPES).join(", ")}.`);
  }
  return normalized;
}

function normalizeIntent(value, fallback = "production") {
  if (!value) {
    return fallback;
  }
  const normalized = String(value).trim().toLowerCase();
  if (!ASSET_INTENTS.has(normalized)) {
    fail(`Unsupported asset intent: ${value}. Expected one of ${Array.from(ASSET_INTENTS).join(", ")}.`);
  }
  return normalized;
}

function inferScopeFromSession(session) {
  if (session.scope && ASSET_SCOPES.has(session.scope)) {
    return session.scope;
  }
  const category = String(session.category || "").toLowerCase();
  if (category.includes("family")) {
    return "family";
  }
  if (category.includes("set")) {
    return "set";
  }
  return "single";
}

function inferIntentFromSession(session, scope) {
  if (session.intent && ASSET_INTENTS.has(session.intent)) {
    return session.intent;
  }
  return scope === "single" ? "production" : "exploration";
}

function normalizeSession(session) {
  const scope = inferScopeFromSession(session);
  const intent = inferIntentFromSession(session, scope);
  session.scope = scope;
  session.intent = intent;
  session.lineage = session.lineage || null;
  session.referenceImage = session.referenceImage || null;
  session.referenceMode = session.referenceMode || null;
  session.childAssets = session.childAssets || [];
  session.conceptPasses = session.conceptPasses || [];
  session.revisionPasses = session.revisionPasses || [];
  session.modelPasses = session.modelPasses || [];
  session.cleanupPasses = session.cleanupPasses || [];
  return session;
}

function articleFor(value) {
  return /^[aeiou]/i.test(value) ? "an" : "a";
}

function ensureDir(dirPath) {
  fs.mkdirSync(dirPath, { recursive: true });
}

function parseEnvValue(value) {
  const trimmed = value.trim();
  if (
    (trimmed.startsWith('"') && trimmed.endsWith('"')) ||
    (trimmed.startsWith("'") && trimmed.endsWith("'"))
  ) {
    return trimmed.slice(1, -1);
  }
  return trimmed;
}

function loadEnvFile(filePath) {
  if (!fs.existsSync(filePath)) {
    return;
  }

  const contents = fs.readFileSync(filePath, "utf8");
  for (const rawLine of contents.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith("#")) {
      continue;
    }

    const separatorIndex = line.indexOf("=");
    if (separatorIndex <= 0) {
      continue;
    }

    const key = line.slice(0, separatorIndex).trim();
    if (!key || process.env[key] !== undefined) {
      continue;
    }

    const value = line.slice(separatorIndex + 1);
    process.env[key] = parseEnvValue(value);
  }
}

function loadLocalEnv() {
  loadEnvFile(path.join(ROOT, ".env"));
  loadEnvFile(path.join(ROOT, ".env.local"));
}

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, "utf8"));
}

function writeJson(filePath, value) {
  fs.writeFileSync(filePath, `${JSON.stringify(value, null, 2)}\n`);
}

function writeText(filePath, value) {
  fs.writeFileSync(filePath, value);
}

function resolvePath(filePath) {
  return path.isAbsolute(filePath) ? filePath : path.join(ROOT, filePath);
}

function toRelative(filePath) {
  return path.relative(ROOT, filePath) || ".";
}

function getSessionPaths(sessionDir) {
  return {
    dir: sessionDir,
    sessionFile: path.join(sessionDir, "session.json"),
    briefFile: path.join(sessionDir, "01-brief.md"),
    promptsFile: path.join(sessionDir, "02-concept-prompts.md"),
    reviewFile: path.join(sessionDir, "03-review-notes.md"),
    conceptJobFile: path.join(sessionDir, "provider-jobs", "openai-concepts.json"),
    revisionJobFile: path.join(sessionDir, "provider-jobs", "openai-revisions.json"),
    meshyJobFile: path.join(sessionDir, "provider-jobs", "meshy-image-to-3d.json"),
    conceptIndexFile: path.join(sessionDir, "outputs", "concepts", "index.html"),
    revisionIndexFile: path.join(sessionDir, "outputs", "revisions", "index.html"),
    conceptOutputDir: path.join(sessionDir, "outputs", "concepts"),
    revisionOutputDir: path.join(sessionDir, "outputs", "revisions"),
    modelOutputDir: path.join(sessionDir, "outputs", "models"),
    modelIndexFile: path.join(sessionDir, "outputs", "models", "index.html"),
    cleanupOutputDir: path.join(sessionDir, "outputs", "cleanup"),
    cleanupIndexFile: path.join(sessionDir, "outputs", "cleanup", "index.html"),
  };
}

function makeConceptPrompts(session) {
  const assetTitle = titleCase(session.slug);
  const assetTitleLower = assetTitle.toLowerCase();
  const assetPhrase = `${articleFor(assetTitle)} ${assetTitleLower}`;
  const tone = session.moodWords.join(", ");
  const styleClause = session.styleConstraints.join(", ");
  const materialClause = session.materialGoals.join(", ");
  const sizeClause = sentence(session.approximateSize);
  const useClause = sentence(session.intendedUse);
  const roomClause = session.room;

  if (session.referenceImage && session.scope === "single") {
    const childRoleClause = session.lineage?.childRole
      ? `This child asset represents the ${session.lineage.childRole} member of the parent concept.`
      : "";
    return [
      {
        id: "concept-01",
        name: "Faithful Isolated Extraction",
        prompt: `Using the provided approved parent concept as the visual source of truth, create a single isolated fantasy RPG prop concept for ${assetPhrase}. Preserve the approved style, materials, and silhouette language from the source image while extracting only this one asset onto a plain background. ${childRoleClause} Keep the object centered, non-overlapping, and fully readable for downstream 3D generation. Materials should read as ${materialClause}. Style constraints: ${styleClause}. Intended use: ${useClause}`,
      },
      {
        id: "concept-02",
        name: "Cleaner Production Candidate",
        prompt: `Using the provided approved parent concept as reference, generate a cleaner production-ready isolated concept of ${assetPhrase}. Preserve the approved art direction and reusable components, but simplify clutter, remove overlap, and make the asset stand on its own on a plain background. Keep the materials ${materialClause}, the mood ${tone}, and the silhouette game-readable for first-person distance.`,
      },
      {
        id: "concept-03",
        name: "Extraction With Strong Material Separation",
        prompt: `Create an isolated extraction of ${assetPhrase} from the approved family or set concept reference. Preserve family resemblance but ensure this specific prop reads cleanly as its own asset. Use a plain background, no environment, no extra props, and no overlap. Push clear material separation using ${materialClause} and keep the form usable for future .glb generation and cleanup.`,
      },
    ];
  }

  if (session.scope === "family") {
    return [
      {
        id: "concept-01",
        name: "Reusable Family Sheet",
        prompt: `Create a coordinated fantasy RPG prop family sheet for ${assetTitleLower} used in the ${roomClause} room. Show multiple related props on a plain background with enough spacing that each could later be isolated as an individual asset. Preserve strong family resemblance through shared components and material language. Mood should feel ${tone}. Materials should read as ${materialClause}. Style constraints: ${styleClause}. Intended use: ${useClause}`,
      },
      {
        id: "concept-02",
        name: "Family With Component Reuse",
        prompt: `Design a reusable fantasy RPG prop family for ${assetTitleLower}. Show sibling props that share consistent components, proportions, and ornament language while remaining individually readable. Keep the objects clearly separated on a plain background so future child-asset extraction is practical. Materials should be ${materialClause}; mood should be ${tone}.`,
      },
      {
        id: "concept-03",
        name: "Family Focused On Gameplay Readability",
        prompt: `Generate a family concept image for ${assetTitleLower} aimed at first-person fantasy RPG gameplay. Show the related assets isolated on a plain background, spaced cleanly, with bold silhouette differences and shared visual language. Keep the piece grounded in ${tone} mood and ${materialClause} materials without turning into one fused decorative set.`,
      },
    ];
  }

  if (session.scope === "set") {
    return [
      {
        id: "concept-01",
        name: "Theme Exploration Set",
        prompt: `Create a broad fantasy RPG prop exploration sheet for ${assetTitleLower} in the ${roomClause} room. This is a thematic exploration, not a single production asset. Show multiple candidate props or prop groupings on a plain background with enough separation to identify distinct asset opportunities. Mood should feel ${tone}; materials should read as ${materialClause}; style constraints: ${styleClause}.`,
      },
      {
        id: "concept-02",
        name: "Set With Clear Child Opportunities",
        prompt: `Generate a prop set exploration image for ${assetTitleLower} that suggests multiple future assets or families rather than one fused object. Keep items readable and separated enough that single assets or families could later be extracted. Use a plain background and preserve a ${tone} fantasy RPG material language with ${materialClause}.`,
      },
      {
        id: "concept-03",
        name: "Worldbuilding Sheet",
        prompt: `Design a worldbuilding prop sheet for ${assetTitleLower} in a first-person fantasy RPG. Treat this as style and content exploration for later child assets, not direct-to-3D output. Keep the background simple, props legible, and visual language coherent with ${materialClause} materials and ${tone} mood.`,
      },
    ];
  }

  return [
    {
      id: "concept-01",
      name: "Grounded Hero Three-Quarter",
      prompt: `Create a single isolated fantasy RPG prop concept for ${assetPhrase} used in the ${roomClause} room. Show a strong three-quarter view on a clean dark neutral background. The prop should feel ${tone}. Materials should read as ${materialClause}. Keep the silhouette readable from first-person gameplay distance. Style constraints: ${styleClause}. Approximate real-world size: ${sizeClause} Intended use: ${useClause} No extra scene clutter, no character, no text, no watermark.`,
    },
    {
      id: "concept-02",
      name: "Craft Detail With Clear Materials",
      prompt: `Design a visually rich but game-readable ${assetTitleLower} prop for a candle-lit medieval fantasy interior. Isolate the object against a plain background. Emphasize practical construction, believable joinery, and clear material breakup using ${materialClause}. Mood should feel ${tone}. Keep the object centered, with no environment and no additional props. Style constraints: ${styleClause}. Intended use: ${useClause}`,
    },
    {
      id: "concept-03",
      name: "Readable Gameplay Silhouette",
      prompt: `Generate a prop concept sheet image showing one clean three-quarter angle of ${assetPhrase}. Prioritize bold silhouette, readable proportions, and game-friendly simplicity for a first-person fantasy RPG. The piece belongs in the ${roomClause} room and should feel ${tone}. Materials should be ${materialClause}. Background should be simple and uncluttered. Avoid over-detailing and avoid decorative noise that would hurt gameplay readability.`,
    },
  ];
}

function makeRevisionPrompt(session) {
  const assetTitle = titleCase(session.slug);
  const baseNotes = session.selectedConcept?.revisionNotes?.join("; ") || "tighten silhouette and improve material clarity";

  return `Revise the approved ${assetTitle} concept while preserving its overall identity. Apply these revision notes: ${baseNotes}. Keep the object isolated on a plain background, centered in frame, and readable for a first-person fantasy RPG. Produce a clean three-quarter view with stronger material separation and a clearer gameplay silhouette.`;
}

function buildBrief(session) {
  const lines = [
    `# ${titleCase(session.slug)} Asset Brief`,
    "",
    `- Session id: \`${session.id}\``,
    `- Scope: \`${session.scope}\``,
    `- Intent: \`${session.intent}\``,
    `- Room: \`${session.room}\``,
    `- Category: \`${session.category}\``,
    `- Swap id: \`${session.swapId || "none yet"}\``,
    `- Intended use: ${session.intendedUse}`,
    `- Approximate size: ${session.approximateSize}`,
    "",
    "## Visual Goals",
    `- Mood: ${session.moodWords.join(", ")}`,
    `- Material goals: ${session.materialGoals.join(", ")}`,
    `- Style constraints: ${session.styleConstraints.join(", ")}`,
    "",
    "## Gameplay And Integration Constraints",
    "- Keep the asset readable from first-person distance.",
    "- Treat imported art as presentation-only until we explicitly move gameplay authority.",
    "- Preserve the current swap path expectations documented in `public/assets/models/README.md`.",
    "",
    "## Current Workflow State",
    `- Stage: \`${session.stage}\``,
    `- Selected concept: \`${session.selectedConcept?.id || "none"}\``,
    "",
  ];

  if (session.lineage) {
    lines.push("## Lineage");
    lines.push(`- Parent session: \`${session.lineage.parentSessionId}\``);
    lines.push(`- Parent scope: \`${session.lineage.parentScope}\``);
    lines.push(`- Child role: \`${session.lineage.childRole || "none"}\``);
    lines.push(`- Source image: \`${session.lineage.sourceImage}\``);
    lines.push("");
  }

  return `${lines.join("\n")}\n`;
}

function buildPromptsDoc(session) {
  const prompts = makeConceptPrompts(session);
  const sections = [
    `# ${titleCase(session.slug)} Concept Prompts`,
    "",
    `Use these prompts with the OpenAI image workflow for session \`${session.id}\`.`,
    "",
    "## Recommended Prompt",
    "",
    prompts[0].prompt,
    "",
    "## Prompt Variants",
    "",
  ];

  for (const prompt of prompts) {
    sections.push(`### ${prompt.id}: ${prompt.name}`);
    sections.push("");
    sections.push(prompt.prompt);
    sections.push("");
  }

  if (session.selectedConcept) {
    sections.push("## Approved Concept");
    sections.push("");
    sections.push(`- Selected concept: \`${session.selectedConcept.id}\``);
    if (session.selectedConcept.revisionNotes.length > 0) {
      sections.push(`- Revision notes: ${session.selectedConcept.revisionNotes.join("; ")}`);
    }
    sections.push("");
  }

  return `${sections.join("\n")}\n`;
}

function buildReviewDoc(session) {
  const lines = [
    `# ${titleCase(session.slug)} Review Notes`,
    "",
    "## Review Loop",
    "- What works:",
    "- What needs revision:",
    "- Issue type: concept / geometry / texture / scale / readability",
    "",
    "## Selected Concept",
    `- Current choice: \`${session.selectedConcept?.id || "none"}\``,
    "",
  ];

  if (session.selectedConcept?.revisionNotes?.length) {
    lines.push("## Active Revision Notes");
    for (const note of session.selectedConcept.revisionNotes) {
      lines.push(`- ${note}`);
    }
    lines.push("");
  }

  lines.push("## Next Deliverable");
  if (session.scope === "single" && session.intent === "production") {
    lines.push("- Concept refinement images");
    lines.push("- or first-pass image-to-3D model once the single asset is approved");
  } else if (session.scope === "family") {
    lines.push("- Family refinement images");
    lines.push("- then branch a single production child asset before 3D generation");
  } else if (session.scope === "set") {
    lines.push("- Set/theme refinement images");
    lines.push("- then extract individual single assets or families before any 3D generation");
  } else {
    lines.push("- Concept refinement images");
  }
  lines.push("");

  return `${lines.join("\n")}\n`;
}

function buildConceptJob(session) {
  const prompts = makeConceptPrompts(session);
  return {
    workflow: "openai-image-concepts",
    sessionId: session.id,
    asset: session.slug,
    scope: session.scope,
    intent: session.intent,
    recommendedOrchestratorModel: DEFAULT_ORCHESTRATOR_MODEL,
    recommendedImageModel: DEFAULT_IMAGE_MODEL,
    rationale: "Use a lower-cost orchestration model while keeping image generation on gpt-image-1.5.",
    outputDir: toRelative(getSessionPaths(path.join(WORKBENCH_ROOT, session.id)).conceptOutputDir),
    sourceImage: session.referenceImage,
    sourceMode: session.referenceMode,
    prompts,
    notes: [
      "Generate 3 concepts first and review before moving to 3D.",
      "Keep concepts isolated on plain backgrounds for stronger downstream 3D generation.",
      "If using Responses, prefer the image_generation tool with a mainline reasoning model orchestrating revisions.",
      ...(session.referenceImage
        ? ["When a reference image is present, treat concept generation as a style-preserving extraction/edit pass rather than a net-new concept pass."]
        : []),
    ],
  };
}

function buildRevisionJob(session) {
  if (!session.selectedConcept) {
    return {
      workflow: "openai-image-revisions",
      sessionId: session.id,
      status: "waiting_for_selected_concept",
    };
  }

  return {
    workflow: "openai-image-revisions",
    sessionId: session.id,
    asset: session.slug,
    recommendedOrchestratorModel: DEFAULT_ORCHESTRATOR_MODEL,
    recommendedImageModel: DEFAULT_IMAGE_MODEL,
    selectedConcept: session.selectedConcept.id,
    outputDir: toRelative(getSessionPaths(path.join(WORKBENCH_ROOT, session.id)).revisionOutputDir),
    prompt: makeRevisionPrompt(session),
    notes: [
      "Preserve the chosen concept identity.",
      "Aim for a cleaner, centered, gameplay-readable three-quarter view.",
    ],
  };
}

function getConceptImagePath(session, paths, conceptId = session.selectedConcept?.id, passId = session.selectedConcept?.passId) {
  if (!conceptId) {
    return null;
  }
  if (passId) {
    return path.join(paths.conceptOutputDir, passId, `${conceptId}.png`);
  }
  return path.join(paths.conceptOutputDir, `${conceptId}.png`);
}

function getRevisionImagePath(session, paths, revisionId = session.selectedRevision?.revisionId, passId = session.selectedRevision?.passId) {
  if (!revisionId || !passId) {
    return null;
  }
  return path.join(paths.revisionOutputDir, passId, `${revisionId}.png`);
}

function getPreferred3dSourceImage(session, paths) {
  const revisionImagePath = getRevisionImagePath(session, paths);
  if (revisionImagePath && fs.existsSync(revisionImagePath)) {
    return {
      type: "approved-revision-image",
      filePath: revisionImagePath,
      passId: session.selectedRevision?.passId ?? null,
      assetId: session.selectedRevision?.revisionId ?? null,
    };
  }

  const conceptImagePath = getConceptImagePath(session, paths);
  if (conceptImagePath && fs.existsSync(conceptImagePath)) {
    return {
      type: "approved-concept-image",
      filePath: conceptImagePath,
      passId: session.selectedConcept?.passId ?? null,
      assetId: session.selectedConcept?.id ?? null,
    };
  }

  return null;
}

function buildMeshyJob(session, sourceImage = null) {
  if (!session.selectedConcept) {
    return {
      workflow: "meshy-image-to-3d",
      sessionId: session.id,
      status: "waiting_for_selected_concept",
    };
  }

  return {
    workflow: "meshy-image-to-3d",
    sessionId: session.id,
    asset: session.slug,
    preferredInput: sourceImage?.type || "approved-concept-image",
    sourceImage: sourceImage?.filePath ? toRelative(sourceImage.filePath) : null,
    approvedConcept: session.selectedConcept
      ? {
          passId: session.selectedConcept.passId || null,
          id: session.selectedConcept.id,
        }
      : null,
    approvedRevision: session.selectedRevision
      ? {
          passId: session.selectedRevision.passId || null,
          id: session.selectedRevision.revisionId,
        }
      : null,
    meshSettings: {
      model_type: "standard",
      ai_model: "latest",
      topology: "triangle",
      target_polycount: 12000,
      symmetry_mode: "off",
      should_remesh: true,
      save_pre_remeshed_model: true,
      should_texture: true,
      enable_pbr: true,
      image_enhancement: false,
      remove_lighting: true,
    },
    recommendedOutputFormat: "glb",
    extractionNotes: session.selectedConcept?.revisionNotes || [],
    notes: [
      "Use the approved concept image or revised concept set as the 3D source.",
      "If the source contains a prop family, preserve isolation and component reuse from the approved revision instead of allowing the generated output to merge pieces together.",
      "Keep the polycount and topology appropriate for a game prop, not a cinematic sculpt.",
      "Clean up the result in Blender before moving it into public/assets/models.",
    ],
    expectedRuntimeSwapId: session.swapId || null,
  };
}

function buildImageIndex(title, lead, items) {
  const cards = items
    .map((concept) => {
      const imagePath = `./${concept.fileName}`;
      return `
        <article class="card">
          <img src="${imagePath}" alt="${concept.id}" />
          <div class="card-body">
            <h2>${concept.id}</h2>
            <p class="name">${concept.name}</p>
            <p>${concept.prompt}</p>
          </div>
        </article>
      `;
    })
    .join("\n");

  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>${title}</title>
    <style>
      body {
        margin: 0;
        font-family: Georgia, "Times New Roman", serif;
        background: #140d08;
        color: #f2e5ca;
      }
      main {
        max-width: 1400px;
        margin: 0 auto;
        padding: 32px;
      }
      h1 {
        margin: 0 0 8px;
        font-size: 48px;
      }
      p.lead {
        margin: 0 0 24px;
        color: #d8c7a1;
      }
      .grid {
        display: grid;
        grid-template-columns: repeat(auto-fit, minmax(280px, 1fr));
        gap: 24px;
      }
      .card {
        background: rgba(41, 26, 16, 0.92);
        border: 1px solid rgba(196, 162, 112, 0.28);
        border-radius: 20px;
        overflow: hidden;
        box-shadow: 0 20px 60px rgba(0, 0, 0, 0.25);
      }
      .card img {
        display: block;
        width: 100%;
        aspect-ratio: 1 / 1;
        object-fit: cover;
        background: #24160e;
      }
      .card-body {
        padding: 18px 18px 22px;
      }
      .card-body h2,
      .card-body p {
        margin: 0;
      }
      .card-body h2 {
        font-size: 22px;
      }
      .card-body p.name {
        margin-top: 6px;
        color: #d5ba8d;
        font-weight: 700;
      }
      .card-body p:last-child {
        margin-top: 12px;
        line-height: 1.5;
        color: #eadab7;
      }
    </style>
  </head>
  <body>
    <main>
      <h1>${title}</h1>
      <p class="lead">${lead}</p>
      <section class="grid">
        ${cards}
      </section>
    </main>
  </body>
</html>
`;
}

function buildConceptIndex(session, generatedConcepts) {
  return buildImageIndex(
    `${titleCase(session.slug)} Concepts`,
    `Session <code>${session.id}</code> · review concepts before selecting a winner for refinement or 3D generation.`,
    generatedConcepts.map((concept) => ({
      ...concept,
      fileName: `${concept.id}.png`,
    })),
  );
}

function buildConceptPassIndex(session, passId, generatedConcepts) {
  return buildImageIndex(
    `${titleCase(session.slug)} ${passId} Concepts`,
    `Session <code>${session.id}</code> · ${passId} concept batch for review before refinement or 3D generation.`,
    generatedConcepts.map((concept) => ({
      ...concept,
      fileName: `${concept.id}.png`,
    })),
  );
}

function buildConceptPassesIndex(session) {
  const conceptPasses = session.conceptPasses || [];
  const selectedConcept = session.selectedConcept;
  const sections = conceptPasses
    .map((pass) => {
      const isSelectedPass = selectedConcept?.passId === pass.passId;
      const selectedNote = isSelectedPass
        ? `<p class="selected">Selected concept: <code>${selectedConcept.id}</code></p>`
        : "";
      return `
        <article class="pass-card">
          <h2>${pass.passId}</h2>
          <p>Images: ${pass.items.join(", ")}</p>
          ${selectedNote}
          <p><a href="./${pass.passId}/index.html">Open pass</a></p>
        </article>
      `;
    })
    .join("\n");

  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>${titleCase(session.slug)} Concept Passes</title>
    <style>
      body {
        margin: 0;
        font-family: Georgia, "Times New Roman", serif;
        background: #140d08;
        color: #f2e5ca;
      }
      main {
        max-width: 1100px;
        margin: 0 auto;
        padding: 32px;
      }
      h1 {
        margin: 0 0 8px;
        font-size: 44px;
      }
      p.lead {
        margin: 0 0 24px;
        color: #d8c7a1;
      }
      .grid {
        display: grid;
        grid-template-columns: repeat(auto-fit, minmax(280px, 1fr));
        gap: 24px;
      }
      .pass-card {
        background: rgba(41, 26, 16, 0.92);
        border: 1px solid rgba(196, 162, 112, 0.28);
        border-radius: 20px;
        padding: 20px;
      }
      .pass-card h2,
      .pass-card p {
        margin: 0;
      }
      .pass-card p {
        margin-top: 10px;
        color: #eadab7;
        line-height: 1.5;
      }
      .pass-card p.selected {
        color: #cfe3a8;
        font-weight: 700;
      }
      a {
        color: #f5d79b;
      }
    </style>
  </head>
  <body>
    <main>
      <h1>${titleCase(session.slug)} Concept Passes</h1>
      <p class="lead">Session <code>${session.id}</code> · preserved concept history for review and selection.</p>
      <section class="grid">
        ${sections || "<p>No concept passes recorded yet.</p>"}
      </section>
    </main>
  </body>
</html>
`;
}

function buildRevisionPassIndex(session, passId, generatedRevisions) {
  return buildImageIndex(
    `${titleCase(session.slug)} ${passId} Revisions`,
    `Session <code>${session.id}</code> · ${passId} based on approved concept <code>${session.selectedConcept?.id || "none"}</code>.`,
    generatedRevisions.map((revision) => ({
      ...revision,
      fileName: `${revision.id}.png`,
    })),
  );
}

function buildRevisionIndex(session) {
  const revisionPasses = session.revisionPasses || [];
  const selectedRevision = session.selectedRevision;
  const sections = revisionPasses
    .map((pass) => {
      const isSelectedPass = selectedRevision?.passId === pass.passId;
      const selectedNote = isSelectedPass
        ? `<p class="selected">Selected revision: <code>${selectedRevision.revisionId}</code></p>`
        : "";
      return `
        <article class="pass-card">
          <h2>${pass.passId}</h2>
          <p>Source image: <code>${pass.sourceImage}</code></p>
          <p>Images: ${pass.items.join(", ")}</p>
          ${selectedNote}
          <p><a href="./${pass.passId}/index.html">Open pass</a></p>
        </article>
      `;
    })
    .join("\n");

  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>${titleCase(session.slug)} Revision Passes</title>
    <style>
      body {
        margin: 0;
        font-family: Georgia, "Times New Roman", serif;
        background: #140d08;
        color: #f2e5ca;
      }
      main {
        max-width: 1100px;
        margin: 0 auto;
        padding: 32px;
      }
      h1 {
        margin: 0 0 8px;
        font-size: 44px;
      }
      p.lead {
        margin: 0 0 24px;
        color: #d8c7a1;
      }
      .grid {
        display: grid;
        grid-template-columns: repeat(auto-fit, minmax(280px, 1fr));
        gap: 24px;
      }
      .pass-card {
        background: rgba(41, 26, 16, 0.92);
        border: 1px solid rgba(196, 162, 112, 0.28);
        border-radius: 20px;
        padding: 20px;
      }
      .pass-card h2,
      .pass-card p {
        margin: 0;
      }
      .pass-card p {
        margin-top: 10px;
        color: #eadab7;
        line-height: 1.5;
      }
      .pass-card p.selected {
        color: #cfe3a8;
        font-weight: 700;
      }
      a {
        color: #f5d79b;
      }
    </style>
  </head>
  <body>
    <main>
      <h1>${titleCase(session.slug)} Revision Passes</h1>
      <p class="lead">Session <code>${session.id}</code> · preserved refinement history for review and downstream extraction.</p>
      <section class="grid">
        ${sections || "<p>No revision passes recorded yet.</p>"}
      </section>
    </main>
  </body>
</html>
`;
}

function buildModelIndex(session) {
  const modelPasses = session.modelPasses || [];
  const sections = modelPasses
    .map((pass) => {
      const links = [
        pass.outputs?.glb ? `<a href="./${pass.passId}/${path.basename(pass.outputs.glb)}">GLB</a>` : null,
        pass.outputs?.preRemeshedGlb
          ? `<a href="./${pass.passId}/${path.basename(pass.outputs.preRemeshedGlb)}">Pre-remeshed GLB</a>`
          : null,
        pass.outputs?.thumbnail
          ? `<a href="./${pass.passId}/${path.basename(pass.outputs.thumbnail)}">Preview</a>`
          : null,
      ];
      const textureCount = pass.outputs?.textures?.length || 0;
      if (textureCount > 0) {
        links.push(`<a href="./${pass.passId}/textures/">Textures (${textureCount})</a>`);
      }
      const outputNote = links.filter(Boolean).length
        ? `<p class="selected">Outputs: ${links.filter(Boolean).join(" · ")}</p>`
        : "";
      return `
        <article class="pass-card">
          <h2>${pass.passId}</h2>
          <p>Provider: <code>${pass.provider}</code></p>
          <p>Status: <code>${pass.status}</code></p>
          <p>Source image: <code>${pass.sourceImage}</code></p>
          <p>Task id: <code>${pass.taskId || "not submitted yet"}</code></p>
          ${outputNote}
        </article>
      `;
    })
    .join("\n");

  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>${titleCase(session.slug)} 3D Passes</title>
    <style>
      body {
        margin: 0;
        font-family: Georgia, "Times New Roman", serif;
        background: #140d08;
        color: #f2e5ca;
      }
      main {
        max-width: 1100px;
        margin: 0 auto;
        padding: 32px;
      }
      h1 {
        margin: 0 0 8px;
        font-size: 44px;
      }
      p.lead {
        margin: 0 0 24px;
        color: #d8c7a1;
      }
      .grid {
        display: grid;
        grid-template-columns: repeat(auto-fit, minmax(280px, 1fr));
        gap: 24px;
      }
      .pass-card {
        background: rgba(41, 26, 16, 0.92);
        border: 1px solid rgba(196, 162, 112, 0.28);
        border-radius: 20px;
        padding: 20px;
      }
      .pass-card h2,
      .pass-card p {
        margin: 0;
      }
      .pass-card p {
        margin-top: 10px;
        color: #eadab7;
        line-height: 1.5;
      }
      .pass-card p.selected {
        color: #cfe3a8;
        font-weight: 700;
      }
      a {
        color: #f5d79b;
      }
    </style>
  </head>
  <body>
    <main>
      <h1>${titleCase(session.slug)} 3D Passes</h1>
      <p class="lead">Session <code>${session.id}</code> · preserved provider handoffs, task states, and downloaded assets.</p>
      <section class="grid">
        ${sections || "<p>No 3D passes recorded yet.</p>"}
      </section>
    </main>
  </body>
</html>
`;
}

function buildCleanupIndex(session) {
  const cleanupPasses = session.cleanupPasses || [];
  const sections = cleanupPasses
    .map((pass) => {
      const links = [
        pass.outputs?.glb ? `<a href="./${pass.passId}/${path.basename(pass.outputs.glb)}">Cleaned GLB</a>` : null,
        pass.outputs?.report ? `<a href="./${pass.passId}/${path.basename(pass.outputs.report)}">Report</a>` : null,
        pass.outputs?.preview ? `<a href="./${pass.passId}/${path.basename(pass.outputs.preview)}">Preview</a>` : null,
      ];
      const outputNote = links.filter(Boolean).length
        ? `<p class="selected">Outputs: ${links.filter(Boolean).join(" · ")}</p>`
        : "";
      return `
        <article class="pass-card">
          <h2>${pass.passId}</h2>
          <p>Source model pass: <code>${pass.sourceModelPassId}</code></p>
          <p>Blender: <code>${pass.blenderBinary}</code></p>
          <p>Target height: <code>${pass.targetHeight ?? "unchanged"}</code></p>
          ${outputNote}
        </article>
      `;
    })
    .join("\n");

  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>${titleCase(session.slug)} Cleanup Passes</title>
    <style>
      body {
        margin: 0;
        font-family: Georgia, "Times New Roman", serif;
        background: #140d08;
        color: #f2e5ca;
      }
      main {
        max-width: 1100px;
        margin: 0 auto;
        padding: 32px;
      }
      h1 {
        margin: 0 0 8px;
        font-size: 44px;
      }
      p.lead {
        margin: 0 0 24px;
        color: #d8c7a1;
      }
      .grid {
        display: grid;
        grid-template-columns: repeat(auto-fit, minmax(280px, 1fr));
        gap: 24px;
      }
      .pass-card {
        background: rgba(41, 26, 16, 0.92);
        border: 1px solid rgba(196, 162, 112, 0.28);
        border-radius: 20px;
        padding: 20px;
      }
      .pass-card h2,
      .pass-card p {
        margin: 0;
      }
      .pass-card p {
        margin-top: 10px;
        color: #eadab7;
        line-height: 1.5;
      }
      .pass-card p.selected {
        color: #cfe3a8;
        font-weight: 700;
      }
      a {
        color: #f5d79b;
      }
    </style>
  </head>
  <body>
    <main>
      <h1>${titleCase(session.slug)} Cleanup Passes</h1>
      <p class="lead">Session <code>${session.id}</code> · preserved Blender cleanup outputs for in-engine validation.</p>
      <section class="grid">
        ${sections || "<p>No cleanup passes recorded yet.</p>"}
      </section>
    </main>
  </body>
</html>
`;
}

function listRevisionPassIds(paths) {
  if (!fs.existsSync(paths.revisionOutputDir)) {
    return [];
  }

  return fs
    .readdirSync(paths.revisionOutputDir, { withFileTypes: true })
    .filter((entry) => entry.isDirectory() && /^pass-\d+$/.test(entry.name))
    .map((entry) => entry.name)
    .sort((left, right) => left.localeCompare(right, undefined, { numeric: true }));
}

function listConceptPassIds(paths) {
  if (!fs.existsSync(paths.conceptOutputDir)) {
    return [];
  }

  return fs
    .readdirSync(paths.conceptOutputDir, { withFileTypes: true })
    .filter((entry) => entry.isDirectory() && /^pass-\d+$/.test(entry.name))
    .map((entry) => entry.name)
    .sort((left, right) => left.localeCompare(right, undefined, { numeric: true }));
}

function getNextConceptPassId(paths) {
  const passIds = listConceptPassIds(paths);
  const nextNumber = passIds.length + 1;
  return `pass-${String(nextNumber).padStart(2, "0")}`;
}

function getLatestConceptPassId(paths) {
  const passIds = listConceptPassIds(paths);
  return passIds.length > 0 ? passIds[passIds.length - 1] : null;
}

function migrateLegacyConceptOutputs(session, paths) {
  if (!fs.existsSync(paths.conceptOutputDir)) {
    return;
  }

  const passIds = listConceptPassIds(paths);
  const legacyFiles = fs
    .readdirSync(paths.conceptOutputDir)
    .filter((fileName) => /^concept-\d+\.(png|json)$/.test(fileName));

  if (legacyFiles.length === 0 || passIds.length > 0) {
    return;
  }

  const passId = "pass-01";
  const passDir = path.join(paths.conceptOutputDir, passId);
  ensureDir(passDir);

  const conceptIds = Array.from(
    new Set(
      legacyFiles
        .map((fileName) => fileName.match(/^(concept-\d+)/)?.[1])
        .filter(Boolean),
    ),
  ).sort((left, right) => left.localeCompare(right, undefined, { numeric: true }));

  const promptLookup = new Map(makeConceptPrompts(session).map((prompt) => [prompt.id, prompt]));
  const passItems = [];

  for (const conceptId of conceptIds) {
    const pngFile = `${conceptId}.png`;
    const jsonFile = `${conceptId}.json`;
    const pngSource = path.join(paths.conceptOutputDir, pngFile);
    const jsonSource = path.join(paths.conceptOutputDir, jsonFile);
    const pngTarget = path.join(passDir, pngFile);
    const jsonTarget = path.join(passDir, jsonFile);

    if (fs.existsSync(pngSource)) {
      fs.renameSync(pngSource, pngTarget);
    }
    if (fs.existsSync(jsonSource)) {
      fs.renameSync(jsonSource, jsonTarget);
    }

    let metadata = {};
    if (fs.existsSync(jsonTarget)) {
      metadata = readJson(jsonTarget);
    }

    const fallbackPrompt = promptLookup.get(conceptId);
    passItems.push({
      id: conceptId,
      name: metadata.name || fallbackPrompt?.name || conceptId,
      prompt: metadata.prompt || fallbackPrompt?.prompt || "",
    });
  }

  if (passItems.length > 0) {
    writeText(path.join(passDir, "index.html"), buildConceptPassIndex(session, passId, passItems));
    session.conceptPasses = session.conceptPasses || [];
    session.conceptPasses.push({
      passId,
      generatedAt: new Date().toISOString(),
      items: passItems.map((item) => item.id),
    });
    if (session.selectedConcept && !session.selectedConcept.passId) {
      session.selectedConcept.passId = passId;
    }
  }
}

function getNextRevisionPassId(paths) {
  const passIds = listRevisionPassIds(paths);
  const nextNumber = passIds.length + 1;
  return `pass-${String(nextNumber).padStart(2, "0")}`;
}

function listModelPassIds(paths) {
  if (!fs.existsSync(paths.modelOutputDir)) {
    return [];
  }

  return fs
    .readdirSync(paths.modelOutputDir, { withFileTypes: true })
    .filter((entry) => entry.isDirectory() && /^pass-\d+$/.test(entry.name))
    .map((entry) => entry.name)
    .sort((left, right) => left.localeCompare(right, undefined, { numeric: true }));
}

function getNextModelPassId(paths) {
  const passIds = listModelPassIds(paths);
  const nextNumber = passIds.length + 1;
  return `pass-${String(nextNumber).padStart(2, "0")}`;
}

function listCleanupPassIds(paths) {
  if (!fs.existsSync(paths.cleanupOutputDir)) {
    return [];
  }

  return fs
    .readdirSync(paths.cleanupOutputDir, { withFileTypes: true })
    .filter((entry) => entry.isDirectory() && /^pass-\d+$/.test(entry.name))
    .map((entry) => entry.name)
    .sort((left, right) => left.localeCompare(right, undefined, { numeric: true }));
}

function getNextCleanupPassId(paths) {
  const passIds = listCleanupPassIds(paths);
  const nextNumber = passIds.length + 1;
  return `pass-${String(nextNumber).padStart(2, "0")}`;
}

function migrateLegacyRevisionOutputs(session, paths) {
  if (!fs.existsSync(paths.revisionOutputDir)) {
    return;
  }

  const passIds = listRevisionPassIds(paths);
  const legacyFiles = fs
    .readdirSync(paths.revisionOutputDir)
    .filter((fileName) => /^revision-\d+\.(png|json)$/.test(fileName));

  if (legacyFiles.length === 0 || passIds.length > 0) {
    return;
  }

  const passId = "pass-01";
  const passDir = path.join(paths.revisionOutputDir, passId);
  ensureDir(passDir);

  const revisionIds = Array.from(
    new Set(
      legacyFiles
        .map((fileName) => fileName.match(/^(revision-\d+)/)?.[1])
        .filter(Boolean),
    ),
  ).sort((left, right) => left.localeCompare(right, undefined, { numeric: true }));

  const passItems = [];
  let sourceImage = null;

  for (const revisionId of revisionIds) {
    const pngFile = `${revisionId}.png`;
    const jsonFile = `${revisionId}.json`;
    const pngSource = path.join(paths.revisionOutputDir, pngFile);
    const jsonSource = path.join(paths.revisionOutputDir, jsonFile);
    const pngTarget = path.join(passDir, pngFile);
    const jsonTarget = path.join(passDir, jsonFile);

    if (fs.existsSync(pngSource)) {
      fs.renameSync(pngSource, pngTarget);
    }
    if (fs.existsSync(jsonSource)) {
      fs.renameSync(jsonSource, jsonTarget);
    }

    let metadata = {};
    if (fs.existsSync(jsonTarget)) {
      metadata = readJson(jsonTarget);
      sourceImage = sourceImage || metadata.sourceImage || null;
    }

    passItems.push({
      id: revisionId,
      name: metadata.name || `Refinement ${passItems.length + 1}`,
      prompt: metadata.prompt || buildRevisionJob(session).prompt,
    });
  }

  if (passItems.length > 0) {
    writeText(path.join(passDir, "index.html"), buildRevisionPassIndex(session, passId, passItems));
    session.revisionPasses = session.revisionPasses || [];
    session.revisionPasses.push({
      passId,
      sourceImage: sourceImage || toRelative(path.join(paths.conceptOutputDir, `${session.selectedConcept?.id || "unknown"}.png`)),
      generatedAt: new Date().toISOString(),
      items: passItems.map((item) => item.id),
    });
  }
}

function writeSessionArtifacts(session, sessionDir) {
  const paths = getSessionPaths(sessionDir);
  ensureDir(paths.dir);
  ensureDir(path.dirname(paths.conceptJobFile));
  ensureDir(paths.conceptOutputDir);
  ensureDir(paths.revisionOutputDir);
  ensureDir(paths.modelOutputDir);
  ensureDir(paths.cleanupOutputDir);

  const preferred3dSource = getPreferred3dSourceImage(session, paths);
  writeJson(paths.sessionFile, session);
  writeText(paths.briefFile, buildBrief(session));
  writeText(paths.promptsFile, buildPromptsDoc(session));
  writeText(paths.reviewFile, buildReviewDoc(session));
  writeJson(paths.conceptJobFile, buildConceptJob(session));
  writeJson(paths.revisionJobFile, buildRevisionJob(session));
  writeJson(paths.meshyJobFile, buildMeshyJob(session, preferred3dSource));
  if ((session.conceptPasses || []).length > 0) {
    writeText(paths.conceptIndexFile, buildConceptPassesIndex(session));
  }
  if ((session.revisionPasses || []).length > 0) {
    writeText(paths.revisionIndexFile, buildRevisionIndex(session));
  }
  if ((session.modelPasses || []).length > 0) {
    writeText(paths.modelIndexFile, buildModelIndex(session));
  }
  if ((session.cleanupPasses || []).length > 0) {
    writeText(paths.cleanupIndexFile, buildCleanupIndex(session));
  }
}

function getImageCall(output) {
  return output.find((item) => item.type === "image_generation_call");
}

function decodeImageResult(result) {
  if (typeof result === "string") {
    return Buffer.from(result, "base64");
  }

  if (Array.isArray(result) && result.length > 0) {
    const first = result[0];
    if (typeof first === "string") {
      return Buffer.from(first, "base64");
    }
    if (first?.b64_json) {
      return Buffer.from(first.b64_json, "base64");
    }
  }

  if (result?.b64_json) {
    return Buffer.from(result.b64_json, "base64");
  }

  throw new Error("Unsupported image_generation result shape.");
}

async function generateConcepts(args) {
  if (!args.session) fail("The generate-concepts command requires --session.");
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    fail("OPENAI_API_KEY is not set. Export it before running generate-concepts.");
  }

  const { sessionDir, session } = loadSession(args.session);
  const paths = getSessionPaths(sessionDir);
  const conceptJob = readJson(paths.conceptJobFile);
  const model = args.model || conceptJob.recommendedOrchestratorModel || DEFAULT_ORCHESTRATOR_MODEL;
  const imageModel = args["image-model"] || conceptJob.recommendedImageModel || DEFAULT_IMAGE_MODEL;
  const size = args.size || "1024x1024";
  const quality = args.quality || "medium";
  const referenceImageFile = session.referenceImage ? resolvePath(session.referenceImage) : null;
  if (referenceImageFile && !fs.existsSync(referenceImageFile)) {
    fail(`Could not find reference image at ${toRelative(referenceImageFile)}.`);
  }

  migrateLegacyConceptOutputs(session, paths);
  const passId = getNextConceptPassId(paths);
  const passDir = path.join(paths.conceptOutputDir, passId);
  ensureDir(passDir);
  const generatedConcepts = [];

  for (const promptSpec of conceptJob.prompts) {
    const input = referenceImageFile
      ? [
          {
            role: "user",
            content: [
              {
                type: "input_text",
                text: promptSpec.prompt,
              },
              {
                type: "input_image",
                image_url: `data:image/png;base64,${fs.readFileSync(referenceImageFile).toString("base64")}`,
              },
            ],
          },
        ]
      : promptSpec.prompt;
    const response = await fetch("https://api.openai.com/v1/responses", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model,
        input,
        tools: [
          {
            type: "image_generation",
            model: imageModel,
            size,
            quality,
            background: "opaque",
            action: referenceImageFile ? "edit" : "generate",
            ...(referenceImageFile ? { input_fidelity: "high" } : {}),
          },
        ],
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`OpenAI image generation failed for ${promptSpec.id}: ${errorText}`);
    }

    const payload = await response.json();
    const imageCall = getImageCall(payload.output ?? []);
    if (!imageCall) {
      throw new Error(`No image_generation_call returned for ${promptSpec.id}.`);
    }

    const imageBuffer = decodeImageResult(imageCall.result);
    const imageFile = path.join(passDir, `${promptSpec.id}.png`);
    const metadataFile = path.join(passDir, `${promptSpec.id}.json`);
    fs.writeFileSync(imageFile, imageBuffer);
    writeJson(metadataFile, {
      promptId: promptSpec.id,
      name: promptSpec.name,
      prompt: promptSpec.prompt,
      responseId: payload.id,
      model,
      imageModel,
      size,
      quality,
      referenceImage: referenceImageFile ? toRelative(referenceImageFile) : null,
    });

    generatedConcepts.push(promptSpec);
  }

  writeText(path.join(passDir, "index.html"), buildConceptPassIndex(session, passId, generatedConcepts));
  session.conceptPasses = session.conceptPasses || [];
  session.conceptPasses.push({
    passId,
    generatedAt: new Date().toISOString(),
    items: generatedConcepts.map((concept) => concept.id),
  });
  session.stage = "concept_review";
  writeSessionArtifacts(session, sessionDir);
  console.log(`Generated ${generatedConcepts.length} concept image(s) at ${toRelative(passDir)}`);
}

async function generateRevisions(args) {
  if (!args.session) fail("The generate-revisions command requires --session.");
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    fail("OPENAI_API_KEY is not set. Export it before running generate-revisions.");
  }

  const { sessionDir, session } = loadSession(args.session);
  if (!session.selectedConcept?.id) {
    fail("Select a concept first with the select command before generating revisions.");
  }

  const paths = getSessionPaths(sessionDir);
  const revisionJob = readJson(paths.revisionJobFile);
  if (revisionJob.status === "waiting_for_selected_concept") {
    fail("Revision job is still waiting for a selected concept. Run the select command first.");
  }

  migrateLegacyRevisionOutputs(session, paths);

  const fallbackConceptImageFile = session.selectedConcept.passId
    ? path.join(paths.conceptOutputDir, session.selectedConcept.passId, `${session.selectedConcept.id}.png`)
    : path.join(paths.conceptOutputDir, `${session.selectedConcept.id}.png`);
  const sourceImageFile = args["source-image"]
    ? resolvePath(args["source-image"])
    : fallbackConceptImageFile;
  if (!fs.existsSync(sourceImageFile)) {
    fail(`Could not find source image at ${toRelative(sourceImageFile)}.`);
  }

  const model = args.model || revisionJob.recommendedOrchestratorModel || DEFAULT_ORCHESTRATOR_MODEL;
  const imageModel = args["image-model"] || revisionJob.recommendedImageModel || DEFAULT_IMAGE_MODEL;
  const size = args.size || "1024x1024";
  const quality = args.quality || "medium";
  const count = Math.max(1, Number.parseInt(args.count || "3", 10) || 3);
  const inputImageDataUrl = `data:image/png;base64,${fs.readFileSync(sourceImageFile).toString("base64")}`;
  const passId = getNextRevisionPassId(paths);
  const passDir = path.join(paths.revisionOutputDir, passId);

  ensureDir(paths.revisionOutputDir);
  ensureDir(passDir);
  const generatedRevisions = [];

  for (let index = 0; index < count; index += 1) {
    const revisionId = `revision-${String(index + 1).padStart(2, "0")}`;
    const response = await fetch("https://api.openai.com/v1/responses", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model,
        input: [
          {
            role: "user",
            content: [
              {
                type: "input_text",
                text: revisionJob.prompt,
              },
              {
                type: "input_image",
                image_url: inputImageDataUrl,
              },
            ],
          },
        ],
        tools: [
          {
            type: "image_generation",
            model: imageModel,
            size,
            quality,
            background: "opaque",
            action: "edit",
            input_fidelity: "high",
          },
        ],
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`OpenAI revision generation failed for ${revisionId}: ${errorText}`);
    }

    const payload = await response.json();
    const imageCall = getImageCall(payload.output ?? []);
    if (!imageCall) {
      throw new Error(`No image_generation_call returned for ${revisionId}.`);
    }

    const imageBuffer = decodeImageResult(imageCall.result);
    const imageFile = path.join(passDir, `${revisionId}.png`);
    const metadataFile = path.join(passDir, `${revisionId}.json`);
    fs.writeFileSync(imageFile, imageBuffer);
    writeJson(metadataFile, {
      revisionId,
      sourceConcept: session.selectedConcept.id,
      sourceImage: toRelative(sourceImageFile),
      name: `Refinement ${index + 1}`,
      prompt: revisionJob.prompt,
      responseId: payload.id,
      model,
      imageModel,
      size,
      quality,
    });

    generatedRevisions.push({
      id: revisionId,
      name: `Refinement ${index + 1}`,
      prompt: revisionJob.prompt,
    });
  }

  writeText(path.join(passDir, "index.html"), buildRevisionPassIndex(session, passId, generatedRevisions));
  session.revisionPasses = session.revisionPasses || [];
  session.revisionPasses.push({
    passId,
    sourceImage: toRelative(sourceImageFile),
    generatedAt: new Date().toISOString(),
    items: generatedRevisions.map((revision) => revision.id),
  });
  session.stage = "revision_review";
  writeSessionArtifacts(session, sessionDir);
  console.log(`Generated ${generatedRevisions.length} revision image(s) at ${toRelative(passDir)}`);
}

async function meshyRequest(endpoint, { apiKey, method = "GET", body = null }) {
  const response = await fetch(`https://api.meshy.ai${endpoint}`, {
    method,
    headers: {
      Authorization: `Bearer ${apiKey}`,
      ...(body ? { "Content-Type": "application/json" } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Meshy request failed (${response.status}) ${endpoint}: ${errorText}`);
  }

  if (response.status === 204) {
    return null;
  }

  return response.json();
}

async function downloadBinary(url, outputFile) {
  const response = await fetch(url);
  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Failed to download ${url}: ${errorText}`);
  }

  const arrayBuffer = await response.arrayBuffer();
  fs.writeFileSync(outputFile, Buffer.from(arrayBuffer));
}

async function downloadTextureSet(textureUrls, outputDir) {
  if (!Array.isArray(textureUrls) || textureUrls.length === 0) {
    return [];
  }

  ensureDir(outputDir);
  const downloaded = [];
  for (const [setIndex, textureSet] of textureUrls.entries()) {
    for (const [mapName, mapUrl] of Object.entries(textureSet || {})) {
      if (!mapUrl || typeof mapUrl !== "string") {
        continue;
      }
      const extension = path.extname(new URL(mapUrl).pathname) || ".png";
      const fileName = `set-${String(setIndex + 1).padStart(2, "0")}-${mapName}${extension}`;
      const textureFile = path.join(outputDir, fileName);
      await downloadBinary(mapUrl, textureFile);
      downloaded.push({
        set: setIndex + 1,
        map: mapName,
        file: toRelative(textureFile),
      });
    }
  }
  return downloaded;
}

function resolve3dSourceImage(session, paths, overrideSourceImage = null) {
  if (overrideSourceImage) {
    const resolved = resolvePath(overrideSourceImage);
    if (!fs.existsSync(resolved)) {
      fail(`Could not find source image at ${toRelative(resolved)}.`);
    }
    return {
      type: "override-source-image",
      filePath: resolved,
      passId: null,
      assetId: path.basename(resolved, path.extname(resolved)),
    };
  }

  const preferred = getPreferred3dSourceImage(session, paths);
  if (!preferred) {
    fail("No approved concept or revision image is available yet for 3D generation.");
  }
  return preferred;
}

function prepare3d(args) {
  if (!args.session) fail("The prepare-3d command requires --session.");
  const provider = args.provider || "meshy";
  if (provider !== "meshy") {
    fail(`Unsupported provider: ${provider}`);
  }

  const { sessionDir, session } = loadSession(args.session);
  ensure3dEligible(session);
  const paths = getSessionPaths(sessionDir);
  migrateLegacyConceptOutputs(session, paths);
  migrateLegacyRevisionOutputs(session, paths);

  const sourceImage = resolve3dSourceImage(session, paths, args["source-image"]);
  writeJson(paths.meshyJobFile, buildMeshyJob(session, sourceImage));
  session.stage = "3d_ready";
  writeSessionArtifacts(session, sessionDir);
  console.log(`Prepared ${provider} handoff using ${toRelative(sourceImage.filePath)}.`);
}

function selectRevision(args) {
  if (!args.session) fail("The select-revision command requires --session.");
  if (!args.revision) fail("The select-revision command requires --revision.");

  const { sessionDir, session } = loadSession(args.session);
  const paths = getSessionPaths(sessionDir);
  migrateLegacyRevisionOutputs(session, paths);
  const passId = args.pass || listRevisionPassIds(paths).at(-1);
  if (!passId) {
    fail("No revision passes are available yet.");
  }

  const revisionPath = path.join(paths.revisionOutputDir, passId, `${args.revision}.png`);
  if (!fs.existsSync(revisionPath)) {
    fail(`Could not find ${args.revision}.png in ${toRelative(path.join(paths.revisionOutputDir, passId))}.`);
  }

  session.selectedRevision = {
    passId,
    revisionId: args.revision,
  };
  session.stage = "3d_ready";
  writeSessionArtifacts(session, sessionDir);
  console.log(`Recorded selected revision ${args.revision} from ${passId} for ${session.id}.`);
}

async function submitMeshy(args) {
  if (!args.session) fail("The submit-meshy command requires --session.");
  const apiKey = process.env.MESHY_API_KEY;
  if (!apiKey) {
    fail("MESHY_API_KEY is not set. Add it to .env before running submit-meshy.");
  }

  const { sessionDir, session } = loadSession(args.session);
  ensure3dEligible(session);
  const paths = getSessionPaths(sessionDir);
  const sourceImage = resolve3dSourceImage(session, paths, args["source-image"]);
  const job = buildMeshyJob(session, sourceImage);
  writeJson(paths.meshyJobFile, job);

  const sourceImageDataUri = `data:image/png;base64,${fs.readFileSync(sourceImage.filePath).toString("base64")}`;
  const payload = {
    image_url: sourceImageDataUri,
    ...job.meshSettings,
  };

  const result = await meshyRequest("/openapi/v1/image-to-3d", {
    apiKey,
    method: "POST",
    body: payload,
  });

  const passId = getNextModelPassId(paths);
  const passDir = path.join(paths.modelOutputDir, passId);
  ensureDir(passDir);

  const pass = {
    passId,
    provider: "meshy",
    sourceImage: toRelative(sourceImage.filePath),
    submittedAt: new Date().toISOString(),
    taskId: result.result,
    status: "PENDING",
    meshSettings: job.meshSettings,
    selectedConcept: session.selectedConcept
      ? {
          passId: session.selectedConcept.passId || null,
          id: session.selectedConcept.id,
        }
      : null,
    selectedRevision: session.selectedRevision
      ? {
          passId: session.selectedRevision.passId || null,
          id: session.selectedRevision.revisionId,
        }
      : null,
  };

  writeJson(path.join(passDir, "meshy-submit.json"), {
    payload,
    response: result,
  });

  session.modelPasses = session.modelPasses || [];
  session.modelPasses.push(pass);
  session.stage = "model_generation";
  writeSessionArtifacts(session, sessionDir);
  console.log(`Submitted Meshy task ${result.result} for ${session.id} at ${toRelative(passDir)}.`);
}

function getModelPass(paths, session, explicitPassId = null) {
  const passId = explicitPassId || session.modelPasses?.at(-1)?.passId;
  if (!passId) {
    fail("No model passes are recorded yet.");
  }
  const pass = session.modelPasses?.find((entry) => entry.passId === passId);
  if (!pass) {
    fail(`Could not find model pass ${passId} in session history.`);
  }
  return {
    passId,
    pass,
    passDir: path.join(paths.modelOutputDir, passId),
  };
}

function resolveCleanupSource(args, paths, session) {
  if (args["source-model"]) {
    const sourceModel = resolvePath(args["source-model"]);
    if (!fs.existsSync(sourceModel)) {
      fail(`Could not find source model at ${toRelative(sourceModel)}.`);
    }
    return {
      sourceModelPassId: null,
      sourceModel,
      sourceType: "external",
      pass: null,
    };
  }

  const { passId: sourceModelPassId, pass } = getModelPass(paths, session, args.pass);
  const sourceModel = resolveCleanupSourceModel(args, pass);
  return {
    sourceModelPassId,
    sourceModel,
    sourceType: "provider",
    pass,
  };
}

async function checkMeshy(args) {
  if (!args.session) fail("The check-meshy command requires --session.");
  const apiKey = process.env.MESHY_API_KEY;
  if (!apiKey) {
    fail("MESHY_API_KEY is not set. Add it to .env before running check-meshy.");
  }

  const { sessionDir, session } = loadSession(args.session);
  const paths = getSessionPaths(sessionDir);
  const { passId, pass, passDir } = getModelPass(paths, session, args.pass);
  ensureDir(passDir);

  const task = await meshyRequest(`/openapi/v1/image-to-3d/${pass.taskId}`, { apiKey });
  writeJson(path.join(passDir, "meshy-task.json"), task);

  pass.status = task.status;
  pass.updatedAt = new Date().toISOString();
  pass.progress = task.progress ?? null;

  const shouldDownload = Object.prototype.hasOwnProperty.call(args, "download");
  if (task.status === "SUCCEEDED" && shouldDownload) {
    const glbUrl = task.model_urls?.glb;
    const preRemeshedGlbUrl = task.model_urls?.pre_remeshed_glb;
    const thumbnailUrl = task.thumbnail_url;
    const texturesDir = path.join(passDir, "textures");
    pass.outputs = pass.outputs || {};

    if (glbUrl) {
      const glbFile = path.join(passDir, "model.glb");
      await downloadBinary(glbUrl, glbFile);
      pass.outputs.glb = toRelative(glbFile);
    }
    if (preRemeshedGlbUrl) {
      const preRemeshedGlbFile = path.join(passDir, "pre-remeshed-model.glb");
      await downloadBinary(preRemeshedGlbUrl, preRemeshedGlbFile);
      pass.outputs.preRemeshedGlb = toRelative(preRemeshedGlbFile);
    }
    if (thumbnailUrl) {
      const previewFile = path.join(passDir, "preview.png");
      await downloadBinary(thumbnailUrl, previewFile);
      pass.outputs.thumbnail = toRelative(previewFile);
    }
    if (Array.isArray(task.texture_urls) && task.texture_urls.length > 0) {
      pass.outputs.textures = await downloadTextureSet(task.texture_urls, texturesDir);
    }
  }

  session.stage = task.status === "SUCCEEDED" ? "model_review" : "model_generation";
  writeSessionArtifacts(session, sessionDir);
  console.log(`Meshy task ${pass.taskId} is ${task.status} for ${session.id} (${passId}).`);
}

function resolveCleanupSourceModel(args, pass) {
  if (args["source-model"]) {
    const sourceModel = resolvePath(args["source-model"]);
    if (!fs.existsSync(sourceModel)) {
      fail(`Could not find source model at ${toRelative(sourceModel)}.`);
    }
    return sourceModel;
  }

  const candidate = pass.outputs?.glb ? resolvePath(pass.outputs.glb) : null;
  if (candidate && fs.existsSync(candidate)) {
    return candidate;
  }

  const fallback = pass.outputs?.preRemeshedGlb ? resolvePath(pass.outputs.preRemeshedGlb) : null;
  if (fallback && fs.existsSync(fallback)) {
    return fallback;
  }

  fail(`No downloaded GLB is available yet for model pass ${pass.passId}.`);
}

function cleanupWithBlender(args) {
  if (!args.session) fail("The cleanup-blender command requires --session.");
  const { sessionDir, session } = loadSession(args.session);
  const paths = getSessionPaths(sessionDir);
  const blenderBinary = args.blender || process.env.BLENDER_BIN || process.env.BLENDER_BINARY;
  if (!blenderBinary) {
    fail("Set BLENDER_BIN or pass --blender with the Blender executable path before running cleanup-blender.");
  }

  const resolvedBlenderBinary = resolvePath(blenderBinary);
  if (!fs.existsSync(resolvedBlenderBinary)) {
    fail(`Could not find Blender binary at ${toRelative(resolvedBlenderBinary)}.`);
  }

  const { sourceModelPassId, sourceModel, sourceType } = resolveCleanupSource(args, paths, session);
  const cleanupPassId = getNextCleanupPassId(paths);
  const cleanupDir = path.join(paths.cleanupOutputDir, cleanupPassId);
  ensureDir(cleanupDir);

  const outputGlb = path.join(cleanupDir, "cleaned-model.glb");
  const reportFile = path.join(cleanupDir, "cleanup-report.json");
  const previewFile = path.join(cleanupDir, "preview.png");
  const targetHeight = args["target-height"] || "0.22";
  const maxTriangles = args["max-triangles"] || null;

  const blenderArgs = [
    "--background",
    "--python",
    path.join(ROOT, "scripts", "blender_cleanup.py"),
    "--",
    "--input",
    sourceModel,
    "--output",
    outputGlb,
    "--report",
    reportFile,
    "--target-height",
    targetHeight,
  ];

  if (maxTriangles) {
    blenderArgs.push("--max-triangles", maxTriangles);
  }

  if (!Object.prototype.hasOwnProperty.call(args, "skip-preview")) {
    blenderArgs.push("--preview", previewFile);
  }

  const result = spawnSync(resolvedBlenderBinary, blenderArgs, {
    cwd: ROOT,
    encoding: "utf8",
  });

  if (result.status !== 0) {
    const details = [result.stdout, result.stderr].filter(Boolean).join("\n");
    fail(`Blender cleanup failed.\n${details}`);
  }

  session.cleanupPasses = session.cleanupPasses || [];
  session.cleanupPasses.push({
    passId: cleanupPassId,
    sourceModelPassId,
    sourceType,
    sourceModel: toRelative(sourceModel),
    blenderBinary: toRelative(resolvedBlenderBinary),
    targetHeight: Number.parseFloat(targetHeight),
    maxTriangles: maxTriangles ? Number.parseInt(maxTriangles, 10) : null,
    createdAt: new Date().toISOString(),
    outputs: {
      glb: toRelative(outputGlb),
      report: toRelative(reportFile),
      preview: fs.existsSync(previewFile) ? toRelative(previewFile) : null,
    },
  });
  session.stage = "cleanup_review";
  writeSessionArtifacts(session, sessionDir);
  console.log(`Created Blender cleanup pass ${cleanupPassId} at ${toRelative(cleanupDir)}.`);
}

function loadSession(sessionArg) {
  const sessionDir = path.isAbsolute(sessionArg)
    ? sessionArg
    : path.join(ROOT, sessionArg);
  const paths = getSessionPaths(sessionDir);
  if (!fs.existsSync(paths.sessionFile)) {
    fail(`Could not find session.json at ${toRelative(paths.sessionFile)}`);
  }

  return {
    sessionDir,
    session: normalizeSession(readJson(paths.sessionFile)),
  };
}

function createSession(args) {
  const slug = slugify(args.slug || "");
  if (!slug) fail("The init command requires --slug.");
  if (!args.room) fail("The init command requires --room.");
  if (!args.category) fail("The init command requires --category.");

  const id = `${new Date().toISOString().slice(0, 10)}-${slug}`;
  const sessionDir = path.join(WORKBENCH_ROOT, id);
  if (fs.existsSync(sessionDir)) {
    fail(`Session already exists: ${toRelative(sessionDir)}`);
  }

  const scope = normalizeScope(args.scope, "single");
  const intent = normalizeIntent(args.intent, scope === "single" ? "production" : "exploration");
  const session = {
    id,
    slug,
    scope,
    intent,
    room: args.room,
    category: args.category,
    swapId: args["swap-id"] || null,
    intendedUse: args.use || "Presentation asset for the castle slice.",
    approximateSize: args.size || "Needs confirmation during concept review.",
    moodWords: (args.mood || "grounded, warm, practical, fantasy").split(",").map((part) => part.trim()).filter(Boolean),
    materialGoals: (args.materials || "wood, iron, worn finish").split(",").map((part) => part.trim()).filter(Boolean),
    styleConstraints: (args.style || "readable silhouette, game-friendly detail, no ornate overload").split(",").map((part) => part.trim()).filter(Boolean),
    lineage: null,
    referenceImage: null,
    referenceMode: null,
    selectedConcept: null,
    conceptPasses: [],
    childAssets: [],
    selectedRevision: null,
    revisionPasses: [],
    modelPasses: [],
    stage: "concept",
  };

  writeSessionArtifacts(session, sessionDir);
  console.log(`Created asset-agent session at ${toRelative(sessionDir)}`);
}

function spawnChildSession(args) {
  if (!args.session) fail("The spawn-child command requires --session.");
  const slug = slugify(args.slug || "");
  if (!slug) fail("The spawn-child command requires --slug.");
  if (!args.category) fail("The spawn-child command requires --category.");

  const { sessionDir: parentDir, session: parentSession } = loadSession(args.session);
  const parentPaths = getSessionPaths(parentDir);
  const sourceImage = resolve3dSourceImage(parentSession, parentPaths, args["source-image"]);
  const id = `${new Date().toISOString().slice(0, 10)}-${slug}`;
  const sessionDir = path.join(WORKBENCH_ROOT, id);
  if (fs.existsSync(sessionDir)) {
    fail(`Session already exists: ${toRelative(sessionDir)}`);
  }

  const childRole = args["child-role"] || null;
  const childIntent = normalizeIntent(args.intent, "production");
  const session = normalizeSession({
    id,
    slug,
    scope: "single",
    intent: childIntent,
    room: args.room || parentSession.room,
    category: args.category,
    swapId: args["swap-id"] || null,
    intendedUse: args.use || `Production-ready single asset derived from ${parentSession.id}.`,
    approximateSize: args.size || parentSession.approximateSize,
    moodWords: [...parentSession.moodWords],
    materialGoals: [...parentSession.materialGoals],
    styleConstraints: [...parentSession.styleConstraints],
    lineage: {
      parentSessionId: parentSession.id,
      parentScope: parentSession.scope,
      childRole,
      sourceImage: toRelative(sourceImage.filePath),
    },
    referenceImage: toRelative(sourceImage.filePath),
    referenceMode: "parent-approved-sheet",
    selectedConcept: null,
    conceptPasses: [],
    childAssets: [],
    selectedRevision: null,
    revisionPasses: [],
    modelPasses: [],
    stage: "concept",
  });

  parentSession.childAssets = parentSession.childAssets || [];
  parentSession.childAssets.push({
    sessionId: session.id,
    slug: session.slug,
    childRole,
    sourceImage: session.referenceImage,
    createdAt: new Date().toISOString(),
  });

  writeSessionArtifacts(session, sessionDir);
  writeSessionArtifacts(parentSession, parentDir);
  console.log(`Created child asset session at ${toRelative(sessionDir)} from ${parentSession.id}.`);
}

function refreshSession(args) {
  if (!args.session) fail("The refresh command requires --session.");
  const { sessionDir, session } = loadSession(args.session);
  const paths = getSessionPaths(sessionDir);
  migrateLegacyConceptOutputs(session, paths);
  migrateLegacyRevisionOutputs(session, paths);
  writeSessionArtifacts(session, sessionDir);
  console.log(`Refreshed asset-agent session at ${toRelative(sessionDir)}`);
}

function selectConcept(args) {
  if (!args.session) fail("The select command requires --session.");
  if (!args.concept) fail("The select command requires --concept.");

  const { sessionDir, session } = loadSession(args.session);
  const paths = getSessionPaths(sessionDir);
  migrateLegacyConceptOutputs(session, paths);
  const notes = args.notes
    ? args.notes.split("|").map((note) => note.trim()).filter(Boolean)
    : [];
  const passId = args.pass || getLatestConceptPassId(paths);

  session.selectedConcept = {
    passId,
    id: args.concept,
    revisionNotes: notes,
  };
  session.selectedRevision = null;
  session.stage = "refinement";

  writeSessionArtifacts(session, sessionDir);
  console.log(
    `Recorded selected concept ${args.concept} for ${session.id} at ${toRelative(sessionDir)}`,
  );
}

function ensure3dEligible(session) {
  if (session.intent !== "production") {
    fail(`Session ${session.id} is marked ${session.intent}. Only production sessions should move to 3D.`);
  }
  if (session.scope !== "single") {
    fail(`Session ${session.id} has scope ${session.scope}. Branch a single child asset session before preparing 3D.`);
  }
}

async function main() {
  ensureDir(WORKBENCH_ROOT);
  const { command, args } = parseArgs(process.argv);

  if (command === "init") {
    createSession(args);
    return;
  }

  if (command === "spawn-child") {
    spawnChildSession(args);
    return;
  }

  if (command === "refresh") {
    refreshSession(args);
    return;
  }

  if (command === "select") {
    selectConcept(args);
    return;
  }

  if (command === "select-revision") {
    selectRevision(args);
    return;
  }

  if (command === "generate-concepts") {
    await generateConcepts(args);
    return;
  }

  if (command === "generate-revisions") {
    await generateRevisions(args);
    return;
  }

  if (command === "prepare-3d") {
    prepare3d(args);
    return;
  }

  if (command === "submit-meshy") {
    await submitMeshy(args);
    return;
  }

  if (command === "check-meshy") {
    await checkMeshy(args);
    return;
  }

  if (command === "cleanup-blender") {
    cleanupWithBlender(args);
    return;
  }

  fail(`Unknown command: ${command}\n\n${usage}`);
}

await main();
