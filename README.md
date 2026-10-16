# Pottery Stencil Maker

Design underglaze stencils for your pottery and 3D print them. You measure the band that you want to paint on a mug, pot, vase, bowl, or plate rim. Then you layer designs from open libraries, or your own images, onto the band. The app gives you an STL file that fits the piece.

**Try it in your browser at [aasimsani.net/projects/pottery-stencil-maker](https://aasimsani.net/projects/pottery-stencil-maker/).** You don't need to install anything.

![The app with a sprig-and-dot design on a flared mug, the flat stencil, a 3D preview, and a passing print check](docs/screenshot.png)

- **The stencil fits the piece.** A tapered pot gets an arc-shaped stencil, because a flat sheet lies flush on a cone only when the sheet has that shape. A plate rim gets a ring.
- **Problems show up before you print.** The print check finds plastic that is too thin to print, paint lines that would close up, pieces that would fall out, and spans that would sag. It does not let you download a broken stencil by accident.
- **The stencil prints flat or curved.** A flat sheet bends around the piece. A curved shell prints upright in the shape of the piece, so you do not have to bend it.

## Run it

You need [Node.js](https://nodejs.org) 22 or later.

```sh
git clone https://github.com/aasimsani/pottery-stencil-maker.git
cd pottery-stencil-maker
npm install
npm run dev
```

Then open http://localhost:5173. Everything runs in your browser, and your browser also saves your designs.

To host the app yourself, run `npm run build` and put the `dist/` folder on any static host. You can also serve the folder locally with `npm run preview`.

To host the app on Cloudflare Workers, run `npx wrangler login` once. Then run `npm run deploy`, which builds the app and publishes it to `pottery-stencil-maker.<your-subdomain>.workers.dev`. The file `wrangler.jsonc` configures Cloudflare to serve the build as static assets.

## Make a stencil

1. **Describe the piece.** Pick a preset, or enter its base Ø, rim Ø, and height in mm. To get a Ø, measure the circumference with a tape and divide it by 3.14. For bellied or waisted shapes, add measurements in between. Measure the piece at the stage when you paint it, because clay shrinks. Click **Save to my pieces** to keep a piece for next time.
2. **Place the paint band.** Set where the pattern starts and ends, in mm from the base along the surface. **Margins** add a plastic border around the band. **Reach the base** extends the bottom margin down to the table. The bottom edge of the stencil then rests on the table, so the stencil lines up with the base of the pot.
3. **Add designs.** Click any design in the **Design library** to add it as a layer. Each layer has its own size and its own number of repeats around the piece and down the band. Open **Advanced** to set a layer's slice of the band, offset, rotation, scatter, threshold, and **Thicken lines**. A **Paint** layer adds paint, and a **Cut out** layer removes paint. **Clear margin** keeps lower layers away from a shape, so a motif can sit cleanly on a busy pattern. Click **+ Lines** to add solid, dashed, dotted, or wavy bands at any height.
4. **Choose flat or curved.** Under **Stencil**, pick a **flat sheet** or a **curved shell**. A flat sheet prints flat and bends around the piece. A curved shell prints standing up in the exact shape of the piece. Half and third stencils clip on from the side, past a handle. A full wrap leaves a 3 mm slit so that it springs open.
5. **Check the stencil.** Fix every error that the **Print check** marks. **Show problems** highlights each spot on the stencil. In the 3D view, **Print file** shows the exact STL file on the bed of your printer.
6. **Download the STL file**, and then slice it.

## Print it

The defaults suit a Bambu Lab P2S with a 0.4 mm nozzle. To use a different bed size or nozzle, change them under **Printer & safety settings**.

| | Flat sheet | Curved shell |
|---|---|---|
| Material | PETG, because it survives bending and reuse | PLA, because a shell does not bend and PLA strings less than PETG |
| Thickness | 0.6 mm (3 layers at 0.2 mm) | 0.8 mm, printed with 2 wall loops |
| Placement | Print it exactly as exported. The app may rotate a long stencil so that it fits the bed diagonally. | Print it upright, exactly as exported. Leave slicer supports off, because the file already contains any posts it needs. |
| Plate | Textured PEI. Flex the cooled plate to peel the stencil off. | Textured PEI |

- Turn the brim off.
- To reduce stringing, dry your filament, enable wipe while retracting, and run PETG at about 235 °C. A few seconds of hot air from a hair dryer clears any strings that remain.

### Paint with the stencil

Tape the stencil on, or hold it in place with a rubber band. Dab underglaze on with a sponge or a stencil brush, because brushing pushes paint under the edges. Lift the stencil straight off. Bridges leave thin unpainted lines, so touch them up by hand. You can also paint a second pass with the stencil shifted slightly.

## Design sources

| Source | What you get | License |
|---|---|---|
| Built in | A few florals and minimal repeats | MIT, with this project |
| [Iconify](https://iconify.design) | More than 300,000 open source icons | Varies by icon set. The app's credits show each license. |
| [Wikimedia Commons](https://commons.wikimedia.org) | Scans from the Biodiversity Heritage Library, and SVG clip art | Varies by file. The app's credits show each license. |
| [Smithsonian Open Access](https://www.si.edu/openaccess) | Museum images | CC0. The built-in demo key allows about 10 searches an hour, and a [free key](https://api.data.gov/signup/) removes the limit. |
| [Pattern Monster](https://pattern.monster) | 330 patterns that tile without seams | MIT. See `src/sources/data/PATTERN-MONSTER-LICENSE`. |
| [Hero Patterns](https://heropatterns.com) by Steve Schoger | 87 patterns that tile without seams | CC BY 4.0 |

The **Credits** list under your layers names every source that you used. If you sell or publish the pieces, CC BY designs need that credit.

## Limits

- **Photo tracing is experimental.** It needs a plain background and a level shot from a distance. Check the measurements it gives before you print.
- **A flat sheet or a cone-shaped shell cannot lie flush on a strongly bellied wall.** The app warns you when a band curves more than 1.5 mm away from the stencil.
- **The live libraries need an internet connection.** Built-in designs and patterns work offline.

## Development

```sh
npm test            # Vitest, about 100 tests of the geometry, mesh, checks and sources
npm run typecheck
npm run build       # typecheck, then a static build in dist/
```

The pipeline runs in this order:

1. `src/core/piece.ts` describes the piece as a profile from base to rim. It fits the stencil to the cone through the surface that the stencil covers, with separate margins above, below, and at the ends. `src/core/photo.ts` traces a profile from a photo.
2. `src/core/geometry.ts` unrolls the band into an annular sector, and `wrap()` maps a flat point back onto the pot.
3. Each layer in `src/layers.ts` renders one repeat cell. `src/render/tile.ts` draws designs on a canvas and thresholds them. `src/core/lines.ts` draws lines layers directly.
4. `src/core/mask.ts` composites the layers onto the sector, bottom layer first, and bridges loose pieces. `src/core/flaps.ts` holds wide pieces at both ends, and `src/core/overhang.ts` adds support posts to curved shells.
5. `src/core/mesh.ts` extrudes the result into a closed binary STL. `src/core/shell.ts` bends it into a curved shell, and `src/core/bed.ts` finds a rotation that fits the bed.
6. `src/checks.ts` runs the print check. It calls `src/core/thin.ts` to find features below the minimum widths.

`src/pipeline.ts` chains these steps. `prepareStencil()` renders the layers on the page. `finishStencil()` runs the remaining steps in `src/stencil.worker.ts`, so the page stays responsive. The UI code is in `src/ui/`, and the app saves settings and layers in `localStorage`.

### Add a design source

1. Add its id to `SourceId` in `src/sources/types.ts`.
2. Write `src/sources/<name>.ts` with a pure `parse…(json)` function that returns `DesignRef`s. Test the function against a saved API response in `src/sources/__fixtures__/`. The image host must send `Access-Control-Allow-Origin`, because the threshold step reads canvas pixels.
3. Add a `case` in `src/render/art.ts` that loads the full-size art.
4. Add a tab in `src/ui/Library.tsx`.

To refresh the bundled Pattern Monster data, run `node scripts/vendor-pattern-monster.mjs`.

## License

This project uses the MIT License. See `LICENSE`. Third-party designs keep their own licenses, which the **Design sources** table lists.
