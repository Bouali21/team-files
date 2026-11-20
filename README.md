# Team Files

Store files and folders for your team, preview them in the browser, and share them with members by role or with anyone through a view link.

Inspired by https://drive.google.com

Built with [oss.new](https://oss.new) for [EveryApp](https://github.com/every-app/every-app).

## Features

- Upload files, make nested folders, rename, move, download and trash, in a sortable list with breadcrumbs.
- Open images, PDFs, video, audio and text files right in the browser.
- Share a file or folder with members as viewer, commenter or editor, with an optional expiry, and hand over ownership.
- Turn on a view link anyone can open, with an optional expiry and download on or off.
- Comment on files next to their preview.
- Search by name and type, star items, see recent ones, restore from the trash, and check storage use; admins see use per member and every public link.

Left out: accounts and sign-in, which your Gateway handles; desktop and mobile apps; AI answers; built-in document editors; team drives, activity and e-signatures; integrations; PDF annotations; storage plans and enterprise controls.

## Setup

Needs Node 22, pnpm and an EveryApp Gateway on a Cloudflare account with R2 enabled.

- Install: `pnpm install`
- Run locally: `pnpm dev`
- Test: `pnpm test` and `pnpm types:check`
- Deploy: `pnpm run deploy`

There are no secrets or settings to fill in. The deploy creates the D1 database and the `files` R2 bucket, and a daily cron empties the trash.

## Limitations

- Each upload goes through the Worker in one request, so a single file is limited by Cloudflare's request body size (100 MB on most plans).
- Items in the trash are deleted forever after 30 days.
- Ownership can only go to a member who has opened the app at least once.
- Shared drives, desktop sync and in-browser editing are not available.
- Deploying to a live Gateway was not part of local testing.
