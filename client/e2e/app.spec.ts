import { expect, test } from "@playwright/test";

test.describe.configure({ mode: "serial" });

test("catalog home: sample banner, auto-generated category tabs, kind filter", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByText("테스트용 샘플 데이터")).toBeVisible();
  const tabs = page.getByRole("tablist", { name: "카테고리" });
  await expect(tabs.getByRole("tab", { name: /침대/ })).toBeVisible();
  await expect(tabs.getByRole("tab", { name: /냉장고/ })).toBeVisible();

  await page.getByRole("button", { name: "프레임", exact: true }).click();
  await expect(page.getByRole("heading", { name: "[테스트] 포근 원목 저상 프레임" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "[테스트] 말랑 포켓스프링 매트리스" })).toHaveCount(0);

  await tabs.getByRole("tab", { name: /냉장고/ }).click();
  await expect(page.getByRole("heading", { name: "[테스트] 시원 4도어 냉장고" })).toBeVisible();
});

test("cards show option with price, stale/unknown prices are labelled", async ({ page }) => {
  await page.goto("/?category=beds");
  const pocket = page.getByRole("article").filter({ hasText: "말랑 포켓스프링" });
  await expect(pocket.getByText("890,000원")).toBeVisible();
  await expect(pocket.getByText("옵션: Q")).toBeVisible();
  await expect(page.getByRole("article").filter({ hasText: "말랑 하이브리드" }).getByText("가격 미확인")).toBeVisible();
  await expect(page.getByRole("article").filter({ hasText: "원목 저상" }).getByText("재확인 필요")).toBeVisible();
});

test("detail: per-option prices, reviews exclude sponsored posts, store relation", async ({ page }) => {
  await page.goto("/models/sample-malang-pocket");
  await expect(page.getByText("옵션 · K")).toBeVisible();
  await expect(page.getByText("과거 확인가").first()).toBeVisible();

  await page.getByRole("tab", { name: /내돈내산 후기/ }).click();
  await expect(page.getByText(/독립 후기 2건/)).toBeVisible();
  await expect(page.getByText("[테스트] 협찬 리뷰 예시")).toHaveCount(0);
  await page.getByRole("button", { name: /집계 제외 글 2건 보기/ }).click();
  await expect(page.getByText("[테스트] 협찬 리뷰 예시")).toBeVisible();

  await expect(page.getByText("이 모델 전시 확인", { exact: true })).toBeVisible();
  await expect(page.getByText("취급 매장 · 이 모델 전시 미확인")).toBeVisible();
});

test("stamps persist across reloads and show in the stampbook", async ({ page }) => {
  await page.goto("/models/sample-malang-pocket");
  await page.getByRole("button", { name: /체험 완료 도장/ }).click();
  await expect(page.getByText(/지금은 '체험 완료' 단계/)).toBeVisible();
  await page.reload();
  await expect(page.getByText(/지금은 '체험 완료' 단계/)).toBeVisible();

  await page.goto("/stamps");
  await expect(page.getByRole("link", { name: "[테스트] 말랑 포켓스프링 매트리스" })).toBeVisible();
  await expect(page.getByText("모은 도장")).toBeVisible();
});

test("compare: same category only, max 3", async ({ page }) => {
  await page.goto("/?category=beds");
  await page.getByRole("button", { name: "[테스트] 말랑 포켓스프링 매트리스 비교함에 담기" }).click();
  await page.getByRole("button", { name: "[테스트] 포근 원목 저상 프레임 비교함에 담기" }).click();
  await page.getByRole("link", { name: /비교/ }).click();
  await expect(page).toHaveURL(/\/compare/);
  await expect(page.getByText("가격 · K")).toBeVisible();
  await expect(page.getByRole("link", { name: "[테스트] 포근 원목 저상 프레임" })).toBeVisible();

  await page.goto("/?category=refrigerator");
  await page.getByRole("button", { name: "[테스트] 시원 4도어 냉장고 비교함에 담기" }).click();
  await expect(page.getByText("다른 카테고리라서 비교함을 새로 시작했어요")).toBeVisible();
});

test("map falls back to a list with external directions when no Kakao key", async ({ page }) => {
  await page.goto("/map");
  await expect(page.getByText(/지도 키\(/)).toBeVisible();
  const store = page.getByRole("article").filter({ hasText: "말랑침대 샘플 쇼룸" });
  await expect(store.getByRole("link", { name: /카카오 길찾기/ })).toBeVisible();
  await store.getByRole("button", { name: /방문 도장/ }).click();
  await expect(store.getByRole("button", { name: /방문 완료/ })).toBeVisible();
  await page.reload();
  await expect(page.getByRole("article").filter({ hasText: "말랑침대 샘플 쇼룸" }).getByRole("button", { name: /방문 완료/ })).toBeVisible();

  await page.getByRole("button", { name: "모델 전시가 확인된 매장만 보기" }).click();
  await expect(page.getByText("매장 1곳")).toBeVisible();
});

test("personal quote is saved separately and survives reload", async ({ page }) => {
  await page.goto("/models/sample-pogeun-wood");
  await page.getByPlaceholder("견적 금액 (원)").fill("410000");
  await page.getByPlaceholder("옵션 (예: Q)").fill("Q");
  await page.getByRole("button", { name: "견적 추가" }).click();
  await expect(page.getByText("내 기록을 저장했어요")).toBeVisible();
  await page.reload();
  await expect(page.getByText("410,000원")).toBeVisible();
  // the researched price table is unchanged
  await expect(page.getByText("옵션 · Q")).toBeVisible();
  await expect(page.getByText("450,000원").first()).toBeVisible();
});
