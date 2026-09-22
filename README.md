# openMotor Online

A client-side web port (MVP) of [openMotor](https://github.com/reilleya/openMotor), the open-source
solid rocket motor internal ballistics simulator. Everything runs in the browser — there's no
backend; the physics engine is a from-scratch TypeScript port of openMotor's Python `motorlib`.

## Status

- **Grain shapes:** BATES (analytic), Star Grain and Moon Burner (both via a hand-rolled fast
  marching method + marching squares, standing in for `scikit-fmm` and the project's Cython
  contour routine).
- **Propellant:** all 20 of openMotor's built-in presets (mechanically generated from its
  `uilib/defaults.py`, not hand-transcribed — see presetPropellants.ts), each editable in place
  (including multi-tab burn rate tables) with a "Reset to Default" button. Not the original's full
  add/delete propellant database editor.
- **Persistence:** browser `localStorage` autosave, plus manual JSON export/import. No `.ric`/YAML
  file compatibility, DXF import, BurnSim import/export, ENG export, or undo/redo yet.
- **UI:** a unified grain/propellant/nozzle/config list with Apply/Cancel staging, a tabbed results
  panel (Graph/Grains/Alerts) with full axis and per-grain channel selection, and a 4-tab grain
  preview (Face/Regression/Area Graph/Alerts) — all modeled on the original desktop app's actual
  layout, not guessed at.

See `src/physics/` for the engine and `src/ui/` for the interface. The physics port is
regression-tested against golden values produced by running the actual Python `motorlib` — both on
openMotor's own bundled test fixtures and on an exhaustive sweep (every channel, every timestep,
every one of the 20 built-in propellants) confirming agreement to within float64 truncation error
(~1e-12 relative) for the analytic grains. See `src/physics/__tests__/` for the specifics, in
particular `allPropellants.reference.test.ts` and `motor.reference.test.ts` for how tight a
tolerance each grain type is held to and why.

## Development

```bash
npm install
npm run dev      # start the dev server
npm run build    # type-check + production build
npx vitest run   # run the physics engine test suite
```
