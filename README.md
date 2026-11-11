# Bomb Sweeper (web)

Webversie van de Nintendo Game & Watch *Bomb Sweeper*: loods het mannetje door het doolhof naar een bom buiten de rand en duw muren weg (één vakje, als er niets achter staat).

## Spelen

```sh
python3 tools/serve.py        # http://127.0.0.1:8137/
```

- Pijltjes/WASD: bewegen en duwen · R: bom laten ontploffen (kost een leven) · P: pauze · Enter: start
- `?test` — testmodus zonder timer · N/B: volgend/vorig level · E: bewerken · `?test&level=12` start op level 12

## Levels

`game/levels.js` wordt gegenereerd door `tools/levels2.py`:

- levels 1–15 komen uit de Godot-versie (`original/level_*.gd`, omgezet door `tools/import_godot.py`);
- de rest is automatisch uit een gameplay-video gehaald (`tools/align.py` → `extract.py` → `extract_outside.py` → `levels2.py`; de video zelf zit niet in de repo);
- handmatige correcties staan in `tools/overrides.json` (export uit de bewerkmodus).
