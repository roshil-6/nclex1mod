import { expect, type Page } from "@playwright/test";

export async function startCase(page: Page, caseLabel: RegExp, opts: { feedback?: boolean } = {}) {
  await page.goto("/setup?mode=case");
  await page.getByLabel("Case study", { exact: true }).selectOption({ label: (await optionLabel(page, caseLabel))! });
  if (opts.feedback) await page.getByLabel(/Immediate feedback/).check();
  await page.getByRole("button", { name: "Begin" }).click();
  await expect(page).toHaveURL(/\/exam\//);
  await expect(page.getByTestId("q-number")).toHaveText("1");
}

async function optionLabel(page: Page, re: RegExp) {
  const labels = await page.getByLabel("Case study", { exact: true }).locator("option").allTextContents();
  return labels.find((l) => re.test(l));
}

/** Mutate the persisted session in IndexedDB (simulates elapsed time). */
export async function setDeadline(page: Page, sessionId: string, deadline: number) {
  await page.evaluate(
    async ({ id, deadline }) => {
      const db: IDBDatabase = await new Promise((res, rej) => {
        const r = indexedDB.open("clinical-mock-exam");
        r.onsuccess = () => res(r.result);
        r.onerror = () => rej(r.error);
      });
      const tx = db.transaction("sessions", "readwrite");
      const store = tx.objectStore("sessions");
      const s = await new Promise<Record<string, unknown>>((res) => {
        const g = store.get(id);
        g.onsuccess = () => res(g.result);
      });
      s.deadline = deadline;
      store.put(s, id);
      await new Promise((res) => (tx.oncomplete = res));
    },
    { id: sessionId, deadline },
  );
}

export const sessionIdFrom = (url: string) => url.split("/").pop()!;
