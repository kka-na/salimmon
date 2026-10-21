// Shapes returned by the FastAPI server (server/app/catalog.py, server/app/api/*).

export type ProductKind = "mattress" | "bed_frame" | "motion_bed" | "appliance" | "furniture" | "etc";
export type EntityStatus = "verified" | "partially_verified" | "researching" | "archived";
export type PriceKind = "official_list" | "official_sale" | "user_reported_paid" | "historical_official";
export type Freshness = "current" | "stale" | "historical";
export type LinkStatus = "ok" | "dead" | "error" | "unchecked" | "none";
export type DisplayStatus = "verified_on_display" | "store_only_verified" | "unknown";
export type StoreRelation = "display_verified" | "display_unconfirmed" | "store_only";
export type Stage = "wishlist" | "planned" | "tried" | "finalist" | "purchased";

export interface LinkInfo {
  link_status: LinkStatus;
  link_checked_at: string | null;
}

export interface Source extends LinkInfo {
  url: string;
  source_type: string;
  title: string | null;
  checked_at: string | null;
}

export interface Claim extends LinkInfo {
  text: string;
  source_url: string | null;
  source_type: string | null;
  checked_at: string | null;
}

export interface ImageView {
  display_url: string | null;
  image_source_url: string | null;
  alt: string;
  rights_status: "permitted" | "official_embed" | "unknown";
  placeholder_reason: "no_image" | "rights_unknown" | null;
  /** Official-page og:image, hotlinked (not stored) — only when the server enables previews. */
  preview_url?: string | null;
  preview_page_url?: string | null;
}

export interface PriceView extends LinkInfo {
  amount_krw: number;
  size_or_option: string;
  price_kind: PriceKind;
  observed_at: string;
  source_url: string;
  source_type: string | null;
  note: string | null;
  age_days: number;
  freshness: Freshness;
  option_count?: number;
}

export interface ReviewStats {
  total: number;
  independent: number;
  excluded: number;
  positive: number;
  negative: number;
  mixed: number;
  purchase_proof: number;
}

export interface Category {
  id: string;
  name: string;
  emoji: string | null;
  sort_order: number;
  description: string | null;
  status: EntityStatus;
  updated_at: string;
  is_sample: boolean;
  counts: { models: number; brands: number; stores: number; reviews: number };
  product_kinds: ProductKind[];
}

export interface Brand {
  id: string;
  name: string;
  name_en: string | null;
  official_url: string | null;
  category_ids: string[];
  status: EntityStatus;
  updated_at: string;
  is_sample: boolean;
  model_count: number;
}

export interface BrandDetail extends Brand {
  sources: Source[];
  body_md: string;
  models: ModelSummary[];
}

export interface ModelSummary {
  id: string;
  category_id: string;
  brand_id: string;
  brand_name: string | null;
  name: string;
  model_code: string | null;
  product_kind: ProductKind;
  status: EntityStatus;
  updated_at: string;
  last_verified_at: string | null;
  image: ImageView;
  representative_price: PriceView | null;
  top_pro: string | null;
  top_con: string | null;
  review_stats: ReviewStats;
  display_store_count: number;
  store_count: number;
  is_sample: boolean;
  my_stage?: Stage | null;
}

export interface SpecRow {
  key: string;
  label: string;
  unit: string | null;
  value: unknown;
  value_label: string | null;
}

export interface Review extends LinkInfo {
  id: string;
  category_id: string;
  brand_id: string | null;
  brand_name: string | null;
  model_id: string | null;
  model_name: string | null;
  title: string | null;
  source_name: string | null;
  source_url: string | null;
  posted_at: string | null;
  usage_duration: string | null;
  purchase_evidence_level: "actual_use_claim" | "purchase_only" | "purchase_proof_shown" | "unknown";
  sponsorship_status: "confirmed_uncompensated" | "sponsored_or_provided" | "unknown";
  review_sentiment: "positive" | "negative" | "mixed";
  status: EntityStatus;
  updated_at: string;
  is_independent: boolean;
  exclusion_reasons: string[];
  bucket: "experience" | "purchase_reference" | "community" | "excluded";
  platform: string | null;
  content_access: "full" | "snippet_only" | "inaccessible" | null;
  review_scope: string | null;
  review_evidence_grade: "A" | "B" | "C" | "D" | "E" | "X" | null;
  in_period: boolean | null;
  incentive_check: "no_disclosure_found" | "disclosed" | "unknown" | null;
  duplicate_group: string | null;
  is_sample: boolean;
  body_md?: string;
}

export interface StoreSummary {
  id: string;
  name: string;
  brand_ids: string[];
  brands: { id: string; name: string }[];
  category_ids: string[];
  address: string | null;
  lat: number | null;
  lng: number | null;
  has_verified_coords: boolean;
  phone: string | null;
  hours: string | null;
  official_store_url: string | null;
  map_url: string | null;
  display_status: DisplayStatus;
  verified_at: string | null;
  models_on_display: { id: string; name: string; product_kind: ProductKind }[];
  status: EntityStatus;
  updated_at: string;
  is_sample: boolean;
  sources: Source[];
  visited?: boolean;
  relation?: StoreRelation;
}

export interface StoreDetail extends StoreSummary {
  body_md: string;
  linked_models: { id: string; name: string }[];
}

export interface Compatibility {
  model_id: string;
  name: string;
  product_kind: ProductKind;
  brand_name: string | null;
  sizes: string[];
  source_url: string;
  verified_at: string | null;
  note: string | null;
}

export interface ModelDetail extends ModelSummary {
  category_name: string | null;
  brand: { id: string; name: string; name_en: string | null; official_url: string | null } | null;
  gallery: ImageView[];
  specs: SpecRow[];
  price_table: { size_or_option: string; records: PriceView[] }[];
  pros: Claim[];
  cons: Claim[];
  warranty_summary: string | null;
  warranty_source_url: string | null;
  warranty_link: LinkInfo;
  sources: Source[];
  reviews: Review[];
  brand_reviews: Review[];
  stores: StoreSummary[];
  compatibility: Compatibility[];
  body_md: string;
  source_path: string;
}

export interface CompareResponse {
  category_id: string | null;
  models: ModelDetail[];
  missing_ids: string[];
  spec_keys: { key: string; label: string; unit: string | null }[];
  price_options: string[];
}

export interface Issue {
  severity: "error" | "warning" | "info";
  path: string;
  field: string;
  message: string;
  entity_id: string | null;
}

export interface ValidationReport {
  research_dir: string;
  loaded_at: string;
  files_scanned: number;
  counts: Record<string, number>;
  summary: { error: number; warning: number; info: number };
  issues: Issue[];
}

export interface Health {
  status: string;
  today: string;
  research: {
    dir: string;
    loaded_at: string;
    counts: Record<string, number>;
    issues: { error: number; warning: number; info: number };
    has_sample_data: boolean;
  };
  stale_price_days: number;
}

export interface ResearchReport {
  category: {
    id: string;
    name: string;
    emoji: string | null;
    status: EntityStatus;
    updated_at: string;
    is_sample: boolean;
    body_md: string;
  };
  brands: { id: string; name: string; status: EntityStatus; updated_at: string; body_md: string }[];
  models: { id: string; name: string; brand_id: string; product_kind: ProductKind; status: EntityStatus }[];
  issues: Issue[];
}

export interface Stamp {
  stage: Stage;
  reached: boolean;
  stamped_at: string | null;
}

export interface ProgressModel {
  model_id: string;
  stage: Stage;
  stage_index: number;
  updated_at: string;
  stamps: Stamp[];
  orphaned: boolean;
  model_name: string | null;
  brand_name: string | null;
  category_id: string | null;
  product_kind: ProductKind | null;
}

export interface ProgressStore {
  store_id: string;
  visited_on: string | null;
  created_at: string;
  orphaned: boolean;
  store_name: string | null;
  category_ids: string[];
}

export interface ProgressEvent {
  id: number;
  target_type: "model" | "store";
  target_id: string;
  stage: Stage | "visited" | "cleared";
  created_at: string;
  target_name: string | null;
}

export interface Progress {
  stages: Stage[];
  models: ProgressModel[];
  stores: ProgressStore[];
  events: ProgressEvent[];
}

export interface Quote {
  id?: number;
  amount_krw: number;
  size_or_option: string;
  quoted_on: string | null;
  place: string;
  note: string;
}

export interface PersonalNote {
  model_id: string;
  model_name: string | null;
  category_id: string | null;
  orphaned: boolean;
  memo: string;
  feel_note: string;
  rating: number | null;
  updated_at: string | null;
  quotes: Quote[];
}
