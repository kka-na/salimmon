// Korean UI wording for enum values defined by the research contract.

import type { DisplayStatus, EntityStatus, Freshness, PriceKind, ProductKind, Stage, StoreRelation } from "./types";

export const PRODUCT_KIND: Record<ProductKind, string> = {
  mattress: "매트리스",
  bed_frame: "프레임",
  motion_bed: "모션베드",
  appliance: "가전",
  furniture: "가구",
  etc: "기타",
};

/** Display order for kind chips: mattress before frame, etc. last. */
export const PRODUCT_KIND_ORDER: ProductKind[] = ["mattress", "bed_frame", "motion_bed", "appliance", "furniture", "etc"];

export const PRICE_KIND: Record<PriceKind, string> = {
  official_list: "공식 정가",
  official_sale: "공식 할인가",
  user_reported_paid: "구매자 보고 실결제가",
  historical_official: "과거 공식가",
};

export const FRESHNESS: Record<Freshness, string> = {
  current: "확인가",
  stale: "재확인 필요",
  historical: "과거 확인가",
};

export const ENTITY_STATUS: Record<EntityStatus, string> = {
  verified: "검증 완료",
  partially_verified: "일부 검증",
  researching: "조사 중",
  archived: "보관됨",
};

export const DISPLAY_STATUS: Record<DisplayStatus, string> = {
  verified_on_display: "전시 확인",
  store_only_verified: "매장만 확인",
  unknown: "미확인",
};

export const STORE_RELATION: Record<StoreRelation, string> = {
  display_verified: "이 모델 전시 확인",
  display_unconfirmed: "전시 목록에 있으나 미확정",
  store_only: "취급 매장 · 이 모델 전시 미확인",
};

export const PURCHASE_EVIDENCE: Record<string, string> = {
  actual_use_claim: "실사용 진술",
  purchase_only: "구매·계약 진술만",
  purchase_proof_shown: "구매 인증 자료 있음",
  unknown: "구매·사용 진술 불명",
};

export const SPONSORSHIP: Record<string, string> = {
  confirmed_uncompensated: "무보상 확인",
  sponsored_or_provided: "협찬·제공",
  unknown: "협찬 여부 불명",
};

export const SENTIMENT: Record<string, string> = {
  positive: "긍정",
  negative: "부정",
  mixed: "혼합",
};

export const EXCLUSION_REASON: Record<string, string> = {
  sponsored: "협찬·제공 글",
  incentivized: "보상·이벤트 조건 고지",
  no_source_url: "원문 URL 없음",
  no_posted_at: "게시일 없음",
  no_use_or_purchase_claim: "구매·사용 진술 확인 불가",
  source_not_read: "원문 미열람 (검색 요약만 확인)",
  purchase_only_grade: "구매만·배송 대기 (D등급)",
  community_opinion: "질문·체험·비교 의견 (E등급)",
};

/** 후기_검색범위_판정규칙.md §4 */
export const EVIDENCE_GRADE: Record<string, string> = {
  A: "A · 구매 증빙 확인",
  B: "B · 장기 실사용",
  C: "C · 단기 실사용",
  D: "D · 구매만/배송 대기",
  E: "E · 커뮤니티 의견",
  X: "X · 협찬·제공",
};

export const PLATFORM: Record<string, string> = {
  dcinside: "디시인사이드",
  theqoo: "더쿠",
  blind: "블라인드",
  threads: "Threads",
  instagram: "인스타그램",
  naver_cafe: "네이버 카페",
  naver_blog: "네이버 블로그",
  clien: "클리앙",
  ppomppu: "뽐뿌",
  ruliweb: "루리웹",
  reddit: "레딧",
  danawa: "다나와",
  ohou: "오늘의집",
  coupang: "쿠팡",
  youtube: "유튜브",
};

export const CONTENT_ACCESS: Record<string, string> = {
  full: "원문 열람",
  snippet_only: "검색 요약만",
  inaccessible: "원문 접근 불가",
};

export const INCENTIVE_CHECK: Record<string, string> = {
  no_disclosure_found: "협찬 고지 발견 안 됨",
  disclosed: "보상 고지 있음",
  unknown: "보상 여부 미점검",
};

export const REVIEW_BUCKET: Record<string, string> = {
  experience: "독립 사용 후기",
  purchase_reference: "구매가·구매결정 참고",
  community: "커뮤니티 의견",
  excluded: "집계 제외",
};

export const SOURCE_TYPE: Record<string, string> = {
  official: "공식",
  independent_user: "독립 사용자",
  seller: "판매자",
  media: "언론·매체",
  unknown: "출처 유형 미분류",
};

export const STAGES: Stage[] = ["wishlist", "planned", "tried", "finalist", "purchased"];

export const STAGE: Record<Stage, { label: string; short: string; emoji: string }> = {
  wishlist: { label: "찜", short: "찜", emoji: "💗" },
  planned: { label: "체험 예정", short: "예정", emoji: "🗓️" },
  tried: { label: "체험 완료", short: "체험", emoji: "🛌" },
  finalist: { label: "최종 후보", short: "후보", emoji: "⭐" },
  purchased: { label: "구매 완료", short: "구매", emoji: "🎉" },
};

export const LINK_STATUS: Record<string, string> = {
  ok: "링크 정상",
  dead: "링크 끊김",
  error: "링크 확인 실패",
  unchecked: "링크 미점검",
  none: "",
};
