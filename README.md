# openMotor Online

A client-side web port of [openMotor](https://github.com/reilleya/openMotor), the open-source solid
rocket motor internal ballistics simulator. Everything runs in the browser — there's no backend;
the physics engine is a from-scratch TypeScript port of openMotor's Python `motorlib`.

## Status

- **Grain shapes:** BATES, Rod & Tube, Conical and End Burner (analytic); Star Grain, Moon Burner,
  Finocyl, C/D/X-core (all via a hand-rolled fast marching method + marching squares, standing in
  for `scikit-fmm` and the project's Cython contour routine). Custom/DXF import isn't ported yet.
- **Propellant:** a persistent library (localStorage, seeded from all 20 of openMotor's built-in
  presets, mechanically generated from its `uilib/defaults.py`) managed through its own Propellant
  Editor dialog — add/delete/edit entries, multi-tab burn rate tables, Reset to Default, and a
  burn-rate-vs-pressure preview graph — matching the original's separate propellant database rather
  than editing a propellant inline on the motor.
- **Tools menu:** all 7 tools from the original (Set: Motor Diameter/Initial Kn/Max Kn/Max Pressure,
  Optimize: Nozzle Expansion, Design: Neutral BATES Geometry, Analyze: Nozzle Erosion/Slag
  Coefficient), each a faithful port of its Python source, reference-tested against it.
- **Units:** a Preferences dialog with a chosen display unit per physical quantity (length,
  pressure, mass, etc.), not just one global length unit.
- **Undo/redo**, a unified grain/nozzle/config list with Apply/Cancel staging (double-click or Edit
  to open a grain, matching the original's separate Edit button), a tabbed results panel
  (Graph/Grains/Alerts, with full axis/channel selection and a per-grain results table), a 4-tab
  grain preview (Face/Regression/Area Graph/Alerts) with a rainbow-gradient regression contour
  overlay, and a nozzle profile preview — all modeled on the original desktop app's actual layout.
- **Import/export:** JSON (this app's own save format, with autosave + a "recent files" list), CSV
  and RASP `.eng` export of simulation results, BurnSim 3.0 (`.bsx`) import/export (BATES and Moon
  Burner only — Star Grain has no BurnSim equivalent in the original either), and PNG export of the
  results graph. No `.ric`/YAML file compatibility or DXF import yet.
- **Simulation UX:** a real progress bar with a working Cancel button — the run yields to the
  browser before any work starts (so the dialog is guaranteed to paint immediately, even for a
  design whose FMM grain setup alone can take seconds), yields between each grain's setup too, and
  yields the timestep loop on a wall-clock timer rather than a fixed iteration count (so short runs
  still get a chance to repaint/cancel instead of completing in one blocking call) — plus an alerts
  dialog that pops up automatically when a run produces warnings. Every numeric input can be
  cleared to empty while typing rather than snapping back to a number; an empty/invalid field gets
  a red outline and disables that form's Apply/Save/Export button until it's fixed.

See `src/physics/` for the engine and `src/ui/` for the interface. The physics port is
regression-tested against golden values produced by running the actual Python `motorlib` — both on
openMotor's own bundled test fixtures and on an exhaustive sweep (every channel, every timestep,
every one of the 20 built-in propellants) confirming agreement to within float64 truncation error
for the analytic grains, and to a similarly tight tolerance for the FMM-based ones now that the
fast-marching solver matches `skfmm`'s order of accuracy. See `src/physics/__tests__/` for the
specifics.

**Known perf tradeoff:** the FMM solver's accuracy improvement computes its burning-perimeter
lookup table at a much finer resolution, which is significantly slower at high `mapDim` — a Star
Grain motor at `mapDim: 750` (as used by some of the bundled reference fixtures) can take several
seconds to simulate. The app's own default (`mapDim: 400`) stays fast for interactive use; this
only bites if a design's Config is turned up well past that.

## Development

```bash
npm install
npm run dev      # start the dev server
npm run build    # type-check + production build
npx vitest run   # run the physics engine test suite
```
