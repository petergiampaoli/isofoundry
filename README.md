# Isofoundry

A local-first, prompt-driven **isometric pixel-art style lab**. It finds a visual voice before it scales into an asset factory: you prompt, compare directions on the same calibration probes, lock the traits that matter, develop one **North Star** asset, and turn that asset into a measurable Style DNA.

This is **Milestone 1 — style and voice**. It is deliberately focused on the hardest part to fake: a consistent look that can be carried into characters, enemies, props, buildings, and landscape.

![Isofoundry style lab](docs/lab.png)

## What works

- **Prompt → four directions.** Prompts are parsed into structured changes: palette intent, shape language, detail budget, motion feel, voice axes, keywords, and anti-goals.
- **Calibration probes.** Every direction is rendered on the same tree, stone, and person. Comparison is apples-to-apples.
- **Live Style DNA.** Palette, form, finish, and motion sliders update the render immediately. Prompt refits show exactly what changed.
- **Trait locks.** Lock palette, form, detail, line, or motion so later prompts cannot move them.
- **North Star development.** Choose any subject, browse four variants, and step through sketch → refine → final. A four-frame motion study defines the motion voice.
- **Style Signature.** Locking the anchor extracts palette, value structure, edge density, detail entropy, silhouette complexity, outline weight, fill, and symmetry.
- **Style Fit Lab.** A contrasting asset is scored on-style against the anchor, and a deliberately drifted version is scored beside it. The score is explainable and is not a substitute for taste.

![Style fit lab](docs/fit-lab.png)
- **Creation journey.** Prompts, selections, locks, refinements, anchor decisions, tests, and exports are stored locally. The project can be exported and imported.
- **Asset archetypes.** Wanderer, enemy brute, tree, stone, shrine, crystal cluster, crate, and terrain tile. Each is generated from the same Style DNA.
- **Exports.** Style pack ZIP, style guide PNG, anchor PNG at 4×, motion sheet, style guide JSON, palette `.gpl`, project JSON, and a Godot 4 `SpriteFrames` resource.

## Run it

```bash
cd ~/Projects/isofoundry
npm install
npm run dev
```

Open <http://127.0.0.1:4173>.

The app saves the working project to `localStorage`. Use **Project .json** to archive it, **Import project** to restore it, and **New session** to start blank. **Reset demo** restores the starter prompt.

## The workflow

1. **Describe a feeling, not a genre.** Try a material, a mood, and an anti-goal:
   > Moss-eaten stone, practical iron, wind-worn cloth. Grounded and tactile, with a quiet strangeness. No glossy armor.
2. **Explore four directions.** Each card shows the same tree, stone, and person.
3. **Select a direction.** The live Style DNA opens on the right.
4. **Refine with prompts.** Say “colder light, rounder forms, heavier motion, no neon.” Or move the sliders directly.
5. **Lock traits.** Hold the palette or form while you explore other qualities.
6. **Develop the North Star.** Pick a subject, choose a variant, review sketch/refine/final, then lock it.
7. **Read the guide.** Check the palette, voice, signature, and motion study. Run the fit lab against a contrasting asset.
8. **Export.** The ZIP includes the anchor, frames, guide board, palette, journey, and Godot resource.

![North Star style guide](docs/guide.png)

## Export pack

```text
anchor/<name>@4x.png
anchor/<name>@1x.png
motion/idle_0..3.png
style-guide.png
style-guide.json
palette.gpl
project.json
godot/motion_frames.tres
godot/README.txt
README.md
```

The Godot resource was verified against **Godot 4.7.1**: copy `motion/` and `godot/motion_frames.tres` into a project and load the `SpriteFrames` resource.

## Verification

```bash
npm test       # deterministic renderer, signatures, prompt locks, Godot resource
npm run build  # typecheck + production build
```

The current suite has 11 tests. The exported Godot resource was loaded in a headless 4.7.1 project and confirmed to expose `idle` with four frames at 6 fps.

## Architecture

```text
src/
  lib/
    color.ts        OKLCH ramps, hue blending, alpha compositing
    palette.ts      material palette derivation
    dna.ts          Style DNA, voice axes, mutation and drift
    prompt.ts       prompt grammar, anti-goals, direction variation
    raster.ts       deterministic pixel buffer + hard-edged raster ops
    draw.ts         isometric primitives, shading, texture, outline
    assets/         tree, stone, character/enemy, building, crystal, crate
    render.ts       archetype dispatch and finalization
    signature.ts    Style Signature extraction + styleFit comparison
    export.ts       board, sheets, ZIP, palette, Godot SpriteFrames
  state/
    useProject.ts   project actions, journey, autosave
  components/
    Lab, Inspector, Develop, Guide, JourneyRail, canvases
```

The renderer is deterministic. A DNA record and a seed reproduce the same pixels; the journey is the source of truth, not the flattened PNG. The current renderer is a 2.5D isometric sprite engine with a pixel-art finishing pass. The planned next renderer step is a voxel-backed volume stage for guaranteed multi-view consistency.

## Design rules encoded in the product

- **Color:** OKLCH material ramps, hue-shifted shadows, controlled chroma, contrast checks.
- **Form:** roundness, chunkiness, spikiness, asymmetry, head scale, height.
- **Pixel craft:** selective outlines, cluster texture, dithering, no anti-aliasing.
- **Composition:** light from top-left, 2:1 isometric ground plane, readable silhouette at 1×, and a φ-bias control that weights character head/hip proportions and building roof/tier proportions. Toggle the φ overlay in the artboard to inspect the composition.
- **Motion:** weight, bounce, sway; four-frame motion studies.
- **Voice:** grounded, ornate, brutal, springy, vivid, gritty, plus keywords and anti-goals.
- **Heuristic:** hard style constraints plus anchor similarity. Scores rank candidates and flag drift; they never replace approval.

## Next milestones

- **M2 — Production pipeline:** primary-view assets at volume, terrain autotiles, modular buildings, validation gates, generic atlas export.
- **M3 — Views + animation:** four/eight-view promotion from a shared volume rig; idle, walk, run, attack, cast, hurt, and death clips; event markers, pivots, hitboxes.
- **M4 — World kit:** cliffs, water, roads, props, damage states, occlusion layers, scene preview, fuller Godot integration.
- **M5 — Studio scale:** local project folders, batch CLI, optional LLM art director, optional moodboard ingestion, desktop packaging.

## Notes

- No image-generation model is required. The prompt layer is deterministic and local.
- The optional LLM art director is not wired into this milestone; the interface is intentionally shaped so it can edit the same structured DNA rather than generate pixels.
- The goal is not to remove the artist. It is to make style decisions explicit, repeatable, and re-openable.
