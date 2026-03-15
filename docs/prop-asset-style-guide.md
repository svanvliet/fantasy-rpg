# Prop Asset Style Guide

## Purpose
- Keep generated props visually coherent across the castle slice.
- Make asset creation reusable instead of treating every prop as a one-off hero object.
- Give the prop-asset workflow a stable style anchor before we move deeper into imported assets.

## Current Style Anchor
- Current anchor session:
  - [asset-workbench/2026-03-14-alchemy-table](/Users/svanvliet/repos/fantasy-rpg/asset-workbench/2026-03-14-alchemy-table)
- Approved anchor concept:
  - `concept-01`
- Why this anchor is useful:
  - painterly but readable
  - grounded silhouette
  - practical fantasy construction
  - strong material breakup without noisy ornament

## Core Style Rules

### Silhouette
- Prioritize strong large shapes first.
- Readability at first-person gameplay distance matters more than surface complexity.
- Props should feel sturdy and intentionally built, not fragile or over-filigreed.

### Ornament Level
- Default to restrained ornament.
- Use decorative carving or metalwork as accents, not as the whole identity of the prop.
- If a prop feels ornate, it should still look practical enough to exist in a lived-in castle room.

### Material Language
- Wood:
  - warm brown base
  - visible construction logic
  - worn edges, not hyper-damaged splintering
- Iron:
  - practical bands, straps, hinges, braces
  - darkened, slightly hand-forged feeling
- Glass:
  - readable shape first
  - color variation should mostly come from tint and contents
  - avoid excessive cut-glass complexity for common-use items
- Cloth/leather:
  - secondary support materials only unless the asset is explicitly soft goods

### Texture And Surface Reuse
- Prefer reusable material families over unique texture treatment for every prop.
- Reuse should come from:
  - shared wood tone family
  - shared iron treatment
  - shared glass treatment
  - repeatable stopper and label motifs
- New props should feel like they belong to the same world kit, not like isolated concept art exercises.

## Bottle Family System

### Goal
- Define a small reusable potion-container language for alchemy and consumables.
- Keep most item differentiation in data, tint, labels, and contents rather than unique meshes.

### Base Bottle Types
- `Tincture`
  - smallest silhouette
  - narrow or quick-use profile
  - reads as light and utilitarian
- `Draught`
  - medium utility bottle
  - standard adventuring / medicinal profile
  - likely the default most common potion form
- `Elixir`
  - taller or more premium silhouette
  - reads as more refined or potent
  - can support slightly richer stopper or label treatment

### Variant Rules
- Reuse the same base meshes across many items when possible.
- Differentiate variants with:
  - glass tint
  - liquid color
  - stopper treatment
  - label/icon language
  - rarity accents
- Do not create a unique bottle mesh for every potion unless it is a deliberate hero item.

### Shared Reusable Components
- Keep the center label band as a reusable shared component across the tincture, draught, and elixir family unless a specific item is meant to break the rule.
- Keep the neck metal ring / collar as a reusable shared component across the whole family.
- Treat those shared parts as part of the bottle family identity, not one-off decoration.
- Let the bottle body silhouette and scale carry most of the family variation.
- Let potion identity come primarily from:
  - liquid color
  - label markings
  - glass tint
  - stopper finish
  - minor rarity accents

## What To Keep Out
- Avoid cluttering tables with too many permanently modeled secondary props if those pieces can become reusable standalone assets later.
- Avoid texture complexity that prevents material reuse.
- Avoid visual realism that materially outpaces the rest of the slice.
