# Gerard Gibson — Portfolio

Personal portfolio and blog. Plain HTML, CSS and JavaScript, hosted on GitHub Pages.

```
index.html            Home: hero, about, experience, projects, live GitHub repos, skills, latest posts, contact
styles.css            All styling (white + sand palette, colour tokens at the top)
script.js             Nav, scroll animations, GitHub repo feed, blog loading
dev.js                Dark mode, Cmd/Ctrl+K command palette, interactive terminal, article code tools
Media/                Images (profile.jpg is the web-sized photo used on the site)
blog/index.html       Blog listing with tag filters and search
blog/post.html        Article page (renders Markdown)
blog/posts.json       List of articles (title, date, tags, excerpt)
blog/posts/*.md       The articles themselves, in Markdown
blog/images/          Cover images and figures for articles
blog/posts-data.js    Generated copy of all articles (lets the blog work when opened from disk)
blog/admin.html       Editor to create, edit and delete articles
```

## Managing articles (create, edit, delete)

Open **/blog/admin.html** on your live site (there's also a small "Manage" link in the blog footer).

1. Create a GitHub **fine-grained personal access token**: GitHub → Settings → Developer settings →
   Personal access tokens → Fine-grained tokens → Generate new token.
   - Repository access: **Only select repositories** → `Alex_Website`
   - Permissions → Repository → **Contents: Read and write**
2. Paste the token into the admin page and click **Connect**.
3. From there you can:
   - **Create** a new article with a live Markdown preview and formatting toolbar
   - **Upload images** (cover image or inline in the article); they're saved to `blog/images/`
   - **Edit** any article, including renaming its URL slug
   - Save as **draft** (hidden from the public blog) or **publish**
   - **Delete** an article (removes the .md file and its index entry)

Every save is a commit to your repo. GitHub Pages rebuilds in about a minute.
The token stays in your browser only, and is sent nowhere except api.github.com.
Only tick "Remember on this device" on your own computer.

## Adding a blog post by hand

1. Create a Markdown file in `blog/posts/`, e.g. `blog/posts/my-new-post.md`.
   Write the article body in Markdown (no title needed; it comes from posts.json).
2. Add an entry to the **top** of `blog/posts.json`:

   ```json
   {
     "slug": "my-new-post",
     "title": "My new post",
     "date": "2026-11-02",
     "readTime": "4 min read",
     "excerpt": "One or two sentences shown on the card.",
     "tags": ["APIs", ".NET"],
     "cover": "images/my-cover.jpg"
   }
   ```

   - `slug` must match the file name (without `.md`).
   - `cover` is optional (path relative to `blog/`).
   - Add `"draft": true` to hide a post until it's ready.
3. Commit and push. The post appears on the blog page and, if it's one of the three newest, on the home page.

## GitHub projects

The "Latest repositories" section loads your public repos live from the GitHub API,
newest first, skipping forks. To hide a repo, add its name to `HIDE_REPOS` in `script.js`.

## Previewing locally

You can double-click `index.html` to open the site straight from your computer; the blog
then reads from `blog/posts-data.js`, a bundled copy of all articles.
The admin page rebuilds that file on every save. If you edit `posts.json` or the `.md`
files by hand, run `python3 build-blog-data.py` afterwards to refresh it.

## Developer features

- **Command palette**: press `Ctrl/⌘ + K` (or `/`) on any page to jump to sections, articles, or run actions.
- **Terminal**: the `#terminal` section on the home page is interactive (`help`, `projects`, `skills`, `github`, `contact`, plus a few easter eggs). It reads its content from the page itself, so it stays in sync.
- **Dark mode**: follows the OS setting until the visitor picks a theme; stored in `localStorage`.
- **Articles**: syntax-highlighted code blocks with copy buttons, heading anchors and a copy-link button.

## 3D space-opera version

An alternative, 3D version of the site lives in `scifi/` (see `scifi/README.md`). The classic site above is unchanged.
