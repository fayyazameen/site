# Adding a post

Create a Markdown file in `src/content/blog/`. Its filename becomes the URL: `orange-cake.md` appears at `/blog/orange-cake`.

```md
---
title: "Orange Cake"
category: "Personal"
date: "09-19-2026"
time: "4:07pm"
description: "erratic nouns that mean nothing"
---

Write your post here.

---

Start another section after a quiet divider.
```

- Use `MM-DD-YYYY` dates and keep dates/times in quotes.
- `time` is optional. Both `"4:07pm"` and `"16:07"` work; the site displays `4:07pm` beside the date. It preserves the time you wrote without converting it to the reader's timezone. Posts without a time show only their date.
- Posts are listed newest first, including time when several posts share a date.
- Original writing needs no source field. For a piece first published on Medium, add `source: "medium"`; a small Medium tag appears on the homepage link, writing index, and article header.
- Markdown `---` in the body creates a centered section divider. The `---` lines around the opening metadata block serve a different purpose and must remain.

The homepage and writing index pick up the new file automatically. Publishing requires rebuilding and deploying the updated site.
