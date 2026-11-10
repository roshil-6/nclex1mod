import { expect, test } from "@playwright/test";
import { startCase } from "./helpers";

const noHorizontalOverflow = async (page: import("@playwright/test").Page) =>
  page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1);

test("mobile: case study is usable without page overflow and answers survive rotation", async ({ page }) => {
  await page.goto("/");
  expect(await noHorizontalOverflow(page)).toBe(true);

  await startCase(page, /diabetic ketoacidosis/);
  await expect(page.getByTestId("timer")).toBeVisible();
  expect(await noHorizontalOverflow(page)).toBe(true);

  // highlight table
  await page.getByRole("checkbox", { name: /Deep, rapid respirations/ }).click();
  await page.getByRole("tab", { name: "Laboratory Results" }).click();
  expect(await noHorizontalOverflow(page)).toBe(true);
  await page.getByRole("button", { name: "Next →" }).click();

  // matrix in a scroll container
  await page.getByRole("checkbox", { name: "Arterial pH 7.16: Metabolic acidosis" }).check();
  expect(await noHorizontalOverflow(page)).toBe(true);

  // rotate to landscape and back
  await page.setViewportSize({ width: 851, height: 393 });
  await expect(page.getByRole("checkbox", { name: "Arterial pH 7.16: Metabolic acidosis" })).toBeChecked();
  await page.setViewportSize({ width: 412, height: 839 });
  await expect(page.getByRole("checkbox", { name: "Arterial pH 7.16: Metabolic acidosis" })).toBeChecked();

  // mobile navigator drawer
  await page.getByRole("button", { name: "Questions" }).click();
  await page.getByRole("button", { name: /Question 1: answered/ }).click();
  await expect(page.getByTestId("q-number")).toHaveText("1");
  await expect(page.getByRole("checkbox", { name: /Deep, rapid respirations/ })).toHaveAttribute("aria-checked", "true");

  // native select works on mobile
  await page.getByRole("button", { name: "Next →" }).click();
  await page.getByRole("button", { name: "Next →" }).click();
  await page.getByLabel("Blank 1").selectOption({ label: "fluid volume deficit" });
  await expect(page.getByLabel("Blank 1")).toHaveValue("fvd");
  expect(await noHorizontalOverflow(page)).toBe(true);
});
