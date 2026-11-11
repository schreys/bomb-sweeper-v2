# Bomb Sweeper (web)

Webversie van de Nintendo Game & Watch *Bomb Sweeper*: loods het mannetje door het doolhof naar een bom buiten de rand en duw muren weg (één vakje, als er niets achter staat).

## Spelen

```sh
python3 tools/serve.py        # http://127.0.0.1:8137/
```

- Pijltjes/WASD: bewegen en duwen · R: bom laten ontploffen (kost een leven) · P: pauze · Enter: start
- `?test` — testmodus zonder timer · N/B: volgend/vorig level · E: bewerken · `?test&level=12` start op level 12 · `?bonus` start met het bonuslevel

Na elke 10 levels volgt, zoals in Game A, een bonuslevel: het doolhof schuift 41 keer naar rechts; laat je niet platdrukken tegen de rechterrand en pak daarna de bom bovenaan voor een extra leven.

## Levels

`game/levels.js` bevat de 45 doolhoven van Game A, overgenomen uit de [RetroFab-simulatie](https://itizso.itch.io/nintendo-bomb-sweeper) (`tools/retrofab_levels.txt`, gecontroleerd en omgezet door `tools/import_retrofab.py`).

Oudere aanpak, niet meer gebruikt voor `levels.js`:

- levels 1–15 komen uit de Godot-versie (`original/level_*.gd`, omgezet door `tools/import_godot.py`);
- de rest is automatisch uit een gameplay-video gehaald (`tools/align.py` → `extract.py` → `extract_outside.py` → `levels2.py`; de video zelf zit niet in de repo);
- handmatige correcties staan in `tools/overrides.json` (export uit de bewerkmodus).
