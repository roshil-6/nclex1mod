import { expect, test } from "@playwright/test";
import { sessionIdFrom, setDeadline, startCase } from "./helpers";

test("home page offers the exam modes and states availability honestly", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByRole("heading", { name: "Clinical Mock Exam" })).toBeVisible();
  for (const name of ["Start Mock Exam", "Quick Practice", "Case Study Practice"]) await expect(page.getByRole("link", { name })).toBeVisible();
  await page.getByRole("link", { name: "Start Mock Exam" }).click();
  await expect(page.getByTestId("available-count")).toHaveText("150");
  await expect(page.getByText(/Not yet available/)).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Begin" })).toBeEnabled();
});

test("full mock exam: 150 unique questions, 5-hour timer, no answer reveal", async ({ page }) => {
  await page.goto("/setup?mode=full");
  await page.getByRole("button", { name: "Begin" }).click();
  await expect(page).toHaveURL(/\/exam\//);
  await expect(page.getByTestId("q-total")).toHaveText("150");
  await expect(page.getByTestId("timer")).toHaveText(/^(05:00|04:59)$/);
  await expect(page.getByText("Examination mode")).toBeVisible();
  await expect(page.getByRole("button", { name: "Submit answer" })).toHaveCount(0);
  // every question id in the stored session is unique
  const ids = await page.evaluate(async () => {
    const db: IDBDatabase = await new Promise((res) => {
      const r = indexedDB.open("clinical-mock-exam");
      r.onsuccess = () => res(r.result);
    });
    const all: { questionIds: string[]; mode: string }[] = await new Promise((res) => {
      const g = db.transaction("sessions").objectStore("sessions").getAll();
      g.onsuccess = () => res(g.result);
    });
    return all.find((s) => s.mode === "full")!.questionIds;
  });
  expect(ids).toHaveLength(150);
  expect(new Set(ids).size).toBe(150);
});

test("complete case study: answer, navigate, flag, reload, submit, review, retake", async ({ page }) => {
  await startCase(page, /hip arthroplasty/);
  const sid = sessionIdFrom(page.url());
  await expect(page.getByTestId("case-progress")).toHaveText("Case Study — Part 1 of 6");

  // Part 1 — highlight (correct: a, b, c, h)
  for (const t of [/calf feels "tight and aching"/, /circumference 3 cm larger/, /warm and tender to touch/, /Declined the enoxaparin/])
    await page.getByRole("checkbox", { name: t }).click();
  await page.getByRole("button", { name: "Next →" }).click();

  // Part 2 — dropdown sentence
  await expect(page.getByTestId("case-progress")).toHaveText("Case Study — Part 2 of 6");
  await page.getByLabel("Blank 1").selectOption({ label: "pulmonary embolism" });
  await page.getByLabel("Blank 2").selectOption({ label: "unilateral calf swelling" });
  await page.getByLabel("Blank 3").selectOption({ label: "pedal pulses of 2+" }); // deliberately wrong -> partial credit
  await page.getByRole("button", { name: "Next →" }).click();

  // Part 3 — single; switching tabs must not reset the selection
  await page.getByRole("radio", { name: /Impaired gas exchange/ }).check();
  await page.getByRole("tab", { name: "Vital Signs" }).click();
  await expect(page.getByRole("cell", { name: "124/min" })).toBeVisible();
  await page.getByRole("tab", { name: "Prescriptions" }).click();
  await expect(page.getByRole("radio", { name: /Impaired gas exchange/ })).toBeChecked();
  await page.getByRole("button", { name: /Mark for review/ }).click();
  await expect(page.getByRole("button", { name: /Flagged/ })).toBeVisible();

  // Reload: answers, flag and position survive
  await page.reload();
  await expect(page.getByTestId("q-number")).toHaveText("3");
  await expect(page.getByRole("radio", { name: /Impaired gas exchange/ })).toBeChecked();
  await expect(page.getByRole("button", { name: /Flagged/ })).toBeVisible();
  await page.getByRole("button", { name: "← Previous" }).click();
  await expect(page.getByLabel("Blank 1")).toHaveValue("pe");
  await page.getByRole("button", { name: "Next →" }).click();
  await page.getByRole("button", { name: "Next →" }).click();

  // Part 4 — matrix single
  for (const [row, col] of [
    ["Raise the head of the bed", "Indicated"],
    ["Apply supplemental oxygen", "Indicated"],
    ["Massage the right calf to relieve tightness", "Contraindicated"],
    ["Assist the client to walk in the hallway", "Contraindicated"],
    ["Apply a sequential compression device to the right leg", "Contraindicated"],
    ["Place the client on continuous pulse oximetry and cardiac monitoring", "Indicated"],
  ])
    await page.getByRole("radio", { name: `${row}: ${col}` }).check();
  await page.getByRole("button", { name: "Next →" }).click();

  // Part 5 — SATA; Part 6 left unanswered on purpose
  await page.getByRole("checkbox", { name: /baseline aPTT/ }).check();
  await page.getByRole("checkbox", { name: /electronic infusion pump/ }).check();
  await page.getByRole("button", { name: "Next →" }).click();
  await expect(page.getByTestId("case-progress")).toHaveText("Case Study — Part 6 of 6");

  // Navigator jump
  await page.getByRole("button", { name: /Question 1: answered/ }).click();
  await expect(page.getByTestId("q-number")).toHaveText("1");

  // Finish
  await page.getByRole("button", { name: "Finish examination" }).click();
  await expect(page.getByText(/1 unanswered question/)).toBeVisible();
  await expect(page.getByText(/1 question\(s\) are flagged/)).toBeVisible();
  await page.getByRole("button", { name: "Submit examination" }).click();
  await expect(page).toHaveURL(new RegExp(`/results/${sid}`));

  // Expected: P1 4/4, P2 2/3, P3 1/1, P4 6/6, P5 2/4 (a,b of a,b,c,e), P6 unanswered 0/6
  await expect(page.getByTestId("res-total")).toHaveText("6");
  await expect(page.getByTestId("res-correct")).toHaveText("3");
  await expect(page.getByTestId("res-partial")).toHaveText("2");
  await expect(page.getByTestId("res-unanswered")).toHaveText("1");
  await expect(page.getByTestId("res-points")).toHaveText("15 / 24");
  await expect(page.getByText("Case-study performance")).toBeVisible();

  // Results stay consistent after reload
  await page.reload();
  await expect(page.getByTestId("res-points")).toHaveText("15 / 24");

  // Exam page for a submitted session redirects to results (no re-entry)
  await page.goto(`/exam/${sid}`);
  await expect(page).toHaveURL(new RegExp(`/results/${sid}`));

  // Review
  await page.getByRole("link", { name: "Review Answers" }).click();
  await expect(page.getByTestId("review-number")).toHaveText("1");
  await expect(page.getByText("Rationale")).toBeVisible();
  await page.getByRole("button", { name: "Next →" }).click();
  await expect(page.getByTestId("review-number")).toHaveText("2");
  await expect(page.getByText("Correct: the refused enoxaparin dose")).toBeVisible();
  await page.getByRole("tab", { name: "Correct answer" }).click();
  await expect(page.getByLabel("Blank 3")).toHaveValue("refused");

  // Retake creates an independent session
  await page.getByRole("link", { name: "Back to results" }).click();
  await page.getByRole("button", { name: "Retake Examination" }).click();
  await expect(page).toHaveURL(/\/exam\//);
  expect(sessionIdFrom(page.url())).not.toBe(sid);
  await expect(page.getByTestId("q-number")).toHaveText("1");
  await expect(page.getByRole("checkbox", { name: /circumference 3 cm larger/ })).toHaveAttribute("aria-checked", "false");

  // Home lists the retake for resume and the earlier attempt under previous results
  await page.goto("/");
  await expect(page.getByRole("link", { name: "Resume Examination" })).toBeVisible();
  await expect(page.getByRole("link", { name: "View results" }).first()).toBeVisible();
});

test("timer persists across reload and auto-submits on expiry", async ({ page }) => {
  await page.goto("/setup?mode=custom");
  await page.getByLabel(/Number of questions/).fill("5");
  await page.getByLabel("Time limit", { exact: true }).selectOption("60");
  await page.getByRole("button", { name: "Begin" }).click();
  await expect(page).toHaveURL(/\/exam\//);
  const sid = sessionIdFrom(page.url());
  await expect(page.getByTestId("timer")).toHaveText(/^(01:00|00:59)$/);

  // Simulate 58 minutes elapsed: remaining time must come from the stored deadline after reload
  await setDeadline(page, sid, Date.now() + 2 * 60 * 1000 - 500);
  await page.reload();
  await expect(page.getByTestId("timer")).toHaveText("00:02");

  // Expire
  await setDeadline(page, sid, Date.now() - 1000);
  await page.reload();
  await expect(page).toHaveURL(new RegExp(`/results/${sid}`), { timeout: 15_000 });
  await expect(page.getByText("Submitted automatically when time expired.")).toBeVisible();
});

test("practice mode gives immediate feedback; exam-style does not", async ({ page }) => {
  await startCase(page, /digoxin/, { feedback: true });
  await page.getByRole("checkbox", { name: /Yellow halos/ }).click();
  await page.getByRole("button", { name: "Submit answer" }).click();
  await expect(page.getByLabel("Answer feedback")).toBeVisible();
  await expect(page.getByText("Partially correct")).toBeVisible();
  // locked after checking
  await expect(page.getByRole("checkbox", { name: /Yellow halos/ })).toBeDisabled();

  await startCase(page, /digoxin/);
  await expect(page.getByRole("button", { name: "Submit answer" })).toHaveCount(0);
});

test("every question type renders and accepts input in a custom session", async ({ page }) => {
  await page.goto("/setup?mode=custom");
  await page.getByLabel(/Number of questions/).fill("44");
  await page.getByRole("button", { name: "Begin" }).click();
  await expect(page).toHaveURL(/\/exam\//);
  const total = Number(await page.getByTestId("q-total").textContent());
  expect(total).toBe(44);
  for (let i = 0; i < total; i++) {
    await expect(page.getByTestId("q-number")).toHaveText(String(i + 1));
    const main = page.locator("main");
    // interact with the first available control of whatever type is shown
    const radio = main.getByRole("radio").first();
    const box = main.getByRole("checkbox").first();
    const select = main.locator("select").first();
    const bowtieOption = main.locator('button[aria-pressed="false"]:enabled').first();
    if (await select.count()) await select.selectOption({ index: 1 });
    else if (await radio.count()) await radio.check();
    else if (await box.count()) await box.click();
    else await bowtieOption.click();
    if (i < total - 1) await page.getByRole("button", { name: "Next →" }).click();
  }
  await expect(page.getByText(`${total} of ${total} answered`).first()).toBeVisible();
});

test("admin area is protected on the server", async ({ page, request }) => {
  const api = await request.get("/api/admin/questions");
  expect(api.status()).toBe(401);
  const exp = await request.get("/api/admin/export");
  expect(exp.status()).toBe(401);

  await page.goto("/admin");
  await expect(page).toHaveURL(/\/admin\/login/);
  await page.getByLabel("Password").fill("wrong");
  await page.getByRole("button", { name: "Sign in" }).click();
  await expect(page.getByText("Incorrect password")).toBeVisible();
  await page.getByLabel("Password").fill("e2e-admin-password");
  await page.getByRole("button", { name: "Sign in" }).click();
  await expect(page.getByRole("heading", { name: "Question bank administration" })).toBeVisible();
  await expect(page.getByRole("link", { name: "vte-1" })).toBeVisible();
  await page.getByRole("link", { name: "vte-1" }).click();
  await expect(page.getByText("Schema validation passed.")).toBeVisible();
  await expect(page.getByText("Live preview")).toBeVisible();
});

test("fresh device shows no resume entry; expired sessions are submitted, not resumable", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByText("No completed sessions on this device yet.")).toBeVisible();
  await expect(page.getByRole("link", { name: "Resume Examination" })).toHaveCount(0);

  await startCase(page, /digoxin/);
  const sid = sessionIdFrom(page.url());
  await page.goto("/api/bank/stats"); // leave the exam page closed
  await setDeadline(page, sid, Date.now() - 60_000);
  await page.goto("/");
  await expect(page.getByRole("link", { name: "View results" })).toBeVisible();
  await expect(page.getByRole("link", { name: "Resume Examination" })).toHaveCount(0);
});
