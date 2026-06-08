#!/usr/bin/env python3
"""Extract posts from SQL dump and import to MongoDB"""

import re
import json
import sys
import subprocess

SQL_FILE = '/Users/selva/Downloads/bh_uvh_data.sql'

with open(SQL_FILE, 'r', encoding='utf8', errors='replace') as f:
    content = f.read()

# Find all posts INSERT statements
pattern = re.compile(
    r"INSERT INTO `posts` \(`([^)]+)`\) VALUES\s*\(([\s\S]*?)\);",
    re.MULTILINE
)

posts = []
for match in pattern.finditer(content):
    cols_raw = match.group(1)
    values_raw = match.group(2)

    columns = [c.strip().strip('`') for c in cols_raw.split('`,')]

    # Split values carefully - handle quoted strings with commas
    values = []
    current = ''
    in_str = False
    i = 0
    while i < len(values_raw):
        ch = values_raw[i]
        if ch == '\\' and in_str:
            current += ch
            i += 1
            if i < len(values_raw):
                current += values_raw[i]
            i += 1
            continue
        if ch == "'" and not in_str:
            in_str = True
            current += ch
        elif ch == "'" and in_str:
            in_str = False
            current += ch
        elif ch == ',' and not in_str:
            values.append(current.strip())
            current = ''
        else:
            current += ch
        i += 1
    if current.strip():
        values.append(current.strip())

    doc = {}
    for idx, col in enumerate(columns):
        if idx >= len(values):
            doc[col] = None
            continue
        val = values[idx].strip()
        if val == 'NULL':
            doc[col] = None
        elif val.startswith("'") and val.endswith("'"):
            doc[col] = val[1:-1].replace("\\'", "'").replace('\\\\', '\\').replace('\\n', '\n').replace('\\r', '\r')
        elif re.match(r'^-?\d+$', val):
            doc[col] = int(val)
        elif re.match(r'^-?\d+\.\d+$', val):
            doc[col] = float(val)
        else:
            doc[col] = val

    posts.append(doc)

print(f"Extracted {len(posts)} posts", file=sys.stderr)

# Output as JSON
print(json.dumps(posts, ensure_ascii=False))
