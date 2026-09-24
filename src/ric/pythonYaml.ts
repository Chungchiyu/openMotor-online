/**
 * `.ric` files are plain YAML written by PyYAML's `yaml.dump()` (uilib/fileIO.py's `saveFile`), but
 * the envelope's `version`/`type` fields are Python-native objects (a tuple and an `Enum` member),
 * not plain YAML scalars — PyYAML tags them `!!python/tuple` and
 * `!!python/object/apply:uilib.fileIO.fileTypes`. This matters for compatibility, not just cosmetics:
 * confirmed directly against the real Python engine that `fileTypes.MOTOR == 3` is `false` (it's a
 * plain `Enum`, not an `IntEnum`) and `[0, 6, 2] == (0, 6, 2)` is `false` (list vs tuple) — so a
 * naive writer that emits plain `type: 3` / `version: [0, 6, 2]` produces a file the desktop app's
 * own loader rejects or crashes on. These two custom tags are load-only (`identify: () => false`):
 * the writer in `envelope.ts` emits the tagged lines by hand instead, since only these two
 * envelope-level fields ever carry them.
 */
import { CORE_SCHEMA, defineSequenceTag, load } from 'js-yaml';

const PYTHON_TUPLE_TAG = 'tag:yaml.org,2002:python/tuple';
const PYTHON_FILE_TYPE_TAG = 'tag:yaml.org,2002:python/object/apply:uilib.fileIO.fileTypes';

const pythonTupleTag = defineSequenceTag<unknown[]>(PYTHON_TUPLE_TAG, {
  create: () => [],
  addItem: (carrier, item) => {
    carrier.push(item);
  },
  identify: () => false,
});

/** `!!python/object/apply:uilib.fileIO.fileTypes [3]` reconstructs `fileTypes(3)` in Python — the
 * single constructor argument is the enum's int value, which is all we need from it. */
const pythonFileTypeTag = defineSequenceTag<unknown[], number>(PYTHON_FILE_TYPE_TAG, {
  create: () => [],
  addItem: (carrier, item) => {
    carrier.push(item);
  },
  finalize: (carrier) => carrier[0] as number,
  identify: () => false,
});

const RIC_LOAD_SCHEMA = CORE_SCHEMA.withTags(pythonTupleTag, pythonFileTypeTag);

export function loadRicYaml(text: string): unknown {
  return load(text, { schema: RIC_LOAD_SCHEMA });
}
