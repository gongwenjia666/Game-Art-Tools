# -*- coding: utf-8 -*-
import io
p = 'mask-tool.html'
s = io.open(p, encoding='utf-8').read()

reps = [
# 1. variables
('''  :root {
    --bg: #faf7ef;
    --ink: #1a1611;
    --ink-soft: #5c5346;
    --ink-mute: #9a9082;
    --line: #e6dcc9;
    --card: #ffffff;
    --amber: #f5b301;
    --amber-soft: #fff4d6;
    --amber-line: #ffd95e;
    --dark: #0f0c08;
    --dark-2: #1c1813;
  }''',
'''  :root {
    --bg: #111318;
    --panel: #1a1d24;
    --panel2: #22262f;
    --line: #2e3340;
    --ink: #e8e6e3;
    --ink-soft: #9aa0ad;
    --ink-mute: #6c7280;
    --card: #1a1d24;
    --amber: #ff7a3c;
    --amber-soft: rgba(255,122,60,.12);
    --amber-line: rgba(255,122,60,.35);
    --dark: #111318;
    --dark-2: #1a1d24;
  }'''),
# 2. header
('''  header {
    background: var(--dark);
    border-bottom: 4px solid var(--amber);
    padding: 20px 28px;
    display: flex;
    align-items: center;
    gap: 16px;
    box-shadow: 0 2px 24px rgba(15,12,8,.12);
  }
  header .logo {
    width: 42px; height: 42px; border-radius: 12px;
    background: var(--amber);
    display: flex; align-items: center; justify-content: center;
    color: var(--dark); font-weight: 800; font-size: 20px;
    box-shadow: 0 0 0 4px rgba(245,179,1,.18);
  }
  header h1 { font-size: 20px; font-weight: 700; color: #fff; letter-spacing: .5px; }
  header p { font-size: 12.5px; color: #b8ad99; margin-top: 3px; }''',
'''  header {
    background: var(--panel);
    border-bottom: 1px solid var(--line);
    padding: 16px 28px;
    display: flex;
    align-items: center;
    gap: 16px;
  }
  header h1 { font-size: 18px; font-weight: 700; color: var(--ink); letter-spacing: .5px; }
  header p { font-size: 12.5px; color: var(--ink-soft); margin-top: 3px; }'''),
('background: rgba(245,179,1,.15);', 'background: var(--amber-soft);'),
('border: 1px solid rgba(245,179,1,.35);', 'border: 1px solid var(--amber-line);'),
# 3. panel shadow
('box-shadow: 0 1px 3px rgba(15,12,8,.04);', 'box-shadow: 0 1px 3px rgba(0,0,0,.25);'),
# 4. dropzone
('border: 2px dashed #d4c9b3;', 'border: 2px dashed #3a4150;'),
('background: #fdfaf2;', 'background: var(--panel2);'),
# 5. mode-tab active
('''    border-color: var(--dark);
    background: var(--dark);
    color: var(--amber);''',
'''    border-color: var(--amber);
    background: var(--amber);
    color: #fff;'''),
# 6. size input focus
('''    border-color: var(--ink);
    background: var(--amber-soft);''',
'''    border-color: var(--amber);
    background: var(--amber-soft);'''),
# 7. fill button active
('border-color: var(--ink); background: var(--ink); color: var(--amber);',
 'border-color: var(--amber); background: var(--amber); color: #fff;'),
# 8. primary / ghost buttons
('''  .btn-primary {
    background: var(--amber);
    color: var(--dark);
  }
  .btn-primary:hover { background: #ffc830; transform: translateY(-1px); }
  .btn-primary:disabled { background: #e0d9c8; color: #b8ad99; cursor: not-allowed; transform: none; }''',
'''  .btn-primary {
    background: var(--amber);
    color: #fff;
  }
  .btn-primary:hover { background: #ff8f5c; transform: translateY(-1px); }
  .btn-primary:disabled { background: #2e3340; color: #6c7280; cursor: not-allowed; transform: none; }'''),
('''    background: transparent; color: var(--ink);
    border: 1.5px solid var(--ink);
  }
  .btn-ghost:hover { background: var(--ink); color: var(--amber); }
  .btn-ghost:disabled { border-color: #d4c9b3; color: #b8ad99; cursor: not-allowed; }''',
'''    background: transparent; color: var(--ink);
    border: 1.5px solid var(--ink-soft);
  }
  .btn-ghost:hover { background: var(--panel2); color: var(--amber); border-color: var(--amber); }
  .btn-ghost:disabled { border-color: var(--line); color: var(--ink-mute); cursor: not-allowed; }'''),
# 9. canvas checker + shadow
('repeating-conic-gradient(#efe9dc 0% 25%, #f8f4ea 0% 50%) 0 0 / 22px 22px;',
 'repeating-conic-gradient(#1e222b 0% 25%, #171a21 0% 50%) 0 0 / 22px 22px;'),
('box-shadow: 0 6px 28px rgba(15,12,8,.14);', 'box-shadow: 0 6px 28px rgba(0,0,0,.4);'),
# 10. view switch
('''    border: 1.5px solid var(--ink);
    border-radius: 9px;''',
'''    border: 1.5px solid var(--line);
    border-radius: 9px;'''),
('border: none; background: var(--card); padding: 8px 16px;',
 'border: none; background: var(--panel); padding: 8px 16px;'),
('.view-switch button.active { background: var(--ink); color: var(--amber); }',
 '.view-switch button.active { background: var(--amber); color: #fff; }'),
# 11. toast
('background: var(--dark); color: var(--amber);', 'background: var(--panel2); color: var(--amber);'),
('box-shadow: 0 8px 30px rgba(15,12,8,.25);', 'box-shadow: 0 8px 30px rgba(0,0,0,.4);'),
# 12. remove icon CSS
('  .dropzone .icon { margin-bottom: 8px; }\n  .dropzone .icon svg, .placeholder .icon svg { width: 34px; height: 34px; }\n', ''),
('  .placeholder .icon { font-size: 44px; margin-bottom: 10px; }\n', ''),
# 13. markup
('<header>\n  <div class="logo">遮</div>\n  <div>', '<header>\n  <div>'),
('''      <div class="icon">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round">
          <rect x="3" y="3" width="18" height="18" rx="2.5"/>
          <path d="M3 15l5-5 5 5 3-3 4 4"/>
          <circle cx="8.5" cy="7.5" r="1.5"/>
        </svg>
      </div>
''', ''),
('''        <div class="icon">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round">
            <rect x="3" y="3" width="18" height="18" rx="2.5"/>
            <path d="M3 16l5.5-5.5 4.5 4.5 3-3 4 4"/>
            <circle cx="8.5" cy="8" r="1.4"/>
          </svg>
        </div>
''', ''),
('⚡ 生成结果', '生成结果'),
('⬇ 下载结果图片', '下载结果图片'),
]

n = 0
for old, new in reps:
    if old in s:
        s = s.replace(old, new)
        n += 1
    else:
        print('MISS:', old[:60].replace('\n', '\\n'))
io.open(p, 'w', encoding='utf-8').write(s)
print('applied', n, 'of', len(reps))
