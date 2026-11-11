"""Builds HueDesk_Tablet.html from the shared engine in huedesk.html plus the tablet UI."""
import pathlib
root = pathlib.Path(__file__).resolve().parent.parent
desk = (root / 'huedesk.html').read_text()
start = desk.index("'use strict';")
end = desk.index('/* ---------------- feedback ---------------- */')
engine = desk[start:end]
tpl = (root / 'tablet' / 'template.html').read_text()
ui = (root / 'tablet' / 'ui.js').read_text()
out = tpl.replace('//__ENGINE__', '/* ===== Shared HueDesk engine (identical to the desktop desk) ===== */\n' + engine).replace('//__UI__', ui)
(root / 'HueDesk_Tablet.html').write_text(out)
print('built', len(out), 'bytes; em dashes:', out.count('—'), '; Fraunces:', 'Fraunces' in out)
