#!/usr/bin/env python3
"""Rebuild blog/posts-data.js from blog/posts.json and blog/posts/*.md.

The blog admin page does this automatically on every save. Run this only
if you edit posts.json or the .md files by hand:  python3 build-blog-data.py
"""
import json, pathlib
root = pathlib.Path(__file__).resolve().parent / 'blog'
posts = json.loads((root / 'posts.json').read_text(encoding='utf-8'))
bodies = {}
for p in posts:
    f = root / 'posts' / (p['slug'] + '.md')
    if f.exists():
        bodies[p['slug']] = f.read_text(encoding='utf-8')
data = json.dumps({'posts': posts, 'bodies': bodies}, ensure_ascii=False, indent=1)
(root / 'posts-data.js').write_text(
    '/* Generated from posts.json + posts/*.md. Do not edit by hand. */\nwindow.BLOG_DATA = ' + data + ';\n',
    encoding='utf-8')
print(f'Wrote blog/posts-data.js with {len(posts)} posts')
