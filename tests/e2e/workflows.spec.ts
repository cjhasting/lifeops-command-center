import { test, expect, type Page } from "@playwright/test";
import { createSeedData } from "../../src/data/seed";
import { newTask, setPlan } from "../../src/domain/data";
import { todayKey, addDays } from "../../src/utils/date";
const day = "2026-09-20";
async function open(page: Page, data = createSeedData()) {
  await page.clock.install({ time: new Date("2026-09-20T12:00:00-05:00") });
  await page.addInitScript((d) => {
    if (!localStorage.getItem("test:loaded")) {
      localStorage.setItem("lifeops:data:v6", JSON.stringify(d));
      localStorage.setItem("test:loaded", "yes");
    }
  }, data);
  await page.goto("/");
  await expect(page.getByRole("heading", { name: "Today." })).toBeVisible();
}
const nav = (p: Page, name: string) =>
  p.getByRole("navigation").getByRole("button", { name, exact: true }).click();
const state = (p: Page) =>
  p.evaluate(() => JSON.parse(localStorage.getItem("lifeops:data:v6")!));
const base = () => {
  const d = createSeedData();
  d.openLoops = [
    newTask("Walk", {
      id: "walk",
      minimumVersion: "Put on shoes",
      dueDate: "2026-09-25",
      relatedProjectId: "p",
    }),
    newTask("Measure wall", { id: "measure" }),
  ];
  d.projects = [
    {
      id: "p",
      name: "Wellbeing",
      status: "Building",
      currentObjective: "More time outdoors",
      createdAt: day,
      updatedAt: day,
    },
  ];
  return setPlan(d, {
    date: day,
    taskIds: ["walk", "measure"],
    lowEnergy: false,
    smallActions: [],
  });
};
test("capture, draft, multiline note, extraction and duplicate prevention", async ({
  page,
}) => {
  await open(page);
  await page.getByRole("button", { name: "Add what’s on your mind" }).click();
  await page
    .getByLabel("What’s on your mind?")
    .fill(
      "Garage is a mess.\nNeed shelves.\nCheck measurements before buying.",
    );
  await page.keyboard.press("Escape");
  await page.getByRole("button", { name: "Add what’s on your mind" }).click();
  await expect(page.getByLabel("What’s on your mind?")).toHaveValue(/Garage/);
  await page.getByRole("button", { name: "Save", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Today." })).toBeVisible();
  await page.reload();
  await nav(page, "Inbox");
  await page.getByRole("button", { name: /Garage is a mess/ }).click();
  await page.getByRole("button", { name: "Keep as note" }).click();
  expect((await state(page)).openLoops).toHaveLength(0);
  await page.getByRole("button", { name: "Notes", exact: true }).click();
  await page.getByRole("button", { name: /Garage is a mess/ }).click();
  await page
    .getByRole("button", { name: "Create tasks from this note" })
    .click();
  await page.getByLabel("Select line 3").check();
  await page.getByLabel("Task from line 3").fill("Measure garage wall");
  await page.getByRole("button", { name: "Create selected tasks" }).click();
  await page.getByRole("button", { name: /Garage is a mess/ }).click();
  await page
    .getByRole("button", { name: "Create tasks from this note" })
    .click();
  await expect(page.getByLabel("Select line 3")).toBeDisabled();
  expect((await state(page)).openLoops).toHaveLength(1);
  expect((await state(page)).notes[0].text).toContain("Check measurements");
});
test("rename, shared completion, project activity and undo", async ({
  page,
}) => {
  await open(page, base());
  await nav(page, "Inbox");
  await page.getByRole("button", { name: "Tasks", exact: true }).click();
  await page.getByRole("button", { name: "Walk", exact: true }).click();
  await page
    .getByRole("textbox", { name: "Task", exact: true })
    .fill("Walk around the lake");
  await page.getByRole("button", { name: "Save changes" }).click();
  await nav(page, "Today");
  await expect(
    page.getByRole("button", { name: "Walk around the lake", exact: true }),
  ).toBeVisible();
  await page
    .getByRole("button", { name: "Complete Walk around the lake" })
    .click();
  expect((await state(page)).projects[0].lastWorkedAt).toBeTruthy();
  await nav(page, "Inbox");
  await page.getByRole("button", { name: "Completed", exact: true }).click();
  await expect(
    page.getByRole("button", { name: "Walk around the lake", exact: true }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Undo", exact: true }).click();
  expect((await state(page)).openLoops[0].status).toBe("Next Action");
});
test("postponement keeps deadline and resurfaces on its planned date", async ({
  page,
}) => {
  await open(page, base());
  await page
    .getByRole("article")
    .filter({ hasText: "Walk" })
    .getByRole("button", { name: "Later", exact: true })
    .click();
  await page.getByRole("button", { name: "Tomorrow", exact: true }).click();
  expect((await state(page)).openLoops[0].dueDate).toBe("2026-09-25");
  await page.clock.fastForward(24 * 60 * 60 * 1000);
  await expect(page.getByText("Ready when you are · 1")).toBeVisible();
});
test("minimum progress and normal plan survive reload; day resets at midnight", async ({
  page,
}) => {
  await open(page, base());
  await page.getByRole("button", { name: "Low energy today" }).click();
  await page
    .getByRole("checkbox", { name: "Put on shoes Minimum of Walk" })
    .check();
  await page.getByRole("button", { name: "Use this smaller plan" }).click();
  await page.getByRole("button", { name: "Complete Put on shoes" }).click();
  await page.reload();
  await expect(page.getByText("Minimum done · Walk")).toBeVisible();
  expect((await state(page)).openLoops[0].status).toBe("Next Action");
  await page.getByRole("button", { name: "Return to normal plan" }).click();
  await expect(
    page.getByRole("button", { name: "Walk", exact: true }),
  ).toBeVisible();
  await page.clock.fastForward(24 * 60 * 60 * 1000);
  await expect(
    page.getByRole("button", { name: "Low energy today" }),
  ).toHaveAttribute("aria-pressed", "false");
});
test("wrap-up upserts a daily review and preserves unfinished work", async ({
  page,
}) => {
  await open(page, base());
  await page.getByRole("button", { name: "Wrap up today" }).click();
  await page.getByLabel("Walk", { exact: true }).selectOption(addDays(day, 1));
  await page
    .getByLabel("Anything worth remembering?")
    .fill("A quiet afternoon");
  await page.getByLabel("Tomorrow’s first action").selectOption("walk");
  await page.getByRole("button", { name: "Save wrap-up" }).click();
  await page.getByRole("button", { name: "Wrap up today" }).click();
  await expect(page.getByLabel("Anything worth remembering?")).toHaveValue(
    "A quiet afternoon",
  );
  await page.getByRole("button", { name: "Save wrap-up" }).click();
  expect((await state(page)).aarReviews).toHaveLength(1);
  expect((await state(page)).openLoops).toHaveLength(2);
});
test("save failure stays visible, retains text and does not report success", async ({
  page,
}) => {
  await open(page);
  await page.getByRole("button", { name: "Add what’s on your mind" }).click();
  await page.getByLabel("What’s on your mind?").fill("Do not lose this");
  await page.evaluate(() => {
    Storage.prototype.setItem = () => {
      throw new DOMException("Quota exceeded", "QuotaExceededError");
    };
  });
  await page.getByRole("button", { name: "Save", exact: true }).click();
  await expect(page.getByRole("dialog").getByRole("alert")).toContainText(
    "Not saved",
  );
  await expect(page.getByLabel("What’s on your mind?")).toHaveValue(
    "Do not lose this",
  );
  expect((await state(page)).notes).toHaveLength(0);
});
test("full plan never silently expands", async ({ page }) => {
  const d = base();
  d.openLoops.push(newTask("Third", { id: "third" }));
  d.dayPlans[0].taskIds.push("third");
  await open(page, d);
  await page.getByRole("button", { name: "Replace an action" }).click();
  await page.getByLabel("Create an action").fill("Fourth");
  await expect(page.getByRole("button", { name: "Save plan" })).toBeDisabled();
  await page.getByLabel("Replace an action").selectOption("measure");
  await page.getByRole("button", { name: "Save plan" }).click();
  const saved = await state(page);
  expect(saved.dayPlans[0].taskIds).toHaveLength(3);
  expect(saved.openLoops).toHaveLength(4);
});
for (const width of [375, 390, 430])
  for (const theme of ["light", "dark"] as const)
    test(`responsive ${width} ${theme}`, async ({ page }) => {
      const d = base();
      d.settings.theme = theme;
      d.openLoops[0].title =
        "A very long action name with enough detail to span several lines without clipping or hiding its controls";
      d.notes = [
        {
          id: "n",
          text: "A long note.\n" + "Meaningful detail ".repeat(40),
          state: "inbox",
          createdAt: day,
          updatedAt: day,
        },
      ];
      await page.setViewportSize({ width, height: 844 });
      await open(page, d);
      for (const screen of ["Today", "Inbox", "Projects"]) {
        await nav(page, screen);
        expect(
          await page.evaluate(
            () => document.documentElement.scrollWidth <= innerWidth,
          ),
        ).toBe(true);
        await page.screenshot({
          path: `work/screenshots/${width}-${theme}-${screen}.png`,
          fullPage: true,
        });
      }
      await page
        .getByRole("button", { name: "Add what’s on your mind" })
        .click();
      await expect(page.getByLabel("What’s on your mind?")).toBeFocused();
      await page.keyboard.press("Escape");
      await expect(
        page.getByRole("button", { name: "Add what’s on your mind" }),
      ).toBeFocused();
    });
