# Chicken Character Art Prompts — Filled In (for Gemini)

One filled-in prompt set (Level 1 Chick, Level 2 Pullet/Cockerel, Level 3 Hen/Rooster)
per chicken, generated from the template in the chat and the roster in
[`data/chickens.json`](../data/chickens.json). Sex was inferred from each character's
name/pun; two were ambiguous and were resolved with the user (see per-chicken notes).
Each chicken's breed-specific visual facts (comb type, plumage color, body shape, etc.)
are baked directly into all 3 prompt blocks below, so a copy-pasted code block is
self-contained — you don't need to add anything extra for Gemini to pick up on.
Generate one chicken's 3 levels back-to-back in the same session so lighting, palette,
and proportions stay consistent across growth stages.

Shared style notes (already baked into every prompt below): painterly gouache/watercolor,
Everdell/Cascadia-style character art, warm golden-hour side lighting, muted warm palette,
simple low-detail background vignette, no text/numbers/icons/UI chrome, 3:4 portrait
aspect ratio, high-resolution print-quality with even margin for card-frame cropping.

---

## 1. Shellock Holmes — Polish Chicken (rooster)

**Visual identity (baked into the prompts below):** White-Crested Black Polish coloring — sleek black body plumage, a large rounded white crest/pompom of feathers on the head, a small red V-shaped comb (often partly hidden by the crest), and slate-blue legs.

**Note:** Locked to White-Crested Black Polish across all three levels for continuity — this chicken's first generation drifted across three different color stories (mottled chick, golden-laced cockerel, black-and-white rooster) before landing here. Re-generate all 3 levels with this baked-in description so they match.

### Level 1 — Chick 🐣

```
Generate a painterly gouache/watercolor illustration of a baby chick of the Polish Chicken
breed, rendered as a character token for a cozy farming-village board game (style
reference: Everdell, Cascadia).

Composition:
- Full-body, three-quarter side view, standing on both feet, facing right
- Round, fluffy down-covered body typical of a newly hatched chick — oversized head
  relative to body, no visible comb or wattle yet, short stub wings
- Down coloring/patterning should anticipate this bird's adult identity: White-Crested Black Polish coloring — sleek black body plumage, a large rounded white crest/pompom of feathers on the head, a small red V-shaped comb (often partly hidden by the crest), and slate-blue legs.
  Even as a fluffy hatchling, hint at these defining colors/markings where plausible
  for a chick (e.g. striped, solid, or mottled down leaning toward the adult palette)
- Soft warm golden-hour side lighting, gentle painterly brushwork, warm ochre/cream
  palette matching the game's overall art style
- Background: simple, low-detail warm vignette (soft cream-to-ochre gradient, hint of
  straw/hay texture) — no scenery, no other characters, no text

Critical:
- No text, numbers, icons, logos, or UI chrome anywhere in the image
- No hard outlines / no flat vector style — must match the painterly gouache texture
  of the board art
- 3:4 portrait aspect ratio, high resolution, print-quality, centered subject with even
  margin for card-frame cropping
```

### Level 2 — Pullet/Cockerel 🐥

```
Generate a painterly gouache/watercolor illustration of a juvenile cockerel (pullet or
cockerel) of the Polish Chicken breed, rendered as a character token for a cozy
farming-village board game (style reference: Everdell, Cascadia).

Composition:
- Full-body, three-quarter side view, standing on both feet, facing right, alert
  posture
- Proportions of an adolescent chicken — leaner and taller than a chick, feathers
  mostly grown in but with some juvenile down remaining around the neck/head, comb
  and wattle just beginning to develop (small, pale)
- Plumage pattern, color, and body type should reflect this bird's breed-accurate
  adult identity, now developing: White-Crested Black Polish coloring — sleek black body plumage, a large rounded white crest/pompom of feathers on the head, a small red V-shaped comb (often partly hidden by the crest), and slate-blue legs.
- Soft warm golden-hour side lighting, gentle painterly brushwork, warm palette
  consistent with the game's art style
- Background: simple, low-detail warm vignette matching the Level 1 chick — no
  scenery, no other characters, no text

Critical:
- No text, numbers, icons, logos, or UI chrome anywhere in the image
- No hard outlines / no flat vector style — must match the painterly gouache texture
  of the board art
- Keep pose, lighting angle, and background treatment consistent with the Level 1
  chick image of the same breed, so the two read as growth stages of one character
- 3:4 portrait aspect ratio, high resolution, print-quality, centered subject with even
  margin for card-frame cropping
```

### Level 3 — Hen/Rooster 🐓

```
Generate a painterly gouache/watercolor illustration of a full-grown rooster (hen or
rooster) of the Polish Chicken breed, rendered as a character token for a cozy
farming-village board game (style reference: Everdell, Cascadia).

Composition:
- Full-body, three-quarter side view, standing on both feet, facing right, confident
  adult posture
- Full adult plumage, breed-accurate comb type (single, pea, rose, walnut, etc.),
  wattle, ear-lobe color, leg color/feathering, and body shape/size for Polish Chicken
- Include breed-accurate tail sickle feathers and saddle feathers, and a
  larger comb/wattle appropriate for a Polish Chicken rooster
- Plumage color/pattern: White-Crested Black Polish coloring — sleek black body plumage, a large rounded white crest/pompom of feathers on the head, a small red V-shaped comb (often partly hidden by the crest), and slate-blue legs.
- Soft warm golden-hour side lighting, gentle painterly brushwork, warm palette
  consistent with the game's art style
- Background: simple, low-detail warm vignette matching Levels 1–2 — no scenery, no
  other characters, no text

Critical:
- No text, numbers, icons, logos, or UI chrome anywhere in the image
- No hard outlines / no flat vector style — must match the painterly gouache texture
  of the board art
- Keep pose, lighting angle, and background treatment consistent with the Level 1
  and Level 2 images of the same breed, so all three read as growth stages of one
  character
- 3:4 portrait aspect ratio, high resolution, print-quality, centered subject with even
  margin for card-frame cropping
```

---

## 2. Beowing — Ayam Cemani (rooster)

**Visual identity (baked into the prompts below):** Ayam Cemani coloring — entirely black, including feathers (with an iridescent beetle-green sheen), skin, comb, wattles, face, beak, and legs; no other colors anywhere on the bird.

### Level 1 — Chick 🐣

```
Generate a painterly gouache/watercolor illustration of a baby chick of the Ayam Cemani
breed, rendered as a character token for a cozy farming-village board game (style
reference: Everdell, Cascadia).

Composition:
- Full-body, three-quarter side view, standing on both feet, facing right
- Round, fluffy down-covered body typical of a newly hatched chick — oversized head
  relative to body, no visible comb or wattle yet, short stub wings
- Down coloring/patterning should anticipate this bird's adult identity: Ayam Cemani coloring — entirely black, including feathers (with an iridescent beetle-green sheen), skin, comb, wattles, face, beak, and legs; no other colors anywhere on the bird.
  Even as a fluffy hatchling, hint at these defining colors/markings where plausible
  for a chick (e.g. striped, solid, or mottled down leaning toward the adult palette)
- Soft warm golden-hour side lighting, gentle painterly brushwork, warm ochre/cream
  palette matching the game's overall art style
- Background: simple, low-detail warm vignette (soft cream-to-ochre gradient, hint of
  straw/hay texture) — no scenery, no other characters, no text

Critical:
- No text, numbers, icons, logos, or UI chrome anywhere in the image
- No hard outlines / no flat vector style — must match the painterly gouache texture
  of the board art
- 3:4 portrait aspect ratio, high resolution, print-quality, centered subject with even
  margin for card-frame cropping
```

### Level 2 — Pullet/Cockerel 🐥

```
Generate a painterly gouache/watercolor illustration of a juvenile cockerel (pullet or
cockerel) of the Ayam Cemani breed, rendered as a character token for a cozy
farming-village board game (style reference: Everdell, Cascadia).

Composition:
- Full-body, three-quarter side view, standing on both feet, facing right, alert
  posture
- Proportions of an adolescent chicken — leaner and taller than a chick, feathers
  mostly grown in but with some juvenile down remaining around the neck/head, comb
  and wattle just beginning to develop (small, pale)
- Plumage pattern, color, and body type should reflect this bird's breed-accurate
  adult identity, now developing: Ayam Cemani coloring — entirely black, including feathers (with an iridescent beetle-green sheen), skin, comb, wattles, face, beak, and legs; no other colors anywhere on the bird.
- Soft warm golden-hour side lighting, gentle painterly brushwork, warm palette
  consistent with the game's art style
- Background: simple, low-detail warm vignette matching the Level 1 chick — no
  scenery, no other characters, no text

Critical:
- No text, numbers, icons, logos, or UI chrome anywhere in the image
- No hard outlines / no flat vector style — must match the painterly gouache texture
  of the board art
- Keep pose, lighting angle, and background treatment consistent with the Level 1
  chick image of the same breed, so the two read as growth stages of one character
- 3:4 portrait aspect ratio, high resolution, print-quality, centered subject with even
  margin for card-frame cropping
```

### Level 3 — Hen/Rooster 🐓

```
Generate a painterly gouache/watercolor illustration of a full-grown rooster (hen or
rooster) of the Ayam Cemani breed, rendered as a character token for a cozy
farming-village board game (style reference: Everdell, Cascadia).

Composition:
- Full-body, three-quarter side view, standing on both feet, facing right, confident
  adult posture
- Full adult plumage, breed-accurate comb type (single, pea, rose, walnut, etc.),
  wattle, ear-lobe color, leg color/feathering, and body shape/size for Ayam Cemani
- Include breed-accurate tail sickle feathers and saddle feathers, and a
  larger comb/wattle appropriate for a Ayam Cemani rooster
- Plumage color/pattern: Ayam Cemani coloring — entirely black, including feathers (with an iridescent beetle-green sheen), skin, comb, wattles, face, beak, and legs; no other colors anywhere on the bird.
- Soft warm golden-hour side lighting, gentle painterly brushwork, warm palette
  consistent with the game's art style
- Background: simple, low-detail warm vignette matching Levels 1–2 — no scenery, no
  other characters, no text

Critical:
- No text, numbers, icons, logos, or UI chrome anywhere in the image
- No hard outlines / no flat vector style — must match the painterly gouache texture
  of the board art
- Keep pose, lighting angle, and background treatment consistent with the Level 1
  and Level 2 images of the same breed, so all three read as growth stages of one
  character
- 3:4 portrait aspect ratio, high resolution, print-quality, centered subject with even
  margin for card-frame cropping
```

---

## 3. Wyatt Chirp — Silkie (rooster)

**Visual identity (baked into the prompts below):** Silkie coloring — white, fur-like fluffy plumage that doesn't lie flat or zip together like normal feathers, contrasted with dark blue-black skin visible at the face, a dark walnut comb, turquoise-blue earlobes, and feathered legs/feet with five toes per foot.

**Note:** Silkies also come in black, blue, partridge, gray, and buff; white was picked for a clear dark-skin/light-plumage contrast. Swap the base color if you'd rather, but keep it the same across all 3 levels.

### Level 1 — Chick 🐣

```
Generate a painterly gouache/watercolor illustration of a baby chick of the Silkie
breed, rendered as a character token for a cozy farming-village board game (style
reference: Everdell, Cascadia).

Composition:
- Full-body, three-quarter side view, standing on both feet, facing right
- Round, fluffy down-covered body typical of a newly hatched chick — oversized head
  relative to body, no visible comb or wattle yet, short stub wings
- Down coloring/patterning should anticipate this bird's adult identity: Silkie coloring — white, fur-like fluffy plumage that doesn't lie flat or zip together like normal feathers, contrasted with dark blue-black skin visible at the face, a dark walnut comb, turquoise-blue earlobes, and feathered legs/feet with five toes per foot.
  Even as a fluffy hatchling, hint at these defining colors/markings where plausible
  for a chick (e.g. striped, solid, or mottled down leaning toward the adult palette)
- Soft warm golden-hour side lighting, gentle painterly brushwork, warm ochre/cream
  palette matching the game's overall art style
- Background: simple, low-detail warm vignette (soft cream-to-ochre gradient, hint of
  straw/hay texture) — no scenery, no other characters, no text

Critical:
- No text, numbers, icons, logos, or UI chrome anywhere in the image
- No hard outlines / no flat vector style — must match the painterly gouache texture
  of the board art
- 3:4 portrait aspect ratio, high resolution, print-quality, centered subject with even
  margin for card-frame cropping
```

### Level 2 — Pullet/Cockerel 🐥

```
Generate a painterly gouache/watercolor illustration of a juvenile cockerel (pullet or
cockerel) of the Silkie breed, rendered as a character token for a cozy
farming-village board game (style reference: Everdell, Cascadia).

Composition:
- Full-body, three-quarter side view, standing on both feet, facing right, alert
  posture
- Proportions of an adolescent chicken — leaner and taller than a chick, feathers
  mostly grown in but with some juvenile down remaining around the neck/head, comb
  and wattle just beginning to develop (small, pale)
- Plumage pattern, color, and body type should reflect this bird's breed-accurate
  adult identity, now developing: Silkie coloring — white, fur-like fluffy plumage that doesn't lie flat or zip together like normal feathers, contrasted with dark blue-black skin visible at the face, a dark walnut comb, turquoise-blue earlobes, and feathered legs/feet with five toes per foot.
- Soft warm golden-hour side lighting, gentle painterly brushwork, warm palette
  consistent with the game's art style
- Background: simple, low-detail warm vignette matching the Level 1 chick — no
  scenery, no other characters, no text

Critical:
- No text, numbers, icons, logos, or UI chrome anywhere in the image
- No hard outlines / no flat vector style — must match the painterly gouache texture
  of the board art
- Keep pose, lighting angle, and background treatment consistent with the Level 1
  chick image of the same breed, so the two read as growth stages of one character
- 3:4 portrait aspect ratio, high resolution, print-quality, centered subject with even
  margin for card-frame cropping
```

### Level 3 — Hen/Rooster 🐓

```
Generate a painterly gouache/watercolor illustration of a full-grown rooster (hen or
rooster) of the Silkie breed, rendered as a character token for a cozy
farming-village board game (style reference: Everdell, Cascadia).

Composition:
- Full-body, three-quarter side view, standing on both feet, facing right, confident
  adult posture
- Full adult plumage, breed-accurate comb type (single, pea, rose, walnut, etc.),
  wattle, ear-lobe color, leg color/feathering, and body shape/size for Silkie
- Include breed-accurate tail sickle feathers and saddle feathers, and a
  larger comb/wattle appropriate for a Silkie rooster
- Plumage color/pattern: Silkie coloring — white, fur-like fluffy plumage that doesn't lie flat or zip together like normal feathers, contrasted with dark blue-black skin visible at the face, a dark walnut comb, turquoise-blue earlobes, and feathered legs/feet with five toes per foot.
- Soft warm golden-hour side lighting, gentle painterly brushwork, warm palette
  consistent with the game's art style
- Background: simple, low-detail warm vignette matching Levels 1–2 — no scenery, no
  other characters, no text

Critical:
- No text, numbers, icons, logos, or UI chrome anywhere in the image
- No hard outlines / no flat vector style — must match the painterly gouache texture
  of the board art
- Keep pose, lighting angle, and background treatment consistent with the Level 1
  and Level 2 images of the same breed, so all three read as growth stages of one
  character
- 3:4 portrait aspect ratio, high resolution, print-quality, centered subject with even
  margin for card-frame cropping
```

---

## 4. Madam Chickovsky — Russian Orloff (hen)

**Visual identity (baked into the prompts below):** Russian Orloff coloring — mahogany/spangled reddish-brown plumage, a fierce hawk-like face with heavy brow ridges over the eyes, a small walnut comb, a full beard and muffs, dense cold-hardy feathering, and clean yellow legs.

### Level 1 — Chick 🐣

```
Generate a painterly gouache/watercolor illustration of a baby chick of the Russian Orloff
breed, rendered as a character token for a cozy farming-village board game (style
reference: Everdell, Cascadia).

Composition:
- Full-body, three-quarter side view, standing on both feet, facing right
- Round, fluffy down-covered body typical of a newly hatched chick — oversized head
  relative to body, no visible comb or wattle yet, short stub wings
- Down coloring/patterning should anticipate this bird's adult identity: Russian Orloff coloring — mahogany/spangled reddish-brown plumage, a fierce hawk-like face with heavy brow ridges over the eyes, a small walnut comb, a full beard and muffs, dense cold-hardy feathering, and clean yellow legs.
  Even as a fluffy hatchling, hint at these defining colors/markings where plausible
  for a chick (e.g. striped, solid, or mottled down leaning toward the adult palette)
- Soft warm golden-hour side lighting, gentle painterly brushwork, warm ochre/cream
  palette matching the game's overall art style
- Background: simple, low-detail warm vignette (soft cream-to-ochre gradient, hint of
  straw/hay texture) — no scenery, no other characters, no text

Critical:
- No text, numbers, icons, logos, or UI chrome anywhere in the image
- No hard outlines / no flat vector style — must match the painterly gouache texture
  of the board art
- 3:4 portrait aspect ratio, high resolution, print-quality, centered subject with even
  margin for card-frame cropping
```

### Level 2 — Pullet/Cockerel 🐥

```
Generate a painterly gouache/watercolor illustration of a juvenile pullet (pullet or
cockerel) of the Russian Orloff breed, rendered as a character token for a cozy
farming-village board game (style reference: Everdell, Cascadia).

Composition:
- Full-body, three-quarter side view, standing on both feet, facing right, alert
  posture
- Proportions of an adolescent chicken — leaner and taller than a chick, feathers
  mostly grown in but with some juvenile down remaining around the neck/head, comb
  and wattle just beginning to develop (small, pale)
- Plumage pattern, color, and body type should reflect this bird's breed-accurate
  adult identity, now developing: Russian Orloff coloring — mahogany/spangled reddish-brown plumage, a fierce hawk-like face with heavy brow ridges over the eyes, a small walnut comb, a full beard and muffs, dense cold-hardy feathering, and clean yellow legs.
- Soft warm golden-hour side lighting, gentle painterly brushwork, warm palette
  consistent with the game's art style
- Background: simple, low-detail warm vignette matching the Level 1 chick — no
  scenery, no other characters, no text

Critical:
- No text, numbers, icons, logos, or UI chrome anywhere in the image
- No hard outlines / no flat vector style — must match the painterly gouache texture
  of the board art
- Keep pose, lighting angle, and background treatment consistent with the Level 1
  chick image of the same breed, so the two read as growth stages of one character
- 3:4 portrait aspect ratio, high resolution, print-quality, centered subject with even
  margin for card-frame cropping
```

### Level 3 — Hen/Rooster 🐓

```
Generate a painterly gouache/watercolor illustration of a full-grown hen (hen or
rooster) of the Russian Orloff breed, rendered as a character token for a cozy
farming-village board game (style reference: Everdell, Cascadia).

Composition:
- Full-body, three-quarter side view, standing on both feet, facing right, confident
  adult posture
- Full adult plumage, breed-accurate comb type (single, pea, rose, walnut, etc.),
  wattle, ear-lobe color, leg color/feathering, and body shape/size for Russian Orloff
- Show breed-accurate body roundness and, where applicable, tail carriage
  and comb style appropriate for a Russian Orloff hen
- Plumage color/pattern: Russian Orloff coloring — mahogany/spangled reddish-brown plumage, a fierce hawk-like face with heavy brow ridges over the eyes, a small walnut comb, a full beard and muffs, dense cold-hardy feathering, and clean yellow legs.
- Soft warm golden-hour side lighting, gentle painterly brushwork, warm palette
  consistent with the game's art style
- Background: simple, low-detail warm vignette matching Levels 1–2 — no scenery, no
  other characters, no text

Critical:
- No text, numbers, icons, logos, or UI chrome anywhere in the image
- No hard outlines / no flat vector style — must match the painterly gouache texture
  of the board art
- Keep pose, lighting angle, and background treatment consistent with the Level 1
  and Level 2 images of the same breed, so all three read as growth stages of one
  character
- 3:4 portrait aspect ratio, high resolution, print-quality, centered subject with even
  margin for card-frame cropping
```

---

## 5. Cluckleberry Finn — Easter Egger (rooster)

**Visual identity (baked into the prompts below):** Easter Egger coloring — mixed reddish-brown and black penciled/mottled plumage, a full beard and muffs, a pea comb, and slate-green legs.

**Note:** Easter Egger isn't a standardized breed, so this exact plumage combination was picked arbitrarily to keep it consistent across levels — there's no single 'correct' look to match.

### Level 1 — Chick 🐣

```
Generate a painterly gouache/watercolor illustration of a baby chick of the Easter Egger
breed, rendered as a character token for a cozy farming-village board game (style
reference: Everdell, Cascadia).

Composition:
- Full-body, three-quarter side view, standing on both feet, facing right
- Round, fluffy down-covered body typical of a newly hatched chick — oversized head
  relative to body, no visible comb or wattle yet, short stub wings
- Down coloring/patterning should anticipate this bird's adult identity: Easter Egger coloring — mixed reddish-brown and black penciled/mottled plumage, a full beard and muffs, a pea comb, and slate-green legs.
  Even as a fluffy hatchling, hint at these defining colors/markings where plausible
  for a chick (e.g. striped, solid, or mottled down leaning toward the adult palette)
- Soft warm golden-hour side lighting, gentle painterly brushwork, warm ochre/cream
  palette matching the game's overall art style
- Background: simple, low-detail warm vignette (soft cream-to-ochre gradient, hint of
  straw/hay texture) — no scenery, no other characters, no text

Critical:
- No text, numbers, icons, logos, or UI chrome anywhere in the image
- No hard outlines / no flat vector style — must match the painterly gouache texture
  of the board art
- 3:4 portrait aspect ratio, high resolution, print-quality, centered subject with even
  margin for card-frame cropping
```

### Level 2 — Pullet/Cockerel 🐥

```
Generate a painterly gouache/watercolor illustration of a juvenile cockerel (pullet or
cockerel) of the Easter Egger breed, rendered as a character token for a cozy
farming-village board game (style reference: Everdell, Cascadia).

Composition:
- Full-body, three-quarter side view, standing on both feet, facing right, alert
  posture
- Proportions of an adolescent chicken — leaner and taller than a chick, feathers
  mostly grown in but with some juvenile down remaining around the neck/head, comb
  and wattle just beginning to develop (small, pale)
- Plumage pattern, color, and body type should reflect this bird's breed-accurate
  adult identity, now developing: Easter Egger coloring — mixed reddish-brown and black penciled/mottled plumage, a full beard and muffs, a pea comb, and slate-green legs.
- Soft warm golden-hour side lighting, gentle painterly brushwork, warm palette
  consistent with the game's art style
- Background: simple, low-detail warm vignette matching the Level 1 chick — no
  scenery, no other characters, no text

Critical:
- No text, numbers, icons, logos, or UI chrome anywhere in the image
- No hard outlines / no flat vector style — must match the painterly gouache texture
  of the board art
- Keep pose, lighting angle, and background treatment consistent with the Level 1
  chick image of the same breed, so the two read as growth stages of one character
- 3:4 portrait aspect ratio, high resolution, print-quality, centered subject with even
  margin for card-frame cropping
```

### Level 3 — Hen/Rooster 🐓

```
Generate a painterly gouache/watercolor illustration of a full-grown rooster (hen or
rooster) of the Easter Egger breed, rendered as a character token for a cozy
farming-village board game (style reference: Everdell, Cascadia).

Composition:
- Full-body, three-quarter side view, standing on both feet, facing right, confident
  adult posture
- Full adult plumage, breed-accurate comb type (single, pea, rose, walnut, etc.),
  wattle, ear-lobe color, leg color/feathering, and body shape/size for Easter Egger
- Include breed-accurate tail sickle feathers and saddle feathers, and a
  larger comb/wattle appropriate for a Easter Egger rooster
- Plumage color/pattern: Easter Egger coloring — mixed reddish-brown and black penciled/mottled plumage, a full beard and muffs, a pea comb, and slate-green legs.
- Soft warm golden-hour side lighting, gentle painterly brushwork, warm palette
  consistent with the game's art style
- Background: simple, low-detail warm vignette matching Levels 1–2 — no scenery, no
  other characters, no text

Critical:
- No text, numbers, icons, logos, or UI chrome anywhere in the image
- No hard outlines / no flat vector style — must match the painterly gouache texture
  of the board art
- Keep pose, lighting angle, and background treatment consistent with the Level 1
  and Level 2 images of the same breed, so all three read as growth stages of one
  character
- 3:4 portrait aspect ratio, high resolution, print-quality, centered subject with even
  margin for card-frame cropping
```

---

## 6. Eggatha Christie — Egyptian Fayoumi (hen)

**Visual identity (baked into the prompts below):** Egyptian Fayoumi coloring — fine silver-white and black barred (cuckoo-style) plumage all over, a single comb, slate-blue legs, and a small, lightweight, athletic body.

### Level 1 — Chick 🐣

```
Generate a painterly gouache/watercolor illustration of a baby chick of the Egyptian Fayoumi
breed, rendered as a character token for a cozy farming-village board game (style
reference: Everdell, Cascadia).

Composition:
- Full-body, three-quarter side view, standing on both feet, facing right
- Round, fluffy down-covered body typical of a newly hatched chick — oversized head
  relative to body, no visible comb or wattle yet, short stub wings
- Down coloring/patterning should anticipate this bird's adult identity: Egyptian Fayoumi coloring — fine silver-white and black barred (cuckoo-style) plumage all over, a single comb, slate-blue legs, and a small, lightweight, athletic body.
  Even as a fluffy hatchling, hint at these defining colors/markings where plausible
  for a chick (e.g. striped, solid, or mottled down leaning toward the adult palette)
- Soft warm golden-hour side lighting, gentle painterly brushwork, warm ochre/cream
  palette matching the game's overall art style
- Background: simple, low-detail warm vignette (soft cream-to-ochre gradient, hint of
  straw/hay texture) — no scenery, no other characters, no text

Critical:
- No text, numbers, icons, logos, or UI chrome anywhere in the image
- No hard outlines / no flat vector style — must match the painterly gouache texture
  of the board art
- 3:4 portrait aspect ratio, high resolution, print-quality, centered subject with even
  margin for card-frame cropping
```

### Level 2 — Pullet/Cockerel 🐥

```
Generate a painterly gouache/watercolor illustration of a juvenile pullet (pullet or
cockerel) of the Egyptian Fayoumi breed, rendered as a character token for a cozy
farming-village board game (style reference: Everdell, Cascadia).

Composition:
- Full-body, three-quarter side view, standing on both feet, facing right, alert
  posture
- Proportions of an adolescent chicken — leaner and taller than a chick, feathers
  mostly grown in but with some juvenile down remaining around the neck/head, comb
  and wattle just beginning to develop (small, pale)
- Plumage pattern, color, and body type should reflect this bird's breed-accurate
  adult identity, now developing: Egyptian Fayoumi coloring — fine silver-white and black barred (cuckoo-style) plumage all over, a single comb, slate-blue legs, and a small, lightweight, athletic body.
- Soft warm golden-hour side lighting, gentle painterly brushwork, warm palette
  consistent with the game's art style
- Background: simple, low-detail warm vignette matching the Level 1 chick — no
  scenery, no other characters, no text

Critical:
- No text, numbers, icons, logos, or UI chrome anywhere in the image
- No hard outlines / no flat vector style — must match the painterly gouache texture
  of the board art
- Keep pose, lighting angle, and background treatment consistent with the Level 1
  chick image of the same breed, so the two read as growth stages of one character
- 3:4 portrait aspect ratio, high resolution, print-quality, centered subject with even
  margin for card-frame cropping
```

### Level 3 — Hen/Rooster 🐓

```
Generate a painterly gouache/watercolor illustration of a full-grown hen (hen or
rooster) of the Egyptian Fayoumi breed, rendered as a character token for a cozy
farming-village board game (style reference: Everdell, Cascadia).

Composition:
- Full-body, three-quarter side view, standing on both feet, facing right, confident
  adult posture
- Full adult plumage, breed-accurate comb type (single, pea, rose, walnut, etc.),
  wattle, ear-lobe color, leg color/feathering, and body shape/size for Egyptian Fayoumi
- Show breed-accurate body roundness and, where applicable, tail carriage
  and comb style appropriate for a Egyptian Fayoumi hen
- Plumage color/pattern: Egyptian Fayoumi coloring — fine silver-white and black barred (cuckoo-style) plumage all over, a single comb, slate-blue legs, and a small, lightweight, athletic body.
- Soft warm golden-hour side lighting, gentle painterly brushwork, warm palette
  consistent with the game's art style
- Background: simple, low-detail warm vignette matching Levels 1–2 — no scenery, no
  other characters, no text

Critical:
- No text, numbers, icons, logos, or UI chrome anywhere in the image
- No hard outlines / no flat vector style — must match the painterly gouache texture
  of the board art
- Keep pose, lighting angle, and background treatment consistent with the Level 1
  and Level 2 images of the same breed, so all three read as growth stages of one
  character
- 3:4 portrait aspect ratio, high resolution, print-quality, centered subject with even
  margin for card-frame cropping
```

---

## 7. Cumberbill Rockefeather — Modern Game (rooster)

**Visual identity (baked into the prompts below):** Modern Game build — very long, thin legs, tight hard feathering (not fluffy), an upright stork-like stance, and a small tight single comb. Base plumage: black-breasted red (rich red-brown body with black tail and breast feathering).

**Note:** Modern Game comes in many recognized color varieties; black-breasted red was picked as a classic, easily-recognized choice.

### Level 1 — Chick 🐣

```
Generate a painterly gouache/watercolor illustration of a baby chick of the Modern Game
breed, rendered as a character token for a cozy farming-village board game (style
reference: Everdell, Cascadia).

Composition:
- Full-body, three-quarter side view, standing on both feet, facing right
- Round, fluffy down-covered body typical of a newly hatched chick — oversized head
  relative to body, no visible comb or wattle yet, short stub wings
- Down coloring/patterning should anticipate this bird's adult identity: Modern Game build — very long, thin legs, tight hard feathering (not fluffy), an upright stork-like stance, and a small tight single comb. Base plumage: black-breasted red (rich red-brown body with black tail and breast feathering).
  Even as a fluffy hatchling, hint at these defining colors/markings where plausible
  for a chick (e.g. striped, solid, or mottled down leaning toward the adult palette)
- Soft warm golden-hour side lighting, gentle painterly brushwork, warm ochre/cream
  palette matching the game's overall art style
- Background: simple, low-detail warm vignette (soft cream-to-ochre gradient, hint of
  straw/hay texture) — no scenery, no other characters, no text

Critical:
- No text, numbers, icons, logos, or UI chrome anywhere in the image
- No hard outlines / no flat vector style — must match the painterly gouache texture
  of the board art
- 3:4 portrait aspect ratio, high resolution, print-quality, centered subject with even
  margin for card-frame cropping
```

### Level 2 — Pullet/Cockerel 🐥

```
Generate a painterly gouache/watercolor illustration of a juvenile cockerel (pullet or
cockerel) of the Modern Game breed, rendered as a character token for a cozy
farming-village board game (style reference: Everdell, Cascadia).

Composition:
- Full-body, three-quarter side view, standing on both feet, facing right, alert
  posture
- Proportions of an adolescent chicken — leaner and taller than a chick, feathers
  mostly grown in but with some juvenile down remaining around the neck/head, comb
  and wattle just beginning to develop (small, pale)
- Plumage pattern, color, and body type should reflect this bird's breed-accurate
  adult identity, now developing: Modern Game build — very long, thin legs, tight hard feathering (not fluffy), an upright stork-like stance, and a small tight single comb. Base plumage: black-breasted red (rich red-brown body with black tail and breast feathering).
- Soft warm golden-hour side lighting, gentle painterly brushwork, warm palette
  consistent with the game's art style
- Background: simple, low-detail warm vignette matching the Level 1 chick — no
  scenery, no other characters, no text

Critical:
- No text, numbers, icons, logos, or UI chrome anywhere in the image
- No hard outlines / no flat vector style — must match the painterly gouache texture
  of the board art
- Keep pose, lighting angle, and background treatment consistent with the Level 1
  chick image of the same breed, so the two read as growth stages of one character
- 3:4 portrait aspect ratio, high resolution, print-quality, centered subject with even
  margin for card-frame cropping
```

### Level 3 — Hen/Rooster 🐓

```
Generate a painterly gouache/watercolor illustration of a full-grown rooster (hen or
rooster) of the Modern Game breed, rendered as a character token for a cozy
farming-village board game (style reference: Everdell, Cascadia).

Composition:
- Full-body, three-quarter side view, standing on both feet, facing right, confident
  adult posture
- Full adult plumage, breed-accurate comb type (single, pea, rose, walnut, etc.),
  wattle, ear-lobe color, leg color/feathering, and body shape/size for Modern Game
- Include breed-accurate tail sickle feathers and saddle feathers, and a
  larger comb/wattle appropriate for a Modern Game rooster
- Plumage color/pattern: Modern Game build — very long, thin legs, tight hard feathering (not fluffy), an upright stork-like stance, and a small tight single comb. Base plumage: black-breasted red (rich red-brown body with black tail and breast feathering).
- Soft warm golden-hour side lighting, gentle painterly brushwork, warm palette
  consistent with the game's art style
- Background: simple, low-detail warm vignette matching Levels 1–2 — no scenery, no
  other characters, no text

Critical:
- No text, numbers, icons, logos, or UI chrome anywhere in the image
- No hard outlines / no flat vector style — must match the painterly gouache texture
  of the board art
- Keep pose, lighting angle, and background treatment consistent with the Level 1
  and Level 2 images of the same breed, so all three read as growth stages of one
  character
- 3:4 portrait aspect ratio, high resolution, print-quality, centered subject with even
  margin for card-frame cropping
```

---

## 8. Annie Yolkley — Rhode Island Red (hen)

**Visual identity (baked into the prompts below):** Rhode Island Red coloring — deep, rich mahogany/dark red-brown plumage (not light orange), a rectangular brick-shaped body, a single comb, and reddish-brown or yellow legs.

### Level 1 — Chick 🐣

```
Generate a painterly gouache/watercolor illustration of a baby chick of the Rhode Island Red
breed, rendered as a character token for a cozy farming-village board game (style
reference: Everdell, Cascadia).

Composition:
- Full-body, three-quarter side view, standing on both feet, facing right
- Round, fluffy down-covered body typical of a newly hatched chick — oversized head
  relative to body, no visible comb or wattle yet, short stub wings
- Down coloring/patterning should anticipate this bird's adult identity: Rhode Island Red coloring — deep, rich mahogany/dark red-brown plumage (not light orange), a rectangular brick-shaped body, a single comb, and reddish-brown or yellow legs.
  Even as a fluffy hatchling, hint at these defining colors/markings where plausible
  for a chick (e.g. striped, solid, or mottled down leaning toward the adult palette)
- Soft warm golden-hour side lighting, gentle painterly brushwork, warm ochre/cream
  palette matching the game's overall art style
- Background: simple, low-detail warm vignette (soft cream-to-ochre gradient, hint of
  straw/hay texture) — no scenery, no other characters, no text

Critical:
- No text, numbers, icons, logos, or UI chrome anywhere in the image
- No hard outlines / no flat vector style — must match the painterly gouache texture
  of the board art
- 3:4 portrait aspect ratio, high resolution, print-quality, centered subject with even
  margin for card-frame cropping
```

### Level 2 — Pullet/Cockerel 🐥

```
Generate a painterly gouache/watercolor illustration of a juvenile pullet (pullet or
cockerel) of the Rhode Island Red breed, rendered as a character token for a cozy
farming-village board game (style reference: Everdell, Cascadia).

Composition:
- Full-body, three-quarter side view, standing on both feet, facing right, alert
  posture
- Proportions of an adolescent chicken — leaner and taller than a chick, feathers
  mostly grown in but with some juvenile down remaining around the neck/head, comb
  and wattle just beginning to develop (small, pale)
- Plumage pattern, color, and body type should reflect this bird's breed-accurate
  adult identity, now developing: Rhode Island Red coloring — deep, rich mahogany/dark red-brown plumage (not light orange), a rectangular brick-shaped body, a single comb, and reddish-brown or yellow legs.
- Soft warm golden-hour side lighting, gentle painterly brushwork, warm palette
  consistent with the game's art style
- Background: simple, low-detail warm vignette matching the Level 1 chick — no
  scenery, no other characters, no text

Critical:
- No text, numbers, icons, logos, or UI chrome anywhere in the image
- No hard outlines / no flat vector style — must match the painterly gouache texture
  of the board art
- Keep pose, lighting angle, and background treatment consistent with the Level 1
  chick image of the same breed, so the two read as growth stages of one character
- 3:4 portrait aspect ratio, high resolution, print-quality, centered subject with even
  margin for card-frame cropping
```

### Level 3 — Hen/Rooster 🐓

```
Generate a painterly gouache/watercolor illustration of a full-grown hen (hen or
rooster) of the Rhode Island Red breed, rendered as a character token for a cozy
farming-village board game (style reference: Everdell, Cascadia).

Composition:
- Full-body, three-quarter side view, standing on both feet, facing right, confident
  adult posture
- Full adult plumage, breed-accurate comb type (single, pea, rose, walnut, etc.),
  wattle, ear-lobe color, leg color/feathering, and body shape/size for Rhode Island Red
- Show breed-accurate body roundness and, where applicable, tail carriage
  and comb style appropriate for a Rhode Island Red hen
- Plumage color/pattern: Rhode Island Red coloring — deep, rich mahogany/dark red-brown plumage (not light orange), a rectangular brick-shaped body, a single comb, and reddish-brown or yellow legs.
- Soft warm golden-hour side lighting, gentle painterly brushwork, warm palette
  consistent with the game's art style
- Background: simple, low-detail warm vignette matching Levels 1–2 — no scenery, no
  other characters, no text

Critical:
- No text, numbers, icons, logos, or UI chrome anywhere in the image
- No hard outlines / no flat vector style — must match the painterly gouache texture
  of the board art
- Keep pose, lighting angle, and background treatment consistent with the Level 1
  and Level 2 images of the same breed, so all three read as growth stages of one
  character
- 3:4 portrait aspect ratio, high resolution, print-quality, centered subject with even
  margin for card-frame cropping
```

---

## 9. General Tso — Dragon Chicken (rooster)

**Visual identity (baked into the prompts below):** Invented "Dragon Chicken" identity — dramatic deep red-and-gold plumage reminiscent of a Chinese dragon, elongated flame-like tail and hackle feathers, and a sharp, angular comb suggestive of small dragon horns/spikes.

**Note:** "Dragon Chicken" isn't a real-world breed — this is an invented look for the game's flavor name. Keep this exact description across all 3 levels since there's no real breed standard to fall back on.

### Level 1 — Chick 🐣

```
Generate a painterly gouache/watercolor illustration of a baby chick of the Dragon Chicken
breed, rendered as a character token for a cozy farming-village board game (style
reference: Everdell, Cascadia).

Composition:
- Full-body, three-quarter side view, standing on both feet, facing right
- Round, fluffy down-covered body typical of a newly hatched chick — oversized head
  relative to body, no visible comb or wattle yet, short stub wings
- Down coloring/patterning should anticipate this bird's adult identity: Invented "Dragon Chicken" identity — dramatic deep red-and-gold plumage reminiscent of a Chinese dragon, elongated flame-like tail and hackle feathers, and a sharp, angular comb suggestive of small dragon horns/spikes.
  Even as a fluffy hatchling, hint at these defining colors/markings where plausible
  for a chick (e.g. striped, solid, or mottled down leaning toward the adult palette)
- Soft warm golden-hour side lighting, gentle painterly brushwork, warm ochre/cream
  palette matching the game's overall art style
- Background: simple, low-detail warm vignette (soft cream-to-ochre gradient, hint of
  straw/hay texture) — no scenery, no other characters, no text

Critical:
- No text, numbers, icons, logos, or UI chrome anywhere in the image
- No hard outlines / no flat vector style — must match the painterly gouache texture
  of the board art
- 3:4 portrait aspect ratio, high resolution, print-quality, centered subject with even
  margin for card-frame cropping
```

### Level 2 — Pullet/Cockerel 🐥

```
Generate a painterly gouache/watercolor illustration of a juvenile cockerel (pullet or
cockerel) of the Dragon Chicken breed, rendered as a character token for a cozy
farming-village board game (style reference: Everdell, Cascadia).

Composition:
- Full-body, three-quarter side view, standing on both feet, facing right, alert
  posture
- Proportions of an adolescent chicken — leaner and taller than a chick, feathers
  mostly grown in but with some juvenile down remaining around the neck/head, comb
  and wattle just beginning to develop (small, pale)
- Plumage pattern, color, and body type should reflect this bird's breed-accurate
  adult identity, now developing: Invented "Dragon Chicken" identity — dramatic deep red-and-gold plumage reminiscent of a Chinese dragon, elongated flame-like tail and hackle feathers, and a sharp, angular comb suggestive of small dragon horns/spikes.
- Soft warm golden-hour side lighting, gentle painterly brushwork, warm palette
  consistent with the game's art style
- Background: simple, low-detail warm vignette matching the Level 1 chick — no
  scenery, no other characters, no text

Critical:
- No text, numbers, icons, logos, or UI chrome anywhere in the image
- No hard outlines / no flat vector style — must match the painterly gouache texture
  of the board art
- Keep pose, lighting angle, and background treatment consistent with the Level 1
  chick image of the same breed, so the two read as growth stages of one character
- 3:4 portrait aspect ratio, high resolution, print-quality, centered subject with even
  margin for card-frame cropping
```

### Level 3 — Hen/Rooster 🐓

```
Generate a painterly gouache/watercolor illustration of a full-grown rooster (hen or
rooster) of the Dragon Chicken breed, rendered as a character token for a cozy
farming-village board game (style reference: Everdell, Cascadia).

Composition:
- Full-body, three-quarter side view, standing on both feet, facing right, confident
  adult posture
- Full adult plumage, breed-accurate comb type (single, pea, rose, walnut, etc.),
  wattle, ear-lobe color, leg color/feathering, and body shape/size for Dragon Chicken
- Include breed-accurate tail sickle feathers and saddle feathers, and a
  larger comb/wattle appropriate for a Dragon Chicken rooster
- Plumage color/pattern: Invented "Dragon Chicken" identity — dramatic deep red-and-gold plumage reminiscent of a Chinese dragon, elongated flame-like tail and hackle feathers, and a sharp, angular comb suggestive of small dragon horns/spikes.
- Soft warm golden-hour side lighting, gentle painterly brushwork, warm palette
  consistent with the game's art style
- Background: simple, low-detail warm vignette matching Levels 1–2 — no scenery, no
  other characters, no text

Critical:
- No text, numbers, icons, logos, or UI chrome anywhere in the image
- No hard outlines / no flat vector style — must match the painterly gouache texture
  of the board art
- Keep pose, lighting angle, and background treatment consistent with the Level 1
  and Level 2 images of the same breed, so all three read as growth stages of one
  character
- 3:4 portrait aspect ratio, high resolution, print-quality, centered subject with even
  margin for card-frame cropping
```

---

## 10. Wingston Coophill — Serama (rooster)

**Visual identity (baked into the prompts below):** Serama build — the world's smallest chicken breed: tiny miniature stature, an extremely upright breast-forward "toy soldier" posture, wings held straight down almost touching the ground, and the tail held high and near-vertical. Base plumage: warm brown and black mottled feathering.

**Note:** Serama comes in many color varieties; brown/black mottled was picked as a reasonable default.

### Level 1 — Chick 🐣

```
Generate a painterly gouache/watercolor illustration of a baby chick of the Serama
breed, rendered as a character token for a cozy farming-village board game (style
reference: Everdell, Cascadia).

Composition:
- Full-body, three-quarter side view, standing on both feet, facing right
- Round, fluffy down-covered body typical of a newly hatched chick — oversized head
  relative to body, no visible comb or wattle yet, short stub wings
- Down coloring/patterning should anticipate this bird's adult identity: Serama build — the world's smallest chicken breed: tiny miniature stature, an extremely upright breast-forward "toy soldier" posture, wings held straight down almost touching the ground, and the tail held high and near-vertical. Base plumage: warm brown and black mottled feathering.
  Even as a fluffy hatchling, hint at these defining colors/markings where plausible
  for a chick (e.g. striped, solid, or mottled down leaning toward the adult palette)
- Soft warm golden-hour side lighting, gentle painterly brushwork, warm ochre/cream
  palette matching the game's overall art style
- Background: simple, low-detail warm vignette (soft cream-to-ochre gradient, hint of
  straw/hay texture) — no scenery, no other characters, no text

Critical:
- No text, numbers, icons, logos, or UI chrome anywhere in the image
- No hard outlines / no flat vector style — must match the painterly gouache texture
  of the board art
- 3:4 portrait aspect ratio, high resolution, print-quality, centered subject with even
  margin for card-frame cropping
```

### Level 2 — Pullet/Cockerel 🐥

```
Generate a painterly gouache/watercolor illustration of a juvenile cockerel (pullet or
cockerel) of the Serama breed, rendered as a character token for a cozy
farming-village board game (style reference: Everdell, Cascadia).

Composition:
- Full-body, three-quarter side view, standing on both feet, facing right, alert
  posture
- Proportions of an adolescent chicken — leaner and taller than a chick, feathers
  mostly grown in but with some juvenile down remaining around the neck/head, comb
  and wattle just beginning to develop (small, pale)
- Plumage pattern, color, and body type should reflect this bird's breed-accurate
  adult identity, now developing: Serama build — the world's smallest chicken breed: tiny miniature stature, an extremely upright breast-forward "toy soldier" posture, wings held straight down almost touching the ground, and the tail held high and near-vertical. Base plumage: warm brown and black mottled feathering.
- Soft warm golden-hour side lighting, gentle painterly brushwork, warm palette
  consistent with the game's art style
- Background: simple, low-detail warm vignette matching the Level 1 chick — no
  scenery, no other characters, no text

Critical:
- No text, numbers, icons, logos, or UI chrome anywhere in the image
- No hard outlines / no flat vector style — must match the painterly gouache texture
  of the board art
- Keep pose, lighting angle, and background treatment consistent with the Level 1
  chick image of the same breed, so the two read as growth stages of one character
- 3:4 portrait aspect ratio, high resolution, print-quality, centered subject with even
  margin for card-frame cropping
```

### Level 3 — Hen/Rooster 🐓

```
Generate a painterly gouache/watercolor illustration of a full-grown rooster (hen or
rooster) of the Serama breed, rendered as a character token for a cozy
farming-village board game (style reference: Everdell, Cascadia).

Composition:
- Full-body, three-quarter side view, standing on both feet, facing right, confident
  adult posture
- Full adult plumage, breed-accurate comb type (single, pea, rose, walnut, etc.),
  wattle, ear-lobe color, leg color/feathering, and body shape/size for Serama
- Include breed-accurate tail sickle feathers and saddle feathers, and a
  larger comb/wattle appropriate for a Serama rooster
- Plumage color/pattern: Serama build — the world's smallest chicken breed: tiny miniature stature, an extremely upright breast-forward "toy soldier" posture, wings held straight down almost touching the ground, and the tail held high and near-vertical. Base plumage: warm brown and black mottled feathering.
- Soft warm golden-hour side lighting, gentle painterly brushwork, warm palette
  consistent with the game's art style
- Background: simple, low-detail warm vignette matching Levels 1–2 — no scenery, no
  other characters, no text

Critical:
- No text, numbers, icons, logos, or UI chrome anywhere in the image
- No hard outlines / no flat vector style — must match the painterly gouache texture
  of the board art
- Keep pose, lighting angle, and background treatment consistent with the Level 1
  and Level 2 images of the same breed, so all three read as growth stages of one
  character
- 3:4 portrait aspect ratio, high resolution, print-quality, centered subject with even
  margin for card-frame cropping
```

---

## 11. Atilla the Hen — Jersey Giant (rooster)

**Visual identity (baked into the prompts below):** Jersey Giant build — one of the largest chicken breeds: a massive, broad, and deep body, solid black plumage, and dark (black/slate) legs.

**Note:** Rendered as a rooster per your call, despite the "Hen" pun in the name.

### Level 1 — Chick 🐣

```
Generate a painterly gouache/watercolor illustration of a baby chick of the Jersey Giant
breed, rendered as a character token for a cozy farming-village board game (style
reference: Everdell, Cascadia).

Composition:
- Full-body, three-quarter side view, standing on both feet, facing right
- Round, fluffy down-covered body typical of a newly hatched chick — oversized head
  relative to body, no visible comb or wattle yet, short stub wings
- Down coloring/patterning should anticipate this bird's adult identity: Jersey Giant build — one of the largest chicken breeds: a massive, broad, and deep body, solid black plumage, and dark (black/slate) legs.
  Even as a fluffy hatchling, hint at these defining colors/markings where plausible
  for a chick (e.g. striped, solid, or mottled down leaning toward the adult palette)
- Soft warm golden-hour side lighting, gentle painterly brushwork, warm ochre/cream
  palette matching the game's overall art style
- Background: simple, low-detail warm vignette (soft cream-to-ochre gradient, hint of
  straw/hay texture) — no scenery, no other characters, no text

Critical:
- No text, numbers, icons, logos, or UI chrome anywhere in the image
- No hard outlines / no flat vector style — must match the painterly gouache texture
  of the board art
- 3:4 portrait aspect ratio, high resolution, print-quality, centered subject with even
  margin for card-frame cropping
```

### Level 2 — Pullet/Cockerel 🐥

```
Generate a painterly gouache/watercolor illustration of a juvenile cockerel (pullet or
cockerel) of the Jersey Giant breed, rendered as a character token for a cozy
farming-village board game (style reference: Everdell, Cascadia).

Composition:
- Full-body, three-quarter side view, standing on both feet, facing right, alert
  posture
- Proportions of an adolescent chicken — leaner and taller than a chick, feathers
  mostly grown in but with some juvenile down remaining around the neck/head, comb
  and wattle just beginning to develop (small, pale)
- Plumage pattern, color, and body type should reflect this bird's breed-accurate
  adult identity, now developing: Jersey Giant build — one of the largest chicken breeds: a massive, broad, and deep body, solid black plumage, and dark (black/slate) legs.
- Soft warm golden-hour side lighting, gentle painterly brushwork, warm palette
  consistent with the game's art style
- Background: simple, low-detail warm vignette matching the Level 1 chick — no
  scenery, no other characters, no text

Critical:
- No text, numbers, icons, logos, or UI chrome anywhere in the image
- No hard outlines / no flat vector style — must match the painterly gouache texture
  of the board art
- Keep pose, lighting angle, and background treatment consistent with the Level 1
  chick image of the same breed, so the two read as growth stages of one character
- 3:4 portrait aspect ratio, high resolution, print-quality, centered subject with even
  margin for card-frame cropping
```

### Level 3 — Hen/Rooster 🐓

```
Generate a painterly gouache/watercolor illustration of a full-grown rooster (hen or
rooster) of the Jersey Giant breed, rendered as a character token for a cozy
farming-village board game (style reference: Everdell, Cascadia).

Composition:
- Full-body, three-quarter side view, standing on both feet, facing right, confident
  adult posture
- Full adult plumage, breed-accurate comb type (single, pea, rose, walnut, etc.),
  wattle, ear-lobe color, leg color/feathering, and body shape/size for Jersey Giant
- Include breed-accurate tail sickle feathers and saddle feathers, and a
  larger comb/wattle appropriate for a Jersey Giant rooster
- Plumage color/pattern: Jersey Giant build — one of the largest chicken breeds: a massive, broad, and deep body, solid black plumage, and dark (black/slate) legs.
- Soft warm golden-hour side lighting, gentle painterly brushwork, warm palette
  consistent with the game's art style
- Background: simple, low-detail warm vignette matching Levels 1–2 — no scenery, no
  other characters, no text

Critical:
- No text, numbers, icons, logos, or UI chrome anywhere in the image
- No hard outlines / no flat vector style — must match the painterly gouache texture
  of the board art
- Keep pose, lighting angle, and background treatment consistent with the Level 1
  and Level 2 images of the same breed, so all three read as growth stages of one
  character
- 3:4 portrait aspect ratio, high resolution, print-quality, centered subject with even
  margin for card-frame cropping
```

---

## 12. Princess Layer — Death Layer (hen)

**Visual identity (baked into the prompts below):** Invented "Death Layer" identity — sleek jet-black or deep purple-black plumage with a subtle iridescent sheen, an elegant regal upright posture, and dramatic dark coloring throughout (comb, wattle, and legs all dark).

**Note:** "Death Layer" isn't a real-world breed — this is an invented look for the game's flavor name, paired with the "Princess" theme. Keep this exact description across all 3 levels.

### Level 1 — Chick 🐣

```
Generate a painterly gouache/watercolor illustration of a baby chick of the Death Layer
breed, rendered as a character token for a cozy farming-village board game (style
reference: Everdell, Cascadia).

Composition:
- Full-body, three-quarter side view, standing on both feet, facing right
- Round, fluffy down-covered body typical of a newly hatched chick — oversized head
  relative to body, no visible comb or wattle yet, short stub wings
- Down coloring/patterning should anticipate this bird's adult identity: Invented "Death Layer" identity — sleek jet-black or deep purple-black plumage with a subtle iridescent sheen, an elegant regal upright posture, and dramatic dark coloring throughout (comb, wattle, and legs all dark).
  Even as a fluffy hatchling, hint at these defining colors/markings where plausible
  for a chick (e.g. striped, solid, or mottled down leaning toward the adult palette)
- Soft warm golden-hour side lighting, gentle painterly brushwork, warm ochre/cream
  palette matching the game's overall art style
- Background: simple, low-detail warm vignette (soft cream-to-ochre gradient, hint of
  straw/hay texture) — no scenery, no other characters, no text

Critical:
- No text, numbers, icons, logos, or UI chrome anywhere in the image
- No hard outlines / no flat vector style — must match the painterly gouache texture
  of the board art
- 3:4 portrait aspect ratio, high resolution, print-quality, centered subject with even
  margin for card-frame cropping
```

### Level 2 — Pullet/Cockerel 🐥

```
Generate a painterly gouache/watercolor illustration of a juvenile pullet (pullet or
cockerel) of the Death Layer breed, rendered as a character token for a cozy
farming-village board game (style reference: Everdell, Cascadia).

Composition:
- Full-body, three-quarter side view, standing on both feet, facing right, alert
  posture
- Proportions of an adolescent chicken — leaner and taller than a chick, feathers
  mostly grown in but with some juvenile down remaining around the neck/head, comb
  and wattle just beginning to develop (small, pale)
- Plumage pattern, color, and body type should reflect this bird's breed-accurate
  adult identity, now developing: Invented "Death Layer" identity — sleek jet-black or deep purple-black plumage with a subtle iridescent sheen, an elegant regal upright posture, and dramatic dark coloring throughout (comb, wattle, and legs all dark).
- Soft warm golden-hour side lighting, gentle painterly brushwork, warm palette
  consistent with the game's art style
- Background: simple, low-detail warm vignette matching the Level 1 chick — no
  scenery, no other characters, no text

Critical:
- No text, numbers, icons, logos, or UI chrome anywhere in the image
- No hard outlines / no flat vector style — must match the painterly gouache texture
  of the board art
- Keep pose, lighting angle, and background treatment consistent with the Level 1
  chick image of the same breed, so the two read as growth stages of one character
- 3:4 portrait aspect ratio, high resolution, print-quality, centered subject with even
  margin for card-frame cropping
```

### Level 3 — Hen/Rooster 🐓

```
Generate a painterly gouache/watercolor illustration of a full-grown hen (hen or
rooster) of the Death Layer breed, rendered as a character token for a cozy
farming-village board game (style reference: Everdell, Cascadia).

Composition:
- Full-body, three-quarter side view, standing on both feet, facing right, confident
  adult posture
- Full adult plumage, breed-accurate comb type (single, pea, rose, walnut, etc.),
  wattle, ear-lobe color, leg color/feathering, and body shape/size for Death Layer
- Show breed-accurate body roundness and, where applicable, tail carriage
  and comb style appropriate for a Death Layer hen
- Plumage color/pattern: Invented "Death Layer" identity — sleek jet-black or deep purple-black plumage with a subtle iridescent sheen, an elegant regal upright posture, and dramatic dark coloring throughout (comb, wattle, and legs all dark).
- Soft warm golden-hour side lighting, gentle painterly brushwork, warm palette
  consistent with the game's art style
- Background: simple, low-detail warm vignette matching Levels 1–2 — no scenery, no
  other characters, no text

Critical:
- No text, numbers, icons, logos, or UI chrome anywhere in the image
- No hard outlines / no flat vector style — must match the painterly gouache texture
  of the board art
- Keep pose, lighting angle, and background treatment consistent with the Level 1
  and Level 2 images of the same breed, so all three read as growth stages of one
  character
- 3:4 portrait aspect ratio, high resolution, print-quality, centered subject with even
  margin for card-frame cropping
```

---

## 13. Chickira — Onagadori (hen)

**Visual identity (baked into the prompts below):** Onagadori coloring — black-red plumage (black body with red/orange hackle and saddle feathering), a red single comb, and an unusually long, flowing, elegant tail — longer than typical for a hen of this breed, as a stylized character flourish.

**Note:** True long-tailed Onagadori show specimens are almost always male; the long tail here is an intentional flourish fitting the "diva" name rather than strict breed realism.

### Level 1 — Chick 🐣

```
Generate a painterly gouache/watercolor illustration of a baby chick of the Onagadori
breed, rendered as a character token for a cozy farming-village board game (style
reference: Everdell, Cascadia).

Composition:
- Full-body, three-quarter side view, standing on both feet, facing right
- Round, fluffy down-covered body typical of a newly hatched chick — oversized head
  relative to body, no visible comb or wattle yet, short stub wings
- Down coloring/patterning should anticipate this bird's adult identity: Onagadori coloring — black-red plumage (black body with red/orange hackle and saddle feathering), a red single comb, and an unusually long, flowing, elegant tail — longer than typical for a hen of this breed, as a stylized character flourish.
  Even as a fluffy hatchling, hint at these defining colors/markings where plausible
  for a chick (e.g. striped, solid, or mottled down leaning toward the adult palette)
- Soft warm golden-hour side lighting, gentle painterly brushwork, warm ochre/cream
  palette matching the game's overall art style
- Background: simple, low-detail warm vignette (soft cream-to-ochre gradient, hint of
  straw/hay texture) — no scenery, no other characters, no text

Critical:
- No text, numbers, icons, logos, or UI chrome anywhere in the image
- No hard outlines / no flat vector style — must match the painterly gouache texture
  of the board art
- 3:4 portrait aspect ratio, high resolution, print-quality, centered subject with even
  margin for card-frame cropping
```

### Level 2 — Pullet/Cockerel 🐥

```
Generate a painterly gouache/watercolor illustration of a juvenile pullet (pullet or
cockerel) of the Onagadori breed, rendered as a character token for a cozy
farming-village board game (style reference: Everdell, Cascadia).

Composition:
- Full-body, three-quarter side view, standing on both feet, facing right, alert
  posture
- Proportions of an adolescent chicken — leaner and taller than a chick, feathers
  mostly grown in but with some juvenile down remaining around the neck/head, comb
  and wattle just beginning to develop (small, pale)
- Plumage pattern, color, and body type should reflect this bird's breed-accurate
  adult identity, now developing: Onagadori coloring — black-red plumage (black body with red/orange hackle and saddle feathering), a red single comb, and an unusually long, flowing, elegant tail — longer than typical for a hen of this breed, as a stylized character flourish.
- Soft warm golden-hour side lighting, gentle painterly brushwork, warm palette
  consistent with the game's art style
- Background: simple, low-detail warm vignette matching the Level 1 chick — no
  scenery, no other characters, no text

Critical:
- No text, numbers, icons, logos, or UI chrome anywhere in the image
- No hard outlines / no flat vector style — must match the painterly gouache texture
  of the board art
- Keep pose, lighting angle, and background treatment consistent with the Level 1
  chick image of the same breed, so the two read as growth stages of one character
- 3:4 portrait aspect ratio, high resolution, print-quality, centered subject with even
  margin for card-frame cropping
```

### Level 3 — Hen/Rooster 🐓

```
Generate a painterly gouache/watercolor illustration of a full-grown hen (hen or
rooster) of the Onagadori breed, rendered as a character token for a cozy
farming-village board game (style reference: Everdell, Cascadia).

Composition:
- Full-body, three-quarter side view, standing on both feet, facing right, confident
  adult posture
- Full adult plumage, breed-accurate comb type (single, pea, rose, walnut, etc.),
  wattle, ear-lobe color, leg color/feathering, and body shape/size for Onagadori
- Show breed-accurate body roundness and, where applicable, tail carriage
  and comb style appropriate for a Onagadori hen
- Plumage color/pattern: Onagadori coloring — black-red plumage (black body with red/orange hackle and saddle feathering), a red single comb, and an unusually long, flowing, elegant tail — longer than typical for a hen of this breed, as a stylized character flourish.
- Soft warm golden-hour side lighting, gentle painterly brushwork, warm palette
  consistent with the game's art style
- Background: simple, low-detail warm vignette matching Levels 1–2 — no scenery, no
  other characters, no text

Critical:
- No text, numbers, icons, logos, or UI chrome anywhere in the image
- No hard outlines / no flat vector style — must match the painterly gouache texture
  of the board art
- Keep pose, lighting angle, and background treatment consistent with the Level 1
  and Level 2 images of the same breed, so all three read as growth stages of one
  character
- 3:4 portrait aspect ratio, high resolution, print-quality, centered subject with even
  margin for card-frame cropping
```

---

## 14. Broods Lee — Japanese Fizzle Chabo (rooster)

**Visual identity (baked into the prompts below):** Frizzle Chabo build — frizzled plumage where each feather curls outward/backward instead of lying flat (a windswept, permed look), combined with Chabo/Japanese Bantam traits: extremely short legs and a large tail carried high, near-vertical over the back, on a small compact body. Base plumage: warm buff/golden with a frizzled texture throughout.

**Note:** Rendered as a rooster per your call, per the Bruce Lee pun. Base color (buff/golden) was picked arbitrarily since Frizzle/Chabo crosses aren't tied to one fixed color.

### Level 1 — Chick 🐣

```
Generate a painterly gouache/watercolor illustration of a baby chick of the Japanese Fizzle Chabo
breed, rendered as a character token for a cozy farming-village board game (style
reference: Everdell, Cascadia).

Composition:
- Full-body, three-quarter side view, standing on both feet, facing right
- Round, fluffy down-covered body typical of a newly hatched chick — oversized head
  relative to body, no visible comb or wattle yet, short stub wings
- Down coloring/patterning should anticipate this bird's adult identity: Frizzle Chabo build — frizzled plumage where each feather curls outward/backward instead of lying flat (a windswept, permed look), combined with Chabo/Japanese Bantam traits: extremely short legs and a large tail carried high, near-vertical over the back, on a small compact body. Base plumage: warm buff/golden with a frizzled texture throughout.
  Even as a fluffy hatchling, hint at these defining colors/markings where plausible
  for a chick (e.g. striped, solid, or mottled down leaning toward the adult palette)
- Soft warm golden-hour side lighting, gentle painterly brushwork, warm ochre/cream
  palette matching the game's overall art style
- Background: simple, low-detail warm vignette (soft cream-to-ochre gradient, hint of
  straw/hay texture) — no scenery, no other characters, no text

Critical:
- No text, numbers, icons, logos, or UI chrome anywhere in the image
- No hard outlines / no flat vector style — must match the painterly gouache texture
  of the board art
- 3:4 portrait aspect ratio, high resolution, print-quality, centered subject with even
  margin for card-frame cropping
```

### Level 2 — Pullet/Cockerel 🐥

```
Generate a painterly gouache/watercolor illustration of a juvenile cockerel (pullet or
cockerel) of the Japanese Fizzle Chabo breed, rendered as a character token for a cozy
farming-village board game (style reference: Everdell, Cascadia).

Composition:
- Full-body, three-quarter side view, standing on both feet, facing right, alert
  posture
- Proportions of an adolescent chicken — leaner and taller than a chick, feathers
  mostly grown in but with some juvenile down remaining around the neck/head, comb
  and wattle just beginning to develop (small, pale)
- Plumage pattern, color, and body type should reflect this bird's breed-accurate
  adult identity, now developing: Frizzle Chabo build — frizzled plumage where each feather curls outward/backward instead of lying flat (a windswept, permed look), combined with Chabo/Japanese Bantam traits: extremely short legs and a large tail carried high, near-vertical over the back, on a small compact body. Base plumage: warm buff/golden with a frizzled texture throughout.
- Soft warm golden-hour side lighting, gentle painterly brushwork, warm palette
  consistent with the game's art style
- Background: simple, low-detail warm vignette matching the Level 1 chick — no
  scenery, no other characters, no text

Critical:
- No text, numbers, icons, logos, or UI chrome anywhere in the image
- No hard outlines / no flat vector style — must match the painterly gouache texture
  of the board art
- Keep pose, lighting angle, and background treatment consistent with the Level 1
  chick image of the same breed, so the two read as growth stages of one character
- 3:4 portrait aspect ratio, high resolution, print-quality, centered subject with even
  margin for card-frame cropping
```

### Level 3 — Hen/Rooster 🐓

```
Generate a painterly gouache/watercolor illustration of a full-grown rooster (hen or
rooster) of the Japanese Fizzle Chabo breed, rendered as a character token for a cozy
farming-village board game (style reference: Everdell, Cascadia).

Composition:
- Full-body, three-quarter side view, standing on both feet, facing right, confident
  adult posture
- Full adult plumage, breed-accurate comb type (single, pea, rose, walnut, etc.),
  wattle, ear-lobe color, leg color/feathering, and body shape/size for Japanese Fizzle Chabo
- Include breed-accurate tail sickle feathers and saddle feathers, and a
  larger comb/wattle appropriate for a Japanese Fizzle Chabo rooster
- Plumage color/pattern: Frizzle Chabo build — frizzled plumage where each feather curls outward/backward instead of lying flat (a windswept, permed look), combined with Chabo/Japanese Bantam traits: extremely short legs and a large tail carried high, near-vertical over the back, on a small compact body. Base plumage: warm buff/golden with a frizzled texture throughout.
- Soft warm golden-hour side lighting, gentle painterly brushwork, warm palette
  consistent with the game's art style
- Background: simple, low-detail warm vignette matching Levels 1–2 — no scenery, no
  other characters, no text

Critical:
- No text, numbers, icons, logos, or UI chrome anywhere in the image
- No hard outlines / no flat vector style — must match the painterly gouache texture
  of the board art
- Keep pose, lighting angle, and background treatment consistent with the Level 1
  and Level 2 images of the same breed, so all three read as growth stages of one
  character
- 3:4 portrait aspect ratio, high resolution, print-quality, centered subject with even
  margin for card-frame cropping
```

---

## 15. J.R.R. Yolkien — Sebright Chicken (rooster)

**Visual identity (baked into the prompts below):** Sebright coloring — small bantam body with laced plumage (each feather has a crisp dark edge around a lighter gold base color), a rose comb, and hen-feathering: this rooster lacks the pointed sickle/hackle tail feathers typical of most roosters and instead has a more rounded, hen-like tail and body shape.

**Note:** Sebright roosters are naturally hen-feathered in real life — the "no sickle tail feathers" instruction is baked into the Level 3 prompt so Gemini doesn't default to adding one.

### Level 1 — Chick 🐣

```
Generate a painterly gouache/watercolor illustration of a baby chick of the Sebright Chicken
breed, rendered as a character token for a cozy farming-village board game (style
reference: Everdell, Cascadia).

Composition:
- Full-body, three-quarter side view, standing on both feet, facing right
- Round, fluffy down-covered body typical of a newly hatched chick — oversized head
  relative to body, no visible comb or wattle yet, short stub wings
- Down coloring/patterning should anticipate this bird's adult identity: Sebright coloring — small bantam body with laced plumage (each feather has a crisp dark edge around a lighter gold base color), a rose comb, and hen-feathering: this rooster lacks the pointed sickle/hackle tail feathers typical of most roosters and instead has a more rounded, hen-like tail and body shape.
  Even as a fluffy hatchling, hint at these defining colors/markings where plausible
  for a chick (e.g. striped, solid, or mottled down leaning toward the adult palette)
- Soft warm golden-hour side lighting, gentle painterly brushwork, warm ochre/cream
  palette matching the game's overall art style
- Background: simple, low-detail warm vignette (soft cream-to-ochre gradient, hint of
  straw/hay texture) — no scenery, no other characters, no text

Critical:
- No text, numbers, icons, logos, or UI chrome anywhere in the image
- No hard outlines / no flat vector style — must match the painterly gouache texture
  of the board art
- 3:4 portrait aspect ratio, high resolution, print-quality, centered subject with even
  margin for card-frame cropping
```

### Level 2 — Pullet/Cockerel 🐥

```
Generate a painterly gouache/watercolor illustration of a juvenile cockerel (pullet or
cockerel) of the Sebright Chicken breed, rendered as a character token for a cozy
farming-village board game (style reference: Everdell, Cascadia).

Composition:
- Full-body, three-quarter side view, standing on both feet, facing right, alert
  posture
- Proportions of an adolescent chicken — leaner and taller than a chick, feathers
  mostly grown in but with some juvenile down remaining around the neck/head, comb
  and wattle just beginning to develop (small, pale)
- Plumage pattern, color, and body type should reflect this bird's breed-accurate
  adult identity, now developing: Sebright coloring — small bantam body with laced plumage (each feather has a crisp dark edge around a lighter gold base color), a rose comb, and hen-feathering: this rooster lacks the pointed sickle/hackle tail feathers typical of most roosters and instead has a more rounded, hen-like tail and body shape.
- Soft warm golden-hour side lighting, gentle painterly brushwork, warm palette
  consistent with the game's art style
- Background: simple, low-detail warm vignette matching the Level 1 chick — no
  scenery, no other characters, no text

Critical:
- No text, numbers, icons, logos, or UI chrome anywhere in the image
- No hard outlines / no flat vector style — must match the painterly gouache texture
  of the board art
- Keep pose, lighting angle, and background treatment consistent with the Level 1
  chick image of the same breed, so the two read as growth stages of one character
- 3:4 portrait aspect ratio, high resolution, print-quality, centered subject with even
  margin for card-frame cropping
```

### Level 3 — Hen/Rooster 🐓

```
Generate a painterly gouache/watercolor illustration of a full-grown rooster (hen or
rooster) of the Sebright Chicken breed, rendered as a character token for a cozy
farming-village board game (style reference: Everdell, Cascadia).

Composition:
- Full-body, three-quarter side view, standing on both feet, facing right, confident
  adult posture
- Full adult plumage, breed-accurate comb type (single, pea, rose, walnut, etc.),
  wattle, ear-lobe color, leg color/feathering, and body shape/size for Sebright Chicken
- Include breed-accurate tail sickle feathers and saddle feathers, and a
  larger comb/wattle appropriate for a Sebright Chicken rooster
- Plumage color/pattern: Sebright coloring — small bantam body with laced plumage (each feather has a crisp dark edge around a lighter gold base color), a rose comb, and hen-feathering: this rooster lacks the pointed sickle/hackle tail feathers typical of most roosters and instead has a more rounded, hen-like tail and body shape.
- Soft warm golden-hour side lighting, gentle painterly brushwork, warm palette
  consistent with the game's art style
- Background: simple, low-detail warm vignette matching Levels 1–2 — no scenery, no
  other characters, no text

Critical:
- No text, numbers, icons, logos, or UI chrome anywhere in the image
- No hard outlines / no flat vector style — must match the painterly gouache texture
  of the board art
- Keep pose, lighting angle, and background treatment consistent with the Level 1
  and Level 2 images of the same breed, so all three read as growth stages of one
  character
- 3:4 portrait aspect ratio, high resolution, print-quality, centered subject with even
  margin for card-frame cropping
```

---

## 16. Cluck Norris — Freedom Ranger (rooster)

**Visual identity (baked into the prompts below):** Freedom Ranger coloring — robust red-brown and white feathering, a sturdy broad body, yellow legs, and a single comb, rendered hardy and rugged rather than ornamental.

### Level 1 — Chick 🐣

```
Generate a painterly gouache/watercolor illustration of a baby chick of the Freedom Ranger
breed, rendered as a character token for a cozy farming-village board game (style
reference: Everdell, Cascadia).

Composition:
- Full-body, three-quarter side view, standing on both feet, facing right
- Round, fluffy down-covered body typical of a newly hatched chick — oversized head
  relative to body, no visible comb or wattle yet, short stub wings
- Down coloring/patterning should anticipate this bird's adult identity: Freedom Ranger coloring — robust red-brown and white feathering, a sturdy broad body, yellow legs, and a single comb, rendered hardy and rugged rather than ornamental.
  Even as a fluffy hatchling, hint at these defining colors/markings where plausible
  for a chick (e.g. striped, solid, or mottled down leaning toward the adult palette)
- Soft warm golden-hour side lighting, gentle painterly brushwork, warm ochre/cream
  palette matching the game's overall art style
- Background: simple, low-detail warm vignette (soft cream-to-ochre gradient, hint of
  straw/hay texture) — no scenery, no other characters, no text

Critical:
- No text, numbers, icons, logos, or UI chrome anywhere in the image
- No hard outlines / no flat vector style — must match the painterly gouache texture
  of the board art
- 3:4 portrait aspect ratio, high resolution, print-quality, centered subject with even
  margin for card-frame cropping
```

### Level 2 — Pullet/Cockerel 🐥

```
Generate a painterly gouache/watercolor illustration of a juvenile cockerel (pullet or
cockerel) of the Freedom Ranger breed, rendered as a character token for a cozy
farming-village board game (style reference: Everdell, Cascadia).

Composition:
- Full-body, three-quarter side view, standing on both feet, facing right, alert
  posture
- Proportions of an adolescent chicken — leaner and taller than a chick, feathers
  mostly grown in but with some juvenile down remaining around the neck/head, comb
  and wattle just beginning to develop (small, pale)
- Plumage pattern, color, and body type should reflect this bird's breed-accurate
  adult identity, now developing: Freedom Ranger coloring — robust red-brown and white feathering, a sturdy broad body, yellow legs, and a single comb, rendered hardy and rugged rather than ornamental.
- Soft warm golden-hour side lighting, gentle painterly brushwork, warm palette
  consistent with the game's art style
- Background: simple, low-detail warm vignette matching the Level 1 chick — no
  scenery, no other characters, no text

Critical:
- No text, numbers, icons, logos, or UI chrome anywhere in the image
- No hard outlines / no flat vector style — must match the painterly gouache texture
  of the board art
- Keep pose, lighting angle, and background treatment consistent with the Level 1
  chick image of the same breed, so the two read as growth stages of one character
- 3:4 portrait aspect ratio, high resolution, print-quality, centered subject with even
  margin for card-frame cropping
```

### Level 3 — Hen/Rooster 🐓

```
Generate a painterly gouache/watercolor illustration of a full-grown rooster (hen or
rooster) of the Freedom Ranger breed, rendered as a character token for a cozy
farming-village board game (style reference: Everdell, Cascadia).

Composition:
- Full-body, three-quarter side view, standing on both feet, facing right, confident
  adult posture
- Full adult plumage, breed-accurate comb type (single, pea, rose, walnut, etc.),
  wattle, ear-lobe color, leg color/feathering, and body shape/size for Freedom Ranger
- Include breed-accurate tail sickle feathers and saddle feathers, and a
  larger comb/wattle appropriate for a Freedom Ranger rooster
- Plumage color/pattern: Freedom Ranger coloring — robust red-brown and white feathering, a sturdy broad body, yellow legs, and a single comb, rendered hardy and rugged rather than ornamental.
- Soft warm golden-hour side lighting, gentle painterly brushwork, warm palette
  consistent with the game's art style
- Background: simple, low-detail warm vignette matching Levels 1–2 — no scenery, no
  other characters, no text

Critical:
- No text, numbers, icons, logos, or UI chrome anywhere in the image
- No hard outlines / no flat vector style — must match the painterly gouache texture
  of the board art
- Keep pose, lighting angle, and background treatment consistent with the Level 1
  and Level 2 images of the same breed, so all three read as growth stages of one
  character
- 3:4 portrait aspect ratio, high resolution, print-quality, centered subject with even
  margin for card-frame cropping
```

---

## 17. Aracorn, Heir of Condor — La Fleche (rooster)

**Visual identity (baked into the prompts below):** La Fleche coloring — sleek black plumage, a distinctive V-shaped "devil horns" comb (two upright spikes instead of a single ridge), white earlobes, little to no wattle, and willow-green legs.

### Level 1 — Chick 🐣

```
Generate a painterly gouache/watercolor illustration of a baby chick of the La Fleche
breed, rendered as a character token for a cozy farming-village board game (style
reference: Everdell, Cascadia).

Composition:
- Full-body, three-quarter side view, standing on both feet, facing right
- Round, fluffy down-covered body typical of a newly hatched chick — oversized head
  relative to body, no visible comb or wattle yet, short stub wings
- Down coloring/patterning should anticipate this bird's adult identity: La Fleche coloring — sleek black plumage, a distinctive V-shaped "devil horns" comb (two upright spikes instead of a single ridge), white earlobes, little to no wattle, and willow-green legs.
  Even as a fluffy hatchling, hint at these defining colors/markings where plausible
  for a chick (e.g. striped, solid, or mottled down leaning toward the adult palette)
- Soft warm golden-hour side lighting, gentle painterly brushwork, warm ochre/cream
  palette matching the game's overall art style
- Background: simple, low-detail warm vignette (soft cream-to-ochre gradient, hint of
  straw/hay texture) — no scenery, no other characters, no text

Critical:
- No text, numbers, icons, logos, or UI chrome anywhere in the image
- No hard outlines / no flat vector style — must match the painterly gouache texture
  of the board art
- 3:4 portrait aspect ratio, high resolution, print-quality, centered subject with even
  margin for card-frame cropping
```

### Level 2 — Pullet/Cockerel 🐥

```
Generate a painterly gouache/watercolor illustration of a juvenile cockerel (pullet or
cockerel) of the La Fleche breed, rendered as a character token for a cozy
farming-village board game (style reference: Everdell, Cascadia).

Composition:
- Full-body, three-quarter side view, standing on both feet, facing right, alert
  posture
- Proportions of an adolescent chicken — leaner and taller than a chick, feathers
  mostly grown in but with some juvenile down remaining around the neck/head, comb
  and wattle just beginning to develop (small, pale)
- Plumage pattern, color, and body type should reflect this bird's breed-accurate
  adult identity, now developing: La Fleche coloring — sleek black plumage, a distinctive V-shaped "devil horns" comb (two upright spikes instead of a single ridge), white earlobes, little to no wattle, and willow-green legs.
- Soft warm golden-hour side lighting, gentle painterly brushwork, warm palette
  consistent with the game's art style
- Background: simple, low-detail warm vignette matching the Level 1 chick — no
  scenery, no other characters, no text

Critical:
- No text, numbers, icons, logos, or UI chrome anywhere in the image
- No hard outlines / no flat vector style — must match the painterly gouache texture
  of the board art
- Keep pose, lighting angle, and background treatment consistent with the Level 1
  chick image of the same breed, so the two read as growth stages of one character
- 3:4 portrait aspect ratio, high resolution, print-quality, centered subject with even
  margin for card-frame cropping
```

### Level 3 — Hen/Rooster 🐓

```
Generate a painterly gouache/watercolor illustration of a full-grown rooster (hen or
rooster) of the La Fleche breed, rendered as a character token for a cozy
farming-village board game (style reference: Everdell, Cascadia).

Composition:
- Full-body, three-quarter side view, standing on both feet, facing right, confident
  adult posture
- Full adult plumage, breed-accurate comb type (single, pea, rose, walnut, etc.),
  wattle, ear-lobe color, leg color/feathering, and body shape/size for La Fleche
- Include breed-accurate tail sickle feathers and saddle feathers, and a
  larger comb/wattle appropriate for a La Fleche rooster
- Plumage color/pattern: La Fleche coloring — sleek black plumage, a distinctive V-shaped "devil horns" comb (two upright spikes instead of a single ridge), white earlobes, little to no wattle, and willow-green legs.
- Soft warm golden-hour side lighting, gentle painterly brushwork, warm palette
  consistent with the game's art style
- Background: simple, low-detail warm vignette matching Levels 1–2 — no scenery, no
  other characters, no text

Critical:
- No text, numbers, icons, logos, or UI chrome anywhere in the image
- No hard outlines / no flat vector style — must match the painterly gouache texture
  of the board art
- Keep pose, lighting angle, and background treatment consistent with the Level 1
  and Level 2 images of the same breed, so all three read as growth stages of one
  character
- 3:4 portrait aspect ratio, high resolution, print-quality, centered subject with even
  margin for card-frame cropping
```

---

