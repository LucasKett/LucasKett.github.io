import os, sys
B = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', 'build')
def r(n): return open(os.path.join(B, n), encoding='utf-8').read()
html = (r('a_head.html') + '\n' + r('b_body.html') + '\n'
  + '<script>\n' + r('z_err.js') + '\n</script>\n'
  + '<script>\n' + r('c_data1.js') + '\n' + r('c_data2.js') + '\n' + r('c_data3.js') + '\n' + r('c_roads1.js') + '\n' + r('c_roads2.js') + '\n' + r('c_geo.js') + '\n</script>\n'
  + "<script>\n(function () {\n'use strict';\n" + r('d_map.js') + '\n' + r('e_ui.js') + '\n})();\n</script>\n')
out = os.path.join(B, '..', 'kashgar-to-hanoi.raw.html')
open(out, 'w', encoding='utf-8').write(html)
print(out, len(html.encode('utf-8')), 'bytes')
