// The MCP prompts teach Claude the design loop and the rules a printable stencil has to follow.

export interface StencilBrief {
  /** One repeat of the top design layer, round the band and down it, in mm. */
  width: number; height: number;
  /** The thinnest plastic and the thinnest paint line that print, in mm. */
  minLine: number; minGap: number;
}

const pct = (mm: number, of: number) => `${((100 * mm) / of).toFixed(1)}% of the image height`;

// imagePrompt() writes an image-generator prompt sized to one repeat of the live stencil. The minimum widths
// become shares of the image height, which a generator can follow. Black is where the underglaze goes.
export function imagePrompt(b: StencilBrief, subject: string, style = 'bold stencil art'): string {
  const ratio = (b.width / b.height).toFixed(2);
  return [
    `A repeating motif for a pottery underglaze stencil, in the style of ${style}. Black shapes are where the paint goes, and white is the plastic that masks the pot.`,
    'Pure solid black shapes on a pure white background, two tones only. No grey, no gradients, no shading, no texture, and no hatching or stippling.',
    `Subject: ${subject}. Few large elements, bold simple silhouettes, smooth curved edges, crisp vector-like quality.`,
    `Every black paint line is at least ${pct(b.minGap, b.height)} wide, and every strip of white between black shapes is at least ${pct(b.minLine, b.height)} wide.`,
    'Avoid white shapes fully enclosed by black, because they fall out of a stencil as loose pieces. Let white details touch the white surround.',
    `The left and right edges tile seamlessly. Aspect ratio ${ratio}:1.`,
    'Avoid: outline, line art, hairline, sketch, hatching, stippling, halftone, noise, grain, gradient, shading, glow, 3D, photorealistic, colour, sparkle, watermark, logo, text, signature, tiny details.',
  ].join('\n\n');
}

export const DESIGN_LOOP = `You are designing an underglaze stencil with the Pottery Stencil Maker, which is open in the user's browser tab.
Work in rounds, and keep the user in the loop in chat.

1. Call get_state and view, and say what you see before you change anything.
2. Fix print check errors first, then warnings, then how it looks.
3. Call checkpoint before each round. Change as many things as one idea needs, and send them together with batch, so they share one rebuild. Ask for view: true when you need to see the result.
4. Judge the result against the rules below. Keep the round only when the check and the look both get better, and otherwise call restore.
5. Stop when the check passes and the design reads well from arm's length. Ask the user before you call export.

Rules for a stencil that prints and paints well:
- Plastic and paint lines are at least two nozzle widths wide. The print check names the minimums (thin plastic, thin paint lines).
- The stencil prints as one piece. Plastic islands inside paint areas need bridges, and each bridge leaves a thin unpainted line, so prefer designs with few islands.
- A flat sheet bends round the pot, and a curved shell prints upright in the pot's shape. A shell needs support posts under wide hole tops.
- A stencil that covers part of the way round gets repeat marks. Coverage is 1, ½, ⅓, ¼ or ⅙, and layer repeats count round the whole pot.
- Wide pieces hanging off one narrow link lift when a flat sheet bends. Hold flaps keeps them down.
- Measure the pot at the stage it gets painted, because clay shrinks.`;

export const REVIEW_DESIGN = `Review the current stencil design. Call view with which: "both", then judge it on each point and give a short verdict for each:
- Does it read from arm's length, with clear figures and enough contrast between paint and plastic?
- Does it print as one piece, and how many bridges and thin lines will show in the paint?
- Is the paint spread evenly round the band, without big empty stretches?
- What does the print check flag, and which change fixes it with the least harm to the design?
- What is the one change most likely to improve it next?`;
