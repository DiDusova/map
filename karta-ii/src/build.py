"""Сборка страниц карты из исходников.
Запуск из корня репозитория: python3 src/build.py
Правите данные в src/data.json или тексты в src/manual.js, затем запускаете сборку и коммитите index.html и spravochnik.html.
"""
import re, os
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
S = lambda f: open(os.path.join(ROOT, 'src', f), encoding='utf-8').read()
manual, data = S('manual.js'), S('data.json')
DESC = 'Интерактивная карта: что ИИ умеет в работе, на каком уровне усиления и что работает в России. Школа Экзомышления.'

def page(tpl, js, title, nav):
    t = S(tpl)
    t = re.sub(r'<link rel="preconnect"[^>]*>\s*', '', t)
    t = re.sub(r'<link href="https://fonts.googleapis.com[^>]*>\s*', '', t)
    t = re.sub(r'<title>.*?</title>\s*', '', t, flags=re.S)
    t = t.replace('/*MANUAL*/', manual).replace('/*DATA*/', data).replace('/*APP*/', S(js))
    t = nav(t)
    i = t.index('<style>'); j = t.index('</style>') + 8
    head = ('<!doctype html>\n<html lang="ru">\n<head>\n<meta charset="utf-8">\n'
            '<meta name="viewport" content="width=device-width, initial-scale=1">\n'
            f'<title>{title}</title>\n<meta name="description" content="{DESC}">\n'
            f'<meta property="og:title" content="{title}">\n<meta property="og:description" content="{DESC}">\n'
            '<link rel="icon" href="favicon.svg" type="image/svg+xml">\n<link rel="stylesheet" href="assets/fonts.css">\n')
    return head + t[i:j] + '\n</head>\n<body>\n' + t[j:] + '\n</body>\n</html>\n'

nav_map = lambda t: t.replace('<button class="iconbtn" id="theme" type="button">Тема</button>',
    '<a class="iconbtn" href="spravochnik.html" style="text-decoration:none;color:inherit">Справочник</a>\n    <button class="iconbtn" id="theme" type="button">Тема</button>')
nav_ref = lambda t: t.replace('<button class="theme" id="themeBtn" type="button">Тема</button>',
    '<button class="theme" id="themeBtn" type="button">Тема</button>\n  <a class="theme" href="index.html" style="right:90px;text-decoration:none;color:inherit">Интерактивная карта</a>')

open(os.path.join(ROOT, 'index.html'), 'w', encoding='utf-8').write(page('radial_template.html', 'radial.js', 'Карта возможностей ИИ', nav_map))
open(os.path.join(ROOT, 'spravochnik.html'), 'w', encoding='utf-8').write(page('app_template.html', 'app.js', 'Карта возможностей ИИ: справочник', nav_ref))
print('Готово: index.html, spravochnik.html')
