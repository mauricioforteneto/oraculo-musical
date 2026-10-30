import { expect, test } from "@playwright/test";

test("tema segue o sistema; escolha explícita persiste e volta ao modo automático", async ({ page }) => {
  await page.emulateMedia({ colorScheme: "dark" });
  await page.goto("/login");
  const root = page.locator("html");
  const theme = page.getByLabel("Tema", { exact: true });
  await expect(theme).toHaveValue("system");
  await expect(root).toHaveAttribute("data-mode", "dark");
  await theme.selectOption("light");
  await expect(root).toHaveAttribute("data-mode", "light");
  await page.reload();
  await expect(root).toHaveAttribute("data-mode", "light");
  await expect(theme).toHaveValue("light");
  await theme.selectOption("dark");
  await page.emulateMedia({ colorScheme: "light" });
  await expect(root).toHaveAttribute("data-mode", "dark");
  await page.reload();
  await expect(theme).toHaveValue("dark");
  await theme.selectOption("system");
  await expect(root).toHaveAttribute("data-mode", "light");
  await page.emulateMedia({ colorScheme: "dark" });
  await expect(root).toHaveAttribute("data-mode", "dark");
});

test("preferência de tema acompanha outra aba", async ({ context, page }) => {
  await page.goto("/login");
  const other = await context.newPage();
  await other.goto("/login");
  await page.getByLabel("Tema", { exact: true }).selectOption("dark");
  await expect(other.getByLabel("Tema", { exact: true })).toHaveValue("dark");
  await expect(other.locator("html")).toHaveAttribute("data-mode", "dark");
  await other.getByLabel("Tema", { exact: true }).selectOption("light");
  await expect(page.locator("html")).toHaveAttribute("data-mode", "light");
});

test("armazenamento bloqueado mantém tema utilizável e informa que não foi salvo", async ({ page }) => {
  await page.addInitScript(() => {
    Object.defineProperty(Storage.prototype, "getItem", { value: () => { throw new DOMException("Blocked", "SecurityError"); } });
    Object.defineProperty(Storage.prototype, "setItem", { value: () => { throw new DOMException("Blocked", "SecurityError"); } });
  });
  await page.emulateMedia({ colorScheme: "light" });
  await page.goto("/login");
  await expect(page.locator("html")).toHaveAttribute("data-mode", "light");
  await page.getByLabel("Tema", { exact: true }).selectOption("dark");
  await expect(page.locator("html")).toHaveAttribute("data-mode", "dark");
  await expect(page.getByRole("status").filter({ hasText: "Tema aplicado nesta página" })).toContainText("não permitiu salvar");
});

test("sem JavaScript, o tema ainda segue a preferência do sistema", async ({ browser }) => {
  const context = await browser.newContext({ javaScriptEnabled: false, colorScheme: "dark" });
  const page = await context.newPage();
  await page.goto("http://localhost:3100/login");
  expect(await page.locator("html").evaluate(element => getComputedStyle(element).colorScheme)).toBe("dark");
  await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
  await context.close();
});
