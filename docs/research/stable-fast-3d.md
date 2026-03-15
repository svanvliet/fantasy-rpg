# Stable Fast 3D (SF3D) — Mac Setup Guide

Step-by-step instructions for installing and running SF3D on a MacBook Pro M3 Max.

SF3D generates a UV-unwrapped, textured GLB mesh from a single image in seconds. It runs on Apple Silicon via the MPS (Metal) backend.

---

## Prerequisites

- macOS Sonoma or newer
- Apple Silicon Mac (M1/M2/M3/M4) with 32GB+ unified memory
- pyenv with Python 3.11 installed (`pyenv install 3.11`)
- Homebrew with libomp installed (`brew install libomp`)
- A Hugging Face account with model access granted (see Step 1)

---

## Step 1: Request Model Access on Hugging Face

The SF3D model weights are gated. You need to request access before you can download them.

1. Go to https://huggingface.co/stabilityai/stable-fast-3d
2. Log in (or create a free account)
3. Click **"Agree and access repository"** — access is typically granted instantly
4. Go to https://huggingface.co/settings/tokens
5. Create a new token with **Read** permissions
6. Save the token to `~/tools/stable-fast-3d/.env`:
   ```
   HF_TOKEN=hf_your_token_here
   ```

---

## Step 2: Run the Automated Setup

Everything is handled by `setup.sh`. It will:
- Verify prerequisites (Apple Silicon, pyenv, libomp, .env token)
- Clone the SF3D repository into `~/tools/stable-fast-3d/repo/`
- Create a Python 3.11 virtual environment at `~/tools/stable-fast-3d/.venv/`
- Install PyTorch, SF3D, and all dependencies
- Authenticate with Hugging Face and download model weights
- Run a verification test with an example image

```bash
cd ~/tools/stable-fast-3d
./setup.sh
```

The setup is verbose — it reports each step with ✔/⚠/✘ status indicators. On first run, expect it to take several minutes (mostly downloading model weights and installing dependencies).

If the verification test passes, you'll see:

```
✔ Verification passed! Generated .../verify-test/0/mesh.glb (XXK)
```

Open the verification GLB to confirm it looks right:
- **Quick Look**: select the file in Finder and press Space
- **Blender**: File → Import → glTF 2.0
- **Online**: drag the file into https://gltf-viewer.donmccurdy.com/

---

## Step 3: Generate 3D Models

Three scripts are provided in `~/tools/stable-fast-3d/`:

### Single image → GLB

```bash
./generate.sh <input-image> [output-dir] [texture-resolution]

# Examples:
./generate.sh concept.png
./generate.sh concept.png ./my-output
./generate.sh concept.png ./my-output 2048
```

Output: `<output-dir>/0/mesh.glb`

### Quad-remeshed (cleaner topology for game use)

```bash
./generate-quad.sh <input-image> [output-dir] [target-vertex-count]

# Examples:
./generate-quad.sh concept.png
./generate-quad.sh concept.png ./my-output 5000
```

### Batch (folder of images)

```bash
./generate-batch.sh <folder-of-images> [output-dir] [texture-resolution]

# Example:
./generate-batch.sh ./concept-images ./batch-output
```

Each image gets a numbered subfolder (0/, 1/, 2/, ...) containing `mesh.glb`.

---

## Usage from the Fantasy RPG Project

Generate a 3D model from any concept image in your asset sessions:

```bash
# Generate from an approved alchemy-table concept
~/tools/stable-fast-3d/generate.sh \
  asset-workbench/2026-03-14-alchemy-table/outputs/concepts/concept-01.png \
  asset-workbench/2026-03-14-alchemy-table/outputs/models

# Generate with cleaner topology (quad remesh, ~5000 vertices)
~/tools/stable-fast-3d/generate-quad.sh \
  asset-workbench/2026-03-14-alchemy-table/outputs/concepts/concept-01.png \
  asset-workbench/2026-03-14-alchemy-table/outputs/models \
  5000
```

After generation, the Blender cleanup workflow applies:
1. Open the GLB in Blender
2. Fix origin, scale, and forward axis
3. Decimate if needed
4. Export as `.glb` to `public/assets/models/alchemy-table.glb`

---

## Directory Layout

After setup, `~/tools/stable-fast-3d/` contains:

```
~/tools/stable-fast-3d/
├── .env                  # HF_TOKEN (you created this)
├── .venv/                # Python 3.11 virtual environment
├── repo/                 # Cloned SF3D repository
├── output/               # Default output directory
│   └── verify-test/      # Verification test output
├── setup.sh              # Automated setup script
├── generate.sh           # Single image → GLB
├── generate-quad.sh      # Single image → quad-remeshed GLB
└── generate-batch.sh     # Folder of images → batch GLBs
```

---

## CLI Reference

Full options for `run.py`:

| Flag | Default | Description |
|------|---------|-------------|
| `image` | (required) | Path to image(s) or a folder of images |
| `--output-dir` | `output/` | Where to save generated GLB files |
| `--texture-resolution` | `1024` | Texture atlas resolution in pixels (512, 1024, 2048) |
| `--remesh_option` | `none` | Remeshing: `none`, `triangle`, or `quad` |
| `--target_vertex_count` | `-1` | Target vertex count for remeshing (-1 = no reduction) |
| `--foreground-ratio` | `0.85` | How much of the image the object should fill after bg removal |
| `--batch_size` | `1` | Number of images to process at once |
| `--device` | auto-detected | Force `mps`, `cuda`, or `cpu` |

---

## Troubleshooting

### "MPS available: False"
- Make sure you're using Python 3.11 with PyTorch 2.4.0+
- Try `pip install --pre torch torchvision torchaudio` to get the nightly build

### OpenMP errors during build
- Verify `brew install libomp` completed successfully
- Check that `/opt/homebrew/opt/libomp/lib/libomp.dylib` exists

### Out of memory
- SF3D uses ~6GB with default settings, but MPS overhead can push this higher
- Lower `--texture-resolution` to `512` to reduce memory usage
- Close other GPU-intensive apps (Chrome, etc.)
- If still failing, use `SF3D_USE_CPU=1` to fall back to CPU (slower but no memory limit)

### Model download fails
- Verify you accepted the license at https://huggingface.co/stabilityai/stable-fast-3d
- Re-run setup.sh (it will re-authenticate and re-download)
- Check your internet connection

### Texture baking produces artifacts
- This is expected with the experimental MPS backend — it may not match CUDA output exactly
- Try different `--texture-resolution` values
- Compare against the hosted demo at https://huggingface.co/spaces/stabilityai/stable-fast-3d

---

## Performance Expectations

On an M3 Max with 64GB unified memory, expect:
- **First run**: ~30–60 seconds (model download + compilation)
- **Subsequent runs**: ~5–15 seconds per image (MPS is slower than CUDA's 0.5s, but still fast)
- **Memory usage**: ~6–10GB unified memory depending on texture resolution
- **Output**: UV-unwrapped GLB with albedo, roughness, and metallic maps

For comparison, CUDA on an RTX 4090 runs in ~0.5 seconds. The MPS backend is meaningfully slower but still practical for iterative asset work.
