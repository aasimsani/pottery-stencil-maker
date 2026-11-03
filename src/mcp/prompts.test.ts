import { expect, it } from 'vitest';
import { imagePrompt } from './prompts';

it('sizes the image prompt to one repeat of the live stencil', () => {
  // One repeat 120 mm round the band and 50 mm down it, with 0.8 mm minimum plastic and paint lines.
  const text = imagePrompt({ width: 120, height: 50, minLine: 0.8, minGap: 0.8 }, 'moth and vines');
  expect(text).toContain('2.40:1');
  expect(text).toContain('1.6% of the image height');
  expect(text).toContain('moth and vines');
});
