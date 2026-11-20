import {
  startRuntime,
  expect,
} from "/home/user/oss-new/control/runtime/index.mjs";
import { emailOf, createFolder, uploadFiles, PNG } from "./lib.mjs";

const runtime = await startRuntime();
try {
  const memberEmail = await emailOf(runtime, "member");
  const ownerEmail = await emailOf(runtime, "owner");

  // F001 at request level: folders and uploads, sizes and names kept.
  const api = await createFolder(runtime, "owner", "Vendor contracts");
  expect(api.status).toBe(201);
  const up = await uploadFiles(
    runtime,
    "owner",
    [
      {
        name: "cleaning-agreement.txt",
        type: "text/plain",
        body: "Cleaning service: weekly, Mondays.",
      },
      {
        name: "office-lease.txt",
        type: "text/plain",
        body: "Lease runs until 2028.",
      },
    ],
    api.body.id,
  );
  expect(up.status).toBe(201);
  expect(up.body.items.map((i) => i.name).sort()).toEqual([
    "cleaning-agreement.txt",
    "office-lease.txt",
  ]);
  const leaseId = up.body.items.find((i) => i.name === "office-lease.txt").id;
  const raw = await runtime.fetch(`/api/files/${leaseId}/raw`, {
    role: "owner",
  });
  expect(raw.status).toBe(200);
  expect(await raw.text()).toBe("Lease runs until 2028.");
  const dl = await runtime.fetch(`/api/files/${leaseId}/raw?download=1`, {
    role: "owner",
  });
  expect(dl.headers.get("content-disposition")).toContain("attachment");
  expect((await createFolder(runtime, "owner", "   ")).status).toBe(400);

  // Browser journey: owner builds a folder.
  const owner = await (await runtime.context("owner")).newPage();
  await owner.goto("/");
  await runtime.assertBackLink(owner);
  await expect(
    owner.getByRole("heading", { level: 1, name: "My files" }),
  ).toBeVisible();
  await expect(owner.getByTestId("storage-used")).toBeVisible();

  await owner.getByRole("button", { name: "New folder" }).click();
  await owner.getByLabel("Name", { exact: true }).fill("Q3 Planning");
  await owner.getByRole("button", { name: "Create" }).click();
  await expect(
    owner.getByTestId("item-row").filter({ hasText: "Q3 Planning" }),
  ).toBeVisible();
  await owner.getByRole("link", { name: "Q3 Planning" }).click();
  await expect(
    owner.getByRole("heading", { level: 1, name: "Q3 Planning" }),
  ).toBeVisible();

  await owner.getByTestId("upload-input").setInputFiles([
    {
      name: "budget-notes.txt",
      mimeType: "text/plain",
      buffer: Buffer.from(
        "Travel budget: 4,200 for the quarter.\nHiring: two engineers.",
      ),
    },
    { name: "site-photo.png", mimeType: "image/png", buffer: PNG },
    {
      name: "kickoff-agenda.txt",
      mimeType: "text/plain",
      buffer: Buffer.from("1. Goals\n2. Owners\n3. Dates"),
    },
  ]);
  const rows = owner.getByTestId("item-row");
  await expect(rows.filter({ hasText: "budget-notes.txt" })).toBeVisible();
  await expect(rows.filter({ hasText: "site-photo.png" })).toBeVisible();
  await expect(rows.filter({ hasText: "kickoff-agenda.txt" })).toBeVisible();
  await expect(rows.filter({ hasText: "budget-notes.txt" })).toContainText(
    "me",
  );

  // Sorting by name, both ways.
  await owner.getByRole("button", { name: "Name", exact: true }).click();
  const namesAsc = await rows
    .locator("[data-testid=item-name]")
    .allInnerTexts();
  await owner.getByRole("button", { name: "Name", exact: true }).click();
  const namesDesc = await rows
    .locator("[data-testid=item-name]")
    .allInnerTexts();
  expect(namesDesc).toEqual([...namesAsc].reverse());

  // Nested folder, move, rename, breadcrumb.
  await owner.getByRole("button", { name: "New folder" }).click();
  await owner.getByLabel("Name", { exact: true }).fill("Drafts");
  await owner.getByRole("button", { name: "Create" }).click();
  await expect(rows.filter({ hasText: "Drafts" })).toBeVisible();

  await owner
    .getByRole("button", { name: "More actions for kickoff-agenda.txt" })
    .click();
  await owner.getByRole("menuitem", { name: "Move", exact: true }).click();
  await owner.getByTestId("move-destination").click();
  await owner
    .getByRole("option", { name: "My files / Q3 Planning / Drafts" })
    .click();
  await owner.getByRole("button", { name: "Move", exact: true }).click();
  await expect(rows.filter({ hasText: "kickoff-agenda.txt" })).toHaveCount(0);

  // A folder can't be moved into itself.
  await owner.getByRole("button", { name: "More actions for Drafts" }).click();
  await owner.getByRole("menuitem", { name: "Move", exact: true }).click();
  await owner.getByTestId("move-destination").click();
  await expect(
    owner.getByRole("option", { name: "My files / Q3 Planning / Drafts" }),
  ).toHaveCount(0);
  await owner.keyboard.press("Escape");
  await owner.keyboard.press("Escape");

  await owner.getByRole("link", { name: "Drafts" }).click();
  await expect(
    owner.getByRole("heading", { level: 1, name: "Drafts" }),
  ).toBeVisible();
  const crumbs = owner.getByRole("navigation", { name: "Breadcrumb" });
  await expect(crumbs).toContainText("My files");
  await expect(crumbs).toContainText("Q3 Planning");
  await owner
    .getByRole("button", { name: "More actions for kickoff-agenda.txt" })
    .click();
  await owner.getByRole("menuitem", { name: "Rename" }).click();
  await owner.getByLabel("Name", { exact: true }).fill("kickoff-agenda-v2.txt");
  await owner.getByRole("button", { name: "Save" }).click();
  await expect(rows.filter({ hasText: "kickoff-agenda-v2.txt" })).toBeVisible();
  await crumbs.getByRole("link", { name: "Q3 Planning" }).click();
  await expect(
    owner.getByRole("heading", { level: 1, name: "Q3 Planning" }),
  ).toBeVisible();

  // F002: preview a text file and an image, download link present.
  await owner.getByRole("link", { name: "budget-notes.txt" }).click();
  await expect(
    owner.getByRole("heading", { level: 1, name: "budget-notes.txt" }),
  ).toBeVisible();
  await expect(owner.getByTestId("preview")).toContainText(
    "Travel budget: 4,200",
  );
  await expect(owner.getByRole("link", { name: "Download" })).toHaveAttribute(
    "href",
    /\/api\/files\/.+\/raw\?download=1/,
  );
  await owner.goBack();
  await owner.getByRole("link", { name: "site-photo.png" }).click();
  await expect(owner.getByTestId("preview").locator("img")).toBeVisible();
  await owner.goBack();

  // F003: share the folder with a member as commenter.
  await owner.getByRole("button", { name: "Share", exact: true }).click();
  await owner.getByLabel("Email").fill(memberEmail);
  await owner.getByTestId("share-role").click();
  await owner.getByRole("option", { name: "Commenter" }).click();
  await owner.getByRole("button", { name: "Add", exact: true }).click();
  const shareRow = owner
    .getByTestId("share-row")
    .filter({ hasText: memberEmail });
  await expect(shareRow).toContainText("Commenter");
  await owner.keyboard.press("Escape");

  // Member sees it under Shared with me, reads inside, comments (F005).
  const member = await (await runtime.context("member")).newPage();
  await member.goto("/shared");
  await expect(
    member.getByRole("heading", { level: 1, name: "Shared with me" }),
  ).toBeVisible();
  await member.getByRole("link", { name: "Q3 Planning" }).click();
  await member.getByRole("link", { name: "budget-notes.txt" }).click();
  await expect(member.getByTestId("preview")).toContainText(
    "Hiring: two engineers.",
  );
  await member
    .getByLabel("Comment", { exact: true })
    .fill("Can we move 500 from travel to hiring?");
  await member.getByRole("button", { name: "Post" }).click();
  const memberComment = member
    .getByTestId("comment")
    .filter({ hasText: "Can we move 500" });
  await expect(memberComment).toContainText(memberEmail);
  // A commenter cannot rename.
  await expect(member.getByRole("button", { name: "Rename" })).toHaveCount(0);

  // Owner replies, edits own comment, sees the member's.
  await owner.getByRole("link", { name: "budget-notes.txt" }).click();
  await expect(
    owner.getByTestId("comment").filter({ hasText: "Can we move 500" }),
  ).toBeVisible();
  await owner.getByLabel("Comment", { exact: true }).fill("Yes, approved");
  await owner.getByRole("button", { name: "Post" }).click();
  const mine = owner
    .getByTestId("comment")
    .filter({ hasText: "Yes, approved" });
  await mine.getByRole("button", { name: "Edit" }).click();
  await owner.getByLabel("Edited text").fill("Yes, approved for October.");
  await owner.getByRole("button", { name: "Save" }).click();
  await expect(
    owner
      .getByTestId("comment")
      .filter({ hasText: "Yes, approved for October." }),
  ).toBeVisible();

  // Change the member's role to editor; the member can now rename.
  await owner.goto("/");
  await owner
    .getByRole("button", { name: "More actions for Q3 Planning" })
    .click();
  await owner.getByRole("menuitem", { name: "Share" }).click();
  await owner
    .getByTestId("share-row")
    .filter({ hasText: memberEmail })
    .getByTestId("share-row-role")
    .click();
  await owner.getByRole("option", { name: "Editor" }).click();
  await expect(
    owner.getByTestId("share-row").filter({ hasText: memberEmail }),
  ).toContainText("Editor");
  await owner.keyboard.press("Escape");
  await member.reload();
  await expect(member.getByRole("button", { name: "Rename" })).toBeVisible();

  // Transfer ownership of the folder's photo to the member.
  await owner.getByRole("link", { name: "Q3 Planning" }).click();
  await owner
    .getByRole("button", { name: "More actions for site-photo.png" })
    .click();
  await owner.getByRole("menuitem", { name: "Share" }).click();
  await owner.getByLabel("Email").fill(memberEmail);
  await owner.getByRole("button", { name: "Add", exact: true }).click();
  await owner
    .getByTestId("share-row")
    .filter({ hasText: memberEmail })
    .getByRole("button", { name: "Make owner" })
    .click();
  await owner.getByRole("button", { name: "Transfer" }).click();
  await expect(
    owner.getByTestId("share-row").filter({ hasText: memberEmail }),
  ).toHaveCount(0);
  await expect(
    owner.getByTestId("share-row").filter({ hasText: ownerEmail }),
  ).toContainText("Editor");
  await owner.keyboard.press("Escape");
  await expect(owner.getByRole("dialog")).toHaveCount(0);
  await expect(rows.filter({ hasText: "site-photo.png" })).toContainText(
    memberEmail,
  );

  // F004: public link on a file, download off.
  await owner
    .getByRole("button", { name: "More actions for budget-notes.txt" })
    .click();
  await owner.getByRole("menuitem", { name: "Public link" }).click();
  await owner.getByRole("button", { name: "Turn on link" }).click();
  const linkUrl = await owner.getByTestId("link-url").inputValue();
  expect(new URL(linkUrl).hostname).toBe(runtime.hostname);
  const linkPath = new URL(linkUrl).pathname;
  await owner.keyboard.press("Escape");
  const anon = await (await runtime.context(null)).newPage();
  await anon.goto(linkPath);
  await expect(
    anon.getByRole("heading", { name: "budget-notes.txt" }),
  ).toBeVisible();
  await expect(anon.getByTestId("preview")).toContainText("Travel budget");
  await expect(anon.getByRole("link", { name: "Download" })).toHaveCount(0);
  const pubRaw = await runtime.fetch(`${linkPath}/raw/${leaseId}`);
  expect(pubRaw.status).toBe(404);

  // Folder link: browse contents anonymously, with download.
  const folderLink = await owner.evaluate(() => location.pathname);
  await owner.goto("/");
  await owner
    .getByRole("button", { name: "More actions for Q3 Planning" })
    .click();
  await owner.getByRole("menuitem", { name: "Public link" }).click();
  await owner.getByLabel("Allow download").click();
  await owner.getByRole("button", { name: "Turn on link" }).click();
  const folderLinkPath = new URL(
    await owner.getByTestId("link-url").inputValue(),
  ).pathname;
  await anon.goto(folderLinkPath);
  await expect(
    anon.getByTestId("public-row").filter({ hasText: "Drafts" }),
  ).toBeVisible();
  await anon.getByRole("link", { name: "Drafts" }).click();
  await anon.getByRole("link", { name: "kickoff-agenda-v2.txt" }).click();
  await expect(anon.getByTestId("preview")).toContainText("1. Goals");
  await expect(anon.getByRole("link", { name: "Download" })).toBeVisible();
  // Turn the folder link off; the page becomes not found.
  await owner.getByRole("button", { name: "Turn off link" }).click();
  await expect(
    owner.getByRole("button", { name: "Turn on link" }),
  ).toBeVisible();
  await owner.keyboard.press("Escape");
  expect((await runtime.fetch(folderLinkPath)).status).toBe(404);
  expect((await runtime.fetch("/s/not-a-real-token")).status).toBe(404);
  void folderLink;

  // F006: search with type filter, star, recent.
  await owner.goto("/search?q=notes");
  await expect(
    owner.getByTestId("item-row").filter({ hasText: "budget-notes.txt" }),
  ).toBeVisible();
  await owner.goto("/search?q=a&type=folder");
  await expect(
    owner.getByTestId("item-row").filter({ hasText: "Q3 Planning" }),
  ).toBeVisible();
  await expect(
    owner.getByTestId("item-row").filter({ hasText: "budget-notes.txt" }),
  ).toHaveCount(0);
  await owner.goto("/search");
  await owner.getByTestId("search-input").fill("lease");
  await owner.getByTestId("search-input").press("Enter");
  await expect(
    owner.getByTestId("item-row").filter({ hasText: "office-lease.txt" }),
  ).toBeVisible();

  await owner.goto("/");
  await owner
    .getByRole("button", { name: "More actions for Vendor contracts" })
    .click();
  await owner.getByRole("menuitem", { name: "Add star" }).click();
  await owner.goto("/starred");
  await expect(
    owner.getByTestId("item-row").filter({ hasText: "Vendor contracts" }),
  ).toBeVisible();
  await owner.goto("/recent");
  await expect(owner.getByTestId("item-row").first()).toBeVisible();
  await expect(
    owner.getByTestId("item-row").filter({ hasText: "kickoff-agenda-v2.txt" }),
  ).toBeVisible();

  // Trash: remove, restore, remove, delete forever.
  await owner.goto("/");
  await owner.getByRole("link", { name: "Vendor contracts" }).click();
  await owner
    .getByRole("button", { name: "More actions for cleaning-agreement.txt" })
    .click();
  await owner.getByRole("menuitem", { name: "Move to trash" }).click();
  await expect(
    owner.getByTestId("item-row").filter({ hasText: "cleaning-agreement.txt" }),
  ).toHaveCount(0);
  await owner.goto("/trash");
  const trashed = owner
    .getByTestId("item-row")
    .filter({ hasText: "cleaning-agreement.txt" });
  await trashed.getByRole("button", { name: "Restore" }).click();
  await expect(trashed).toHaveCount(0);
  await owner.goto("/");
  await owner.getByRole("link", { name: "Vendor contracts" }).click();
  await expect(
    owner.getByTestId("item-row").filter({ hasText: "cleaning-agreement.txt" }),
  ).toBeVisible();
  await owner
    .getByRole("button", { name: "More actions for cleaning-agreement.txt" })
    .click();
  await owner.getByRole("menuitem", { name: "Move to trash" }).click();
  await owner.goto("/trash");
  await owner
    .getByTestId("item-row")
    .filter({ hasText: "cleaning-agreement.txt" })
    .getByRole("button", { name: "Delete forever" })
    .click();
  await owner
    .getByRole("alertdialog")
    .getByRole("button", { name: "Delete forever" })
    .click();
  await expect(
    owner.getByTestId("item-row").filter({ hasText: "cleaning-agreement.txt" }),
  ).toHaveCount(0);

  // 30-day purge by the scheduled job.
  const db = await runtime.database();
  await db
    .prepare("UPDATE items SET trashed_at = ? WHERE name = 'office-lease.txt'")
    .bind(new Date(Date.now() - 31 * 864e5).toISOString())
    .run();
  await runtime.scheduled("17 3 * * *");
  const left = await db
    .prepare("SELECT count(*) AS n FROM items WHERE name = 'office-lease.txt'")
    .first();
  expect(left.n).toBe(0);

  // Admin: storage per member, public links with revoke.
  await owner.goto("/admin");
  await expect(
    owner.getByTestId("storage-row").filter({ hasText: ownerEmail }),
  ).toBeVisible();
  const linkRow = owner
    .getByTestId("link-row")
    .filter({ hasText: "budget-notes.txt" });
  await linkRow.getByRole("button", { name: "Revoke" }).click();
  await expect(linkRow).toHaveCount(0);
  expect((await runtime.fetch(linkPath)).status).toBe(404);

  // Phone-sized smoke.
  const phone = await (
    await runtime.context("owner", {
      viewport: { width: 390, height: 844 },
      isMobile: true,
      hasTouch: true,
    })
  ).newPage();
  await phone.goto("/");
  await expect(
    phone.getByRole("heading", { level: 1, name: "My files" }),
  ).toBeVisible();
  await expect(
    phone.getByTestId("item-row").filter({ hasText: "Q3 Planning" }),
  ).toBeVisible();

  // The journey's result on screen.
  await owner.goto("/");
  await owner.getByRole("link", { name: "Q3 Planning" }).click();
  await expect(
    owner.getByTestId("item-row").filter({ hasText: "budget-notes.txt" }),
  ).toBeVisible();
  await runtime.screenshot(owner);
} finally {
  await runtime.close();
}
