import {
  startRuntime,
  expect,
} from "/home/user/oss-new/control/runtime/index.mjs";
import { emailOf, createFolder, uploadFiles } from "./lib.mjs";

const runtime = await startRuntime();
try {
  await runtime.assertPrivateAccess([
    "/",
    "/shared",
    "/recent",
    "/starred",
    "/trash",
    "/search",
  ]);

  const memberEmail = await emailOf(runtime, "member");
  const folder = (await createFolder(runtime, "owner", "Payroll")).body;
  const up = await uploadFiles(
    runtime,
    "owner",
    [
      {
        name: "salaries.txt",
        type: "text/plain",
        body: "confidential numbers",
      },
    ],
    folder.id,
  );
  const fileId = up.body.items[0].id;

  // Anonymous and outsider are refused on the file API.
  for (const role of [undefined, "outsider"]) {
    const r = await runtime.fetch(`/api/files/${fileId}/raw`, { role });
    expect([401, 403, 404]).toContain(r.status);
    const u = await uploadFiles(runtime, role, [
      { name: "x.txt", type: "text/plain", body: "x" },
    ]);
    expect([401, 403]).toContain(u.status);
  }

  // A member cannot read or change another member's private items.
  expect(
    (await runtime.fetch(`/api/files/${fileId}/raw`, { role: "member" }))
      .status,
  ).toBe(404);
  const intrude = await uploadFiles(
    runtime,
    "member",
    [{ name: "planted.txt", type: "text/plain", body: "x" }],
    folder.id,
  );
  expect(intrude.status).toBe(404);
  expect(
    (await createFolder(runtime, "member", "Sneaky", folder.id)).status,
  ).toBe(404);

  const member = await (await runtime.context("member")).newPage();
  await member.goto(`/files/${fileId}`);
  await expect(member.getByText("File not found")).toBeVisible();
  await expect(member.getByText("confidential numbers")).toHaveCount(0);
  await member.goto(`/folders/${folder.id}`);
  await expect(member.getByText("Folder not found")).toBeVisible();
  await member.goto("/search?q=salaries");
  await expect(member.getByTestId("item-row")).toHaveCount(0);
  await member.goto("/shared");
  await expect(member.getByRole("link", { name: "Payroll" })).toHaveCount(0);

  // Admin-only page refuses non-admins.
  await member.goto("/admin");
  await expect(
    member.getByText("Only admins can open this page."),
  ).toBeVisible();
  await expect(member.getByTestId("storage-row")).toHaveCount(0);

  // Viewer share: reads, cannot comment or upload; expired share stops working.
  const owner = await (await runtime.context("owner")).newPage();
  await owner.goto(`/folders/${folder.id}`);
  await owner.getByRole("button", { name: "Share", exact: true }).click();
  await owner.getByLabel("Email").fill(memberEmail);
  await owner.getByRole("button", { name: "Add", exact: true }).click();
  await expect(
    owner.getByTestId("share-row").filter({ hasText: memberEmail }),
  ).toContainText("Viewer");
  await owner.keyboard.press("Escape");

  expect(
    (await runtime.fetch(`/api/files/${fileId}/raw`, { role: "member" }))
      .status,
  ).toBe(200);
  expect(
    (
      await uploadFiles(
        runtime,
        "member",
        [{ name: "planted.txt", type: "text/plain", body: "x" }],
        folder.id,
      )
    ).status,
  ).toBe(404);
  await member.goto(`/files/${fileId}`);
  await expect(member.getByTestId("preview")).toContainText(
    "confidential numbers",
  );
  await expect(member.getByLabel("Comment", { exact: true })).toHaveCount(0);
  await expect(
    member.getByRole("button", { name: "Share", exact: true }),
  ).toHaveCount(0);

  const db = await runtime.database();
  await db
    .prepare("UPDATE shares SET expires_at = ? WHERE item_id = ?")
    .bind(new Date(Date.now() - 864e5).toISOString(), folder.id)
    .run();
  expect(
    (await runtime.fetch(`/api/files/${fileId}/raw`, { role: "member" }))
      .status,
  ).toBe(404);
  await member.goto(`/files/${fileId}`);
  await expect(member.getByText("File not found")).toBeVisible();

  // Public link exposes only the linked item and what is inside it.
  const other = (
    await uploadFiles(runtime, "owner", [
      { name: "outside.txt", type: "text/plain", body: "not linked" },
    ])
  ).body.items[0];
  await owner.goto(`/files/${fileId}`);
  await owner.getByRole("button", { name: "Public link" }).click();
  await owner.getByLabel("Allow download").click();
  await owner.getByRole("button", { name: "Turn on link" }).click();
  const linkPath = new URL(await owner.getByTestId("link-url").inputValue())
    .pathname;
  expect((await runtime.fetch(`${linkPath}/raw/${fileId}`)).status).toBe(200);
  expect((await runtime.fetch(`${linkPath}/raw/${other.id}`)).status).toBe(404);
  const pageHtml = await (await runtime.fetch(linkPath)).text();
  expect(pageHtml).not.toContain("outside.txt");
  expect(pageHtml).not.toContain("Payroll");
  // Expired link is not found.
  await db
    .prepare("UPDATE links SET expires_at = ? WHERE item_id = ?")
    .bind(new Date(Date.now() - 1000).toISOString(), fileId)
    .run();
  expect((await runtime.fetch(linkPath)).status).toBe(404);
  expect((await runtime.fetch(`${linkPath}/raw/${fileId}`)).status).toBe(404);

  // Comments: a member cannot delete someone else's comment, except the file owner.
  // (Covered in the browser: delete only shown for author and owner.)
  const share2 = await (await runtime.context("owner")).newPage();
  await share2.goto(`/files/${other.id}`);
  await share2.getByRole("button", { name: "Share", exact: true }).click();
  await share2.getByLabel("Email").fill(memberEmail);
  await share2.getByTestId("share-role").click();
  await share2.getByRole("option", { name: "Commenter" }).click();
  await share2.getByRole("button", { name: "Add", exact: true }).click();
  await expect(
    share2.getByTestId("share-row").filter({ hasText: memberEmail }),
  ).toContainText("Commenter");
  await share2.keyboard.press("Escape");
  await share2.getByLabel("Comment", { exact: true }).fill("Owner note");
  await share2.getByRole("button", { name: "Post" }).click();
  await expect(
    share2.getByTestId("comment").filter({ hasText: "Owner note" }),
  ).toBeVisible();
  await member.goto(`/files/${other.id}`);
  const ownerNote = member
    .getByTestId("comment")
    .filter({ hasText: "Owner note" });
  await expect(ownerNote).toBeVisible();
  await expect(ownerNote.getByRole("button", { name: "Delete" })).toHaveCount(
    0,
  );
  await expect(ownerNote.getByRole("button", { name: "Edit" })).toHaveCount(0);
  await member.getByLabel("Comment", { exact: true }).fill("Member question");
  await member.getByRole("button", { name: "Post" }).click();
  await share2.reload();
  const memberNote = share2
    .getByTestId("comment")
    .filter({ hasText: "Member question" });
  await expect(memberNote.getByRole("button", { name: "Edit" })).toHaveCount(0);
  await memberNote.getByRole("button", { name: "Delete" }).click();
  await expect(memberNote).toHaveCount(0);

  // Member's trash does not list the owner's items.
  await member.goto("/trash");
  await expect(
    member.getByTestId("item-row").filter({ hasText: "salaries.txt" }),
  ).toHaveCount(0);

  // The app has no sign-in page of its own.
  for (const path of [
    "/login",
    "/signin",
    "/sign-in",
    "/signup",
    "/auth/login",
  ]) {
    const r = await runtime.fetch(path, { role: "member" });
    const body = await r.text();
    expect(body).not.toMatch(/type=["']?password/i);
  }
} finally {
  await runtime.close();
}
