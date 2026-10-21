"use client";

import { Plus, Star, Trash2 } from "lucide-react";
import { useState } from "react";
import useSWR from "swr";

import { apiSend } from "@/lib/api";
import { formatDate, formatKRW, todayISO } from "@/lib/format";
import type { PersonalNote, Quote } from "@/lib/types";
import { toast } from "./toast";
import { cx } from "./ui";

const EMPTY_QUOTE: Quote = { amount_krw: 0, size_or_option: "", quoted_on: null, place: "", note: "" };

/** Personal memo, 체험 느낌, rating and received quotes. Stored apart from researched prices. */
export function NoteForm({ modelId }: { modelId: string }) {
  const key = `/api/personal-notes?model_id=${encodeURIComponent(modelId)}`;
  const { data, mutate, error } = useSWR<{ items: PersonalNote[] }>(key);
  if (error) return <p className="text-sm text-stamp">내 기록을 불러오지 못했어요: {String(error.message ?? error)}</p>;
  if (!data) return <p className="text-sm text-ink-faint">내 기록 불러오는 중…</p>;
  // Keyed so the editor is seeded once from the saved note.
  return <NoteEditor key={modelId} modelId={modelId} initial={data.items[0]} onSaved={(saved) => mutate({ items: [saved] }, { revalidate: false })} />;
}

function NoteEditor({ modelId, initial, onSaved }: { modelId: string; initial: PersonalNote | undefined; onSaved: (n: PersonalNote) => void }) {
  const [memo, setMemo] = useState(initial?.memo ?? "");
  const [feel, setFeel] = useState(initial?.feel_note ?? "");
  const [rating, setRating] = useState<number | null>(initial?.rating ?? null);
  const [quotes, setQuotes] = useState<Quote[]>(initial?.quotes ?? []);
  const [draft, setDraft] = useState<Quote>({ ...EMPTY_QUOTE, quoted_on: todayISO() });
  const [saving, setSaving] = useState(false);
  const [dirty, setDirty] = useState(false);

  const save = async (nextQuotes = quotes) => {
    setSaving(true);
    try {
      const saved = await apiSend<PersonalNote>("/api/personal-notes", {
        model_id: modelId,
        memo,
        feel_note: feel,
        rating,
        quotes: nextQuotes.map(({ amount_krw, size_or_option, quoted_on, place, note }) => ({ amount_krw, size_or_option, quoted_on, place, note })),
      });
      onSaved(saved);
      setDirty(false);
      toast("내 기록을 저장했어요 📝");
    } catch (e) {
      toast(`저장 실패: ${e instanceof Error ? e.message : e}`);
    } finally {
      setSaving(false);
    }
  };

  const addQuote = () => {
    if (!draft.amount_krw || draft.amount_krw <= 0) {
      toast("견적 금액을 숫자로 입력해 주세요");
      return;
    }
    const next = [draft, ...quotes];
    setQuotes(next);
    setDraft({ ...EMPTY_QUOTE, quoted_on: todayISO() });
    void save(next);
  };

  const removeQuote = (idx: number) => {
    const next = quotes.filter((_, i) => i !== idx);
    setQuotes(next);
    void save(next);
  };

  const input = "w-full rounded-xl border-2 border-line bg-card px-3 py-2 text-sm placeholder:text-ink-faint";

  return (
    <div className="space-y-4">
      <fieldset>
        <legend className="mb-1 text-xs font-bold text-ink-soft">직접 누워본 느낌 · 내 평점</legend>
        <div className="mb-2 flex items-center gap-1" role="radiogroup" aria-label="내 평점">
          {[1, 2, 3, 4, 5].map((n) => (
            <button
              key={n}
              type="button"
              role="radio"
              aria-checked={rating === n}
              aria-label={`${n}점`}
              onClick={() => {
                setRating(rating === n ? null : n);
                setDirty(true);
              }}
              className="p-0.5"
            >
              <Star aria-hidden className={cx("h-7 w-7", rating && n <= rating ? "fill-[#ffc94d] text-[#e6a817]" : "text-line-strong")} />
            </button>
          ))}
          <span className="ml-1 text-xs text-ink-faint">{rating ? `${rating}점` : "평점 없음"}</span>
        </div>
        <textarea
          value={feel}
          onChange={(e) => {
            setFeel(e.target.value);
            setDirty(true);
          }}
          rows={2}
          placeholder="예) 허리가 받쳐지는 느낌, 옆으로 누우면 어깨가 살짝 눌림"
          aria-label="체험 느낌"
          className={input}
        />
      </fieldset>

      <label className="block">
        <span className="mb-1 block text-xs font-bold text-ink-soft">메모</span>
        <textarea
          value={memo}
          onChange={(e) => {
            setMemo(e.target.value);
            setDirty(true);
          }}
          rows={2}
          placeholder="예) 매장 직원에게 Q 사이즈 전시 여부 다시 묻기"
          className={input}
        />
      </label>

      <button
        type="button"
        onClick={() => save()}
        disabled={saving}
        className="w-full rounded-2xl border-2 border-ink bg-ink py-2.5 text-sm font-bold text-paper shadow-sticker-sm active:translate-y-px disabled:opacity-60"
      >
        {saving ? "저장 중…" : dirty ? "메모·평점 저장" : "저장됨"}
      </button>

      <div>
        <p className="mb-1 text-xs font-bold text-ink-soft">내가 받은 견적</p>
        <p className="mb-2 text-[11px] leading-snug text-ink-faint">조사된 공식 가격과 섞이지 않고, 이 기기·서버에만 개인 기록으로 저장돼요.</p>
        <div className="grid grid-cols-2 gap-2 rounded-2xl border-2 border-dashed border-line-strong p-2.5">
          <label className="col-span-2">
            <span className="sr-only">견적 금액(원)</span>
            <input
              inputMode="numeric"
              value={draft.amount_krw ? draft.amount_krw.toLocaleString("ko-KR") : ""}
              onChange={(e) => setDraft({ ...draft, amount_krw: Number(e.target.value.replace(/[^\d]/g, "")) || 0 })}
              placeholder="견적 금액 (원)"
              className={input}
            />
          </label>
          <label>
            <span className="sr-only">옵션·사이즈</span>
            <input value={draft.size_or_option} onChange={(e) => setDraft({ ...draft, size_or_option: e.target.value })} placeholder="옵션 (예: Q)" className={input} />
          </label>
          <label>
            <span className="sr-only">견적 날짜</span>
            <input type="date" value={draft.quoted_on ?? ""} onChange={(e) => setDraft({ ...draft, quoted_on: e.target.value || null })} className={input} />
          </label>
          <label className="col-span-2">
            <span className="sr-only">받은 곳</span>
            <input value={draft.place} onChange={(e) => setDraft({ ...draft, place: e.target.value })} placeholder="받은 곳 (매장·온라인)" className={input} />
          </label>
          <label className="col-span-2">
            <span className="sr-only">조건 메모</span>
            <input value={draft.note} onChange={(e) => setDraft({ ...draft, note: e.target.value })} placeholder="조건 메모 (사은품, 배송비 등)" className={input} />
          </label>
          <button
            type="button"
            onClick={addQuote}
            disabled={saving}
            className="col-span-2 inline-flex items-center justify-center gap-1 rounded-xl border-2 border-line-strong bg-butter py-2 text-sm font-bold active:translate-y-px disabled:opacity-60"
          >
            <Plus aria-hidden className="h-4 w-4" /> 견적 추가
          </button>
        </div>
        {quotes.length > 0 && (
          <ul className="mt-2 space-y-2">
            {quotes.map((q, i) => (
              <li key={q.id ?? `new-${i}`} className="flex items-start gap-2 rounded-2xl border-2 border-line bg-card px-3 py-2">
                <div className="min-w-0 flex-1">
                  <p className="font-extrabold">
                    {formatKRW(q.amount_krw)} <span className="text-xs font-semibold text-ink-soft">{q.size_or_option || "옵션 미기재"}</span>
                  </p>
                  <p className="text-[11px] text-ink-soft">
                    {q.quoted_on ? formatDate(q.quoted_on) : "날짜 없음"}
                    {q.place && ` · ${q.place}`}
                  </p>
                  {q.note && <p className="text-[11px] text-ink-faint">{q.note}</p>}
                </div>
                <button type="button" onClick={() => removeQuote(i)} aria-label="견적 삭제" className="rounded-full p-1.5 text-ink-faint hover:text-stamp">
                  <Trash2 aria-hidden className="h-4 w-4" />
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
