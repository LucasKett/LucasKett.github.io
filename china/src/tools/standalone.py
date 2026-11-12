# Wraps the published page as a normal web page for hosting outside Claude.
import os, re
R = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..')
s = open(os.path.join(R, 'kashgar-to-hanoi.html'), encoding='utf-8').read()
i = s.index('<div class="wrap')
head, body = s[:i], s[i:]
head = head.replace('<meta name="claude:viewport-fit-sides" content="cover">\n', '')
doc = ('<!doctype html>\n<html lang="en">\n<head>\n<meta charset="utf-8">\n'
  '<meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover">\n'
  '<meta name="robots" content="noindex,nofollow">\n'
  '<meta name="description" content="Overland route from Kashgar across China to Hanoi: dates, stops, night trains, beds and costs.">\n'
  '<meta property="og:title" content="Kashgar to Hanoi">\n'
  '<meta property="og:description" content="Overland, 5 Nov – 21 Dec 2026: China and Vietnam.">\n'
  + head + '</head>\n<body>\n' + body + '\n</body>\n</html>\n')
out = os.path.join(R, 'out', 'index.html')
open(out, 'w', encoding='utf-8').write(doc)
print(out, len(doc.encode('utf-8')))
