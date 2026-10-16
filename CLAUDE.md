# Pottery Stencil Maker

Run `npm test` (Vitest) and `npm run build` before you commit. See README.md for how the pipeline fits together.

## Design Context

### Users
The users are potters who own a 3D printer. They range from hobbyists who are new to printing to
makers who know their slicer well. They come to the tool with a thrown piece, such as a mug, pot,
vase, bowl, or plate, and an idea for a pattern. They leave with an STL file that they trust to
print correctly the first time. They use the tool at a desk between studio sessions, often with
clay on their hands and a tape measure nearby. For them, the measurements and the print check
matter more than anything decorative.

### Brand Personality
The personality is warm, calm, and tactile. The tool should feel like a well-kept pottery studio
that is unhurried, quietly confident, and on your side. The tool exists to stop wasted prints, so
its voice is plain and specific and never alarmist. It celebrates a print that is ready. When it
explains a problem, it also says what to do next.

### Aesthetic Direction
- The palette uses the clay, slip, and glaze tones of a studio. Neutrals are warm and tinted, never
  gray. One glaze-like accent, the existing deep teal, marks actions and "ready" states, and the UI
  uses it sparingly.
- The UI has light and dark themes and follows the system setting. The dark theme should feel like
  a kiln-lit studio at night, warm and low. It should never look like a neon slicer.
- The designs, the flat stencil, and the 3D piece get the most attention. The controls and panels
  around them stay visually quiet.
- The UI avoids generic SaaS dashboards, cyan-on-dark "AI" palettes, glassmorphism, card grids of
  identical tiles, and gradient text.

### Design Principles
1. **Use progressive disclosure.** The simple path (piece → design → check → download) is always
   obvious. Expert controls are one step away, clearly signposted, and never hidden.
2. **Put the work first.** Previews get the most space and contrast. Controls support them.
3. **Speak like a potter's friend who prints.** Use plain words and real units (mm, °). Every
   warning says what to do about it.
4. **Earn trust with honesty.** Show exactly what will print, and flag what will not. Never claim a
   success that the stencil has not earned.
5. **Make it accessible by default.** The UI meets WCAG 2.2 AA. Text has 4.5:1 contrast in both
   themes. Every control works from the keyboard, shows visible focus, and has a label. The UI
   respects reduced motion.
