#!/usr/bin/env python3
"""Regenerates ../scripts.ts from the C# compiler: python3 generate-scripts.py <path to invites-blog-backend>.

The scripts a compiled page carries (DesignCompiler's detect/fallback/editor scripts and TemplateRuntime.Js)
are copied, never retyped, so the browser renderer's pages stay byte-identical to the server's.
"""
import json, re, sys, pathlib

backend = pathlib.Path(sys.argv[1] if len(sys.argv) > 1 else '../../../../../../../../invites-blog-backend')

def raw_literal(src, name):
    # A C# raw string literal: the closing """'s indentation is stripped from every line.
    m = re.search(name + r'\s*=\s*"""\n(.*?)\n([ \t]*)"""', src, re.S)
    body, indent = m.group(1), m.group(2)
    return '\n'.join(l[len(indent):] if l.startswith(indent) else '' for l in body.split('\n'))

comp = (backend / 'InvitesBlog.TemplateCompiler/Design/DesignCompiler.cs').read_text()
runtime = (backend / 'InvitesBlog.TemplateCompiler/TemplateRuntime.cs').read_text()
detect = re.search(r'DetectScript =\s*"((?:[^"\\]|\\.)*)";', comp).group(1).encode().decode('unicode_escape')
consts = {
    'DETECT_SCRIPT': detect,
    'FALLBACK_SCRIPT': raw_literal(comp, 'FallbackScript'),
    'EDITOR_SCRIPT': raw_literal(comp, 'EditorScript'),
    'TEMPLATE_RUNTIME': raw_literal(runtime, 'Js'),
}
out = ['// Generated from the C# compiler (DesignCompiler.cs, TemplateRuntime.cs) — the scripts a compiled page carries.',
       "// Kept byte-identical to the server's; the parity tests fail if they drift. Regenerate with",
       '// testing/generate-scripts.py rather than editing.', '']
for k, v in consts.items():
    out += [f'export const {k} = {json.dumps(v, ensure_ascii=False)};', '']
(pathlib.Path(__file__).parent.parent / 'scripts.ts').write_text('\n'.join(out))
print('wrote scripts.ts')
