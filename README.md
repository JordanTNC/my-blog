# Your Blog

A simple, self-hosted blog: a homepage with your most recent articles and
categories, paginated article listings, and a private admin dashboard where
you write posts with a rich-text editor (images you can resize, colored
clickable links to your other posts, bold/italic/lists, etc.). No comments,
no likes.

This guide assumes no prior experience running a web server. Follow the
sections in order.

## 1. Try it on your own computer first

You'll need [Node.js](https://nodejs.org) installed (version 18 or newer).
To check, open a terminal and run `node -v`.

From inside this project folder, run:

```
npm install
npm run create-admin
```

`create-admin` will ask you to choose a username and password for logging
into the admin dashboard, and saves them (safely hashed, never in plain
text) to a new `.env` file in this folder.

Then start the site:

```
npm start
```

Open `http://localhost:3000` in your browser -- that's your homepage. Go to
`http://localhost:3000/admin/login` to log in and write your first post.
Press Ctrl+C in the terminal to stop the server.

Everything you write is stored in a file at `data/blog.db`. Uploaded images
go into `public/uploads/`.

## 2. Put it on the internet

Your computer isn't meant to stay on 24/7 as a public web server, so you'll
host it on a small always-on server instead. These steps use
[Render](https://render.com), a hosting service with a straightforward free
signup and no server administration required, but the same project will
work on similar services (Railway, Fly.io, a DigitalOcean droplet, etc.) if
you'd rather use one of those.

### 2a. Put your code on GitHub

Render deploys from a GitHub repository.

1. Create a free account at [github.com](https://github.com) if you don't
   have one.
2. Create a new repository (e.g. named `my-blog`), then follow GitHub's
   instructions to push this project folder to it. Roughly:
   ```
   git init
   git add .
   git commit -m "Initial commit"
   git branch -M main
   git remote add origin https://github.com/YOUR-USERNAME/my-blog.git
   git push -u origin main
   ```
   (The `.env` file and `data/` folder are intentionally excluded via
   `.gitignore` -- your password and posts should never be pushed to
   GitHub.)

### 2b. Create the web service on Render

1. Sign up at [render.com](https://render.com) and connect your GitHub
   account.
2. Click **New +** -> **Web Service**, and pick your `my-blog` repository.
3. Settings:
   - **Build Command:** `npm install`
   - **Start Command:** `npm start`
   - **Instance Type:** the $7/month tier is the smallest one that stays on
     and doesn't fall asleep, which matters for a real site.
4. Add a **persistent disk** (Render calls this out as a separate step
   under the service's "Disks" settings) of 1 GB, mounted at `/opt/render/project/src/data`.
   This is what keeps your posts and uploaded images from disappearing
   every time the server restarts or redeploys. Disks cost about
   $0.25/GB/month, so this adds about 25 cents to your monthly bill.
5. Under **Environment Variables**, add:
   - `ADMIN_USERNAME` -- your chosen admin username
   - `ADMIN_PASSWORD_HASH` -- open the `.env` file that `npm run create-admin`
     made on your computer and copy the value after `ADMIN_PASSWORD_HASH=`
   - `SESSION_SECRET` -- copy the value after `SESSION_SECRET=` from that
     same `.env` file
   - `DATA_DIR` -- set this to `/opt/render/project/src/data` (matching the
     disk's mount path above)
6. Click **Create Web Service**. Render will build and start your site,
   and give you a URL like `https://my-blog-xyz.onrender.com` that already
   works right away.

If you ever want to change your admin password, run `npm run create-admin`
again on your own computer and update the `ADMIN_USERNAME` /
`ADMIN_PASSWORD_HASH` environment variables on Render to match.

## 3. Buy a domain name and connect it

1. Buy a domain from a registrar such as [Namecheap](https://namecheap.com),
   [Cloudflare](https://www.cloudflare.com/products/registrar/), or
   [Google Domains's successor, Squarespace Domains](https://domains.squarespace.com/).
   A `.com` typically costs somewhere around $10-20 for the first year
   (often discounted) and renews annually after that -- prices vary by
   registrar and change over time, so compare a couple before buying.
2. In Render, open your web service -> **Settings** -> **Custom Domains**,
   and add your domain (e.g. `www.yourblogname.com`, or the bare
   `yourblogname.com`).
3. Render will show you one or two DNS records to add (usually a `CNAME`
   for `www` and an `A` record for the bare domain). Log into your domain
   registrar's dashboard, find its DNS settings, and add exactly the
   records Render showed you.
4. DNS changes can take anywhere from a few minutes to a few hours to take
   effect. Once they do, your domain will load your blog directly, and
   Render automatically issues a free HTTPS certificate for it.

## 4. Using your blog day to day

- **Write a post:** go to `/admin`, click **+ New Post**. Give it a title,
  write the content, check off any categories (or type new ones into "Add
  new categories"), and click **Save**. It appears instantly on your
  homepage, ordered by when you posted it.
- **Insert an image:** click the image icon in the toolbar, choose a file.
  Click the image afterward to see resize handles -- drag a corner to
  resize it (it keeps its proportions).
- **Link to one of your other articles:** select some text, click the link
  icon, and paste in that article's address (e.g. `/post/my-other-article`
  -- you can copy this from your browser's address bar while viewing that
  article). The text turns into a normal colored, clickable link, and
  clicking it takes readers straight to that article without opening a new
  tab. Links to other websites (starting with `https://`) open in a new
  tab instead, so readers don't lose their place on your site.
- **Attach a PDF someone can read by clicking it:** click the **PDF** button
  in the toolbar (next to the link and image buttons) and choose a file.
  It uploads and inserts a clickable link using the file's own name (e.g.
  "annual-report.pdf") at your cursor -- rename the file beforehand if you
  want nicer link text. Clicking it opens the PDF in a new tab using the
  reader's own browser PDF viewer (with its normal zoom, search, and
  download controls), so nothing extra needs to be installed on your end
  or theirs.
- **Save something as a draft:** uncheck "Published" before saving. It
  stays visible only to you in the dashboard until you publish it.
- **Add or remove a category:** on the dashboard, use the "Categories /
  Tags" section to add a new one or delete one you no longer need (this
  doesn't delete the articles in it, just the category itself).
- **Change your site's name:** update it in the "Site Settings" section of
  the dashboard -- it updates the banner everywhere immediately.
- **Pagination:** your homepage always shows your 15 most recent articles.
  The "More" button leads to a full listing, 30 articles per page, with
  "Next Page" and numbered page links. Category pages work the same way.
- **Pin an article:** next to any post on the dashboard, click **Pin**. It's
  added to the bottom of the "Pinned Articles" section (shown below "Recent
  Articles" on your homepage, with a "Pinned Articles" section of its own
  further down the dashboard). Unlike "Recent Articles," this list is never
  reordered automatically -- use the &uarr;/&darr; arrows in that section to
  move an article up or down, or **Remove** to unpin it. The homepage shows
  the first 10; a "More" button leads to the rest, 20 per page.

## Changing how it behaves

Adding a category costs nothing to change -- it's a normal admin action,
not a code change (see "Add or remove a category" above).

Some things are quick code tweaks instead -- for example, if you end up
writing enough that you'd rather show 50 articles per page instead of 30,
that's one number (`PAGE_SIZE`) near the top of `server.js`. You don't need
to track these down yourself: whenever you want something like this
changed, just describe what you want and hand me the project again (or
keep working with me in the same place you got this from), and I'll make
the change and give you the updated files.

## Getting a future update live

Whenever I make a code change for you (a new feature, a tweak, a fix), the
path to get it onto your actual live site is always the same, and it's
short:

1. I'll give you an updated project folder, the same way as the first time.
2. Unzip it, and copy its files over your existing `blog-app` folder on your
   computer, replacing the old ones. (It never includes your `.env` file or
   your `data/` folder, so your admin login and your posts are never
   touched by this -- those only ever live on your computer and on Render.)
3. In your terminal, `cd` into the `blog-app` folder and run:
   ```
   git add .
   git commit -m "Describe what changed"
   git push
   ```
4. That's it -- Render watches your GitHub repository and automatically
   starts a new deploy within moments of the push, using the same settings
   (environment variables, disk, etc.) you already configured. You can
   watch it build on your Render dashboard, the same place you watched the
   very first deploy.

Nothing about your environment variables, your disk, or your Render service
itself needs to be touched again for an ordinary code update like this --
those were one-time setup. The only exception would be if a future change
needed a brand new environment variable, in which case I'll tell you
explicitly when that's the case.

## How it's built (only if you're curious)

- Node.js + Express serves the pages; SQLite (a single file at
  `data/blog.db`) stores your posts, tags, and settings -- no separate
  database server to manage.
- [Quill](https://quilljs.com) powers the rich-text editor, with the
  `quill-image-resize-module-fix` add-on for drag-to-resize images.
- Uploaded images are saved as ordinary files under `public/uploads/` and
  referenced normally, rather than bloating each post with embedded image
  data.
- There's exactly one admin account (you), authenticated with a hashed
  password and a signed login session cookie -- there's no public sign-up,
  since it's your blog.
