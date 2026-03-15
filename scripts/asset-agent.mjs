#!/usr/bin/env node

import fs from "node:fs";
import path from "node:path";

const ROOT = process.cwd();
const WORKBENCH_ROOT = path.join(ROOT, "asset-workbench");
const DEFAULT_ORCHESTRATOR_MODEL = "gpt-5-mini";
const DEFAULT_IMAGE_MODEL = "gpt-image-1.5";

loadLocalEnv();

const usage = `Usage:
  npm run asset-agent -- init --slug <slug> --room <room> --category <category> [--swap-id <id>] [--use "<intended use>"] [--mood "<mood words>"]
  npm run asset-agent -- refresh --session <asset-workbench/session-folder>
  npm run asset-agent -- select --session <asset-workbench/session-folder> --concept <concept-id> [--notes "<revision notes>"]
  npm run asset-agent -- generate-concepts --session <asset-workbench/session-folder> [--model <main-model>] [--image-model <image-model>] [--size <widthxheight>] [--quality <quality>]
  npm run asset-agent -- generate-revisions --session <asset-workbench/session-folder> [--model <main-model>] [--image-model <image-model>] [--size <widthxheight>] [--quality <quality>] [--count <n>] [--source-image <path>]

Commands:
  init     Create a new prop-asset session with briefs, prompts, and provider job manifests.
  refresh  Rebuild markdown and job manifests from session.json.
  select   Record the chosen concept and create revision / 3D follow-up job manifests.
  generate-concepts  Call OpenAI image generation for the session prompts and write concept outputs.
  generate-revisions  Call OpenAI image generation using the selected concept as the refinement source.
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
  lines.push("- Concept refinement images");
  lines.push("- or first-pass image-to-3D model if the concept is approved");
  lines.push("");

  return `${lines.join("\n")}\n`;
}

function buildConceptJob(session) {
  const prompts = makeConceptPrompts(session);
  return {
    workflow: "openai-image-concepts",
    sessionId: session.id,
    asset: session.slug,
    recommendedOrchestratorModel: DEFAULT_ORCHESTRATOR_MODEL,
    recommendedImageModel: DEFAULT_IMAGE_MODEL,
    rationale: "Use a lower-cost orchestration model while keeping image generation on gpt-image-1.5.",
    outputDir: toRelative(getSessionPaths(path.join(WORKBENCH_ROOT, session.id)).conceptOutputDir),
    prompts,
    notes: [
      "Generate 3 concepts first and review before moving to 3D.",
      "Keep concepts isolated on plain backgrounds for stronger downstream 3D generation.",
      "If using Responses, prefer the image_generation tool with a mainline reasoning model orchestrating revisions.",
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

function buildMeshyJob(session) {
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
    preferredInput: "approved-concept-image",
    recommendedOutputFormat: "glb",
    notes: [
      "Use the approved concept image or revised concept set as the 3D source.",
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

  writeJson(paths.sessionFile, session);
  writeText(paths.briefFile, buildBrief(session));
  writeText(paths.promptsFile, buildPromptsDoc(session));
  writeText(paths.reviewFile, buildReviewDoc(session));
  writeJson(paths.conceptJobFile, buildConceptJob(session));
  writeJson(paths.revisionJobFile, buildRevisionJob(session));
  writeJson(paths.meshyJobFile, buildMeshyJob(session));
  if ((session.conceptPasses || []).length > 0) {
    writeText(paths.conceptIndexFile, buildConceptPassesIndex(session));
  }
  if ((session.revisionPasses || []).length > 0) {
    writeText(paths.revisionIndexFile, buildRevisionIndex(session));
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

  migrateLegacyConceptOutputs(session, paths);
  const passId = getNextConceptPassId(paths);
  const passDir = path.join(paths.conceptOutputDir, passId);
  ensureDir(passDir);
  const generatedConcepts = [];

  for (const promptSpec of conceptJob.prompts) {
    const response = await fetch("https://api.openai.com/v1/responses", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model,
        input: promptSpec.prompt,
        tools: [
          {
            type: "image_generation",
            model: imageModel,
            size,
            quality,
            background: "opaque",
            action: "generate",
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
            action: "generate",
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
    session: readJson(paths.sessionFile),
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

  const session = {
    id,
    slug,
    room: args.room,
    category: args.category,
    swapId: args["swap-id"] || null,
    intendedUse: args.use || "Presentation asset for the castle slice.",
    approximateSize: args.size || "Needs confirmation during concept review.",
    moodWords: (args.mood || "grounded, warm, practical, fantasy").split(",").map((part) => part.trim()).filter(Boolean),
    materialGoals: (args.materials || "wood, iron, worn finish").split(",").map((part) => part.trim()).filter(Boolean),
    styleConstraints: (args.style || "readable silhouette, game-friendly detail, no ornate overload").split(",").map((part) => part.trim()).filter(Boolean),
    selectedConcept: null,
    conceptPasses: [],
    selectedRevision: null,
    revisionPasses: [],
    stage: "concept",
  };

  writeSessionArtifacts(session, sessionDir);
  console.log(`Created asset-agent session at ${toRelative(sessionDir)}`);
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

async function main() {
  ensureDir(WORKBENCH_ROOT);
  const { command, args } = parseArgs(process.argv);

  if (command === "init") {
    createSession(args);
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

  if (command === "generate-concepts") {
    await generateConcepts(args);
    return;
  }

  if (command === "generate-revisions") {
    await generateRevisions(args);
    return;
  }

  fail(`Unknown command: ${command}\n\n${usage}`);
}

await main();
