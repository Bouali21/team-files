import {
  startRuntime,
  expect,
} from "/home/user/oss-new/control/runtime/index.mjs";
import { emailOf, createFolder, uploadFiles } from "./lib.mjs";

const runtime = await startRuntime();
try {
  const memberEmail = await emailOf(runtime, "member");
  const folder = (await createFolder(runtime, "owner", "Board minutes")).body;
  const file = (
    await uploadFiles(
      runtime,
      "owner",
      [
        {
          name: "march-minutes.txt",
          type: "text/plain",
          body: "Approved the new office budget.",
        },
      ],
      folder.id,
    )
  ).body.items[0];

  const owner = await (await runtime.context("owner")).newPage();
  await owner.goto(`/folders/${folder.id}`);
  await owner.getByRole("button", { name: "Share", exact: true }).click();
  await owner.getByLabel("Email").fill(memberEmail);
  await owner.getByRole("button", { name: "Add", exact: true }).click();
  await expect(
    owner.getByTestId("share-row").filter({ hasText: memberEmail }),
  ).toBeVisible();
  await owner.keyboard.press("Escape");
  await owner.goto(`/files/${file.id}`);
  await owner
    .getByLabel("Comment", { exact: true })
    .fill("Filed for the record.");
  await owner.getByRole("button", { name: "Post" }).click();
  await expect(
    owner.getByTestId("comment").filter({ hasText: "Filed for the record." }),
  ).toBeVisible();
  await owner.getByRole("button", { name: "Add star" }).click();
  await expect(
    owner.getByRole("button", { name: "Remove star" }),
  ).toBeVisible();
  await owner.getByRole("button", { name: "Public link" }).click();
  await owner.getByRole("button", { name: "Turn on link" }).click();
  const linkPath = new URL(await owner.getByTestId("link-url").inputValue())
    .pathname;

  await runtime.restart();

  const raw = await runtime.fetch(`/api/files/${file.id}/raw`, {
    role: "member",
  });
  expect(raw.status).toBe(200);
  expect(await raw.text()).toBe("Approved the new office budget.");
  expect((await runtime.fetch(linkPath)).status).toBe(200);
  const again = await (await runtime.context("owner")).newPage();
  await again.goto(`/files/${file.id}`);
  await expect(
    again.getByTestId("comment").filter({ hasText: "Filed for the record." }),
  ).toBeVisible();
  await again.goto("/starred");
  await expect(
    again.getByTestId("item-row").filter({ hasText: "march-minutes.txt" }),
  ).toBeVisible();
  const member = await (await runtime.context("member")).newPage();
  await member.goto("/shared");
  await expect(
    member.getByRole("link", { name: "Board minutes" }),
  ).toBeVisible();
} finally {
  await runtime.close();
}
