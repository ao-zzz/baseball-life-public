// Settings of the site itself (PROJECT_PLAN §11.23): who runs it and where feedback goes. Nothing here is filled in by the game:
// an empty value means "not set", and the pages say so instead of inventing it.

/**
 * The feedback form (Google Forms). To connect it:
 *  1. Make a form with a choice question (バグ／アイデア／その他) and a paragraph question; in the paragraph question set
 *     "回答の検証" → "長さ" → "最大文字数" to FEEDBACK_MAX_LENGTH (the form itself then refuses longer answers).
 *  2. Open "事前入力したURLを取得", fill both questions, and copy the link: it looks like
 *     https://docs.google.com/forms/d/e/<FORM_ID>/viewform?usp=pp_url&entry.111=...&entry.222=...
 *  3. Put the part before "?" into `formUrl`, and the two entry numbers into `categoryEntry` and `textEntry`.
 * Until then the feedback page says the form is not connected and offers no send button.
 */
export const FEEDBACK = {
  // Connected 2026-10-20 (read from the public form's structure: the choice question 種類/Category is entry.390606396, the paragraph
  // question 内容 / Details is entry.1460004378; the form is the one named ご意見・ご提案/Feedback&Suggestions)
  formUrl: 'https://docs.google.com/forms/d/e/1FAIpQLSc-miGdVr_VSTfKvsdPTzrNL-7MiPrlS-ZELORtARJEgX_4MA/viewform',
  categoryEntry: '390606396',
  textEntry: '1460004378',
}

export const FEEDBACK_MAX_LENGTH = 1000
/** exactly the choices of the form (a pre-filled choice that differs from them in a single character is dropped by Google) */
export const FEEDBACK_CATEGORIES = ['バグ / Bug', 'アイデア / Idea', 'その他 / Other'] as const

/**
 * The operator, for the page of 特定商取引法に基づく表記. The game sells nothing and shows no advertising now, so the page is a
 * template: fill these in only if that changes (and check with a professional whether the law applies).
 */
export const OPERATOR = {
  name: '',
  address: '',
  phone: '',
  email: '',
  /** set to true only once something is sold (a price, a subscription, paid items) */
  sells: false,
}

export type InfoPage = 'privacy' | 'guide' | 'legal' | 'feedback'
export const INFO_PAGES: { id: InfoPage; label: string }[] = [
  { id: 'privacy', label: 'プライバシーポリシー' },
  { id: 'guide', label: 'ご利用案内' },
  { id: 'legal', label: '特定商取引法に基づく表記' },
  { id: 'feedback', label: 'ご意見・ご提案' },
]

/** the text as it will be sent: a plain string, trimmed, without control characters, at most the limit (never markup) */
export function cleanFeedback(text: string): string {
  // eslint-disable-next-line no-control-regex
  return text.replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/g, '').trim().slice(0, FEEDBACK_MAX_LENGTH)
}

/** the link that opens the connected Google form with the answers filled in, or null when it is not connected */
export function feedbackLink(category: string, text: string): string | null {
  if (!FEEDBACK.formUrl || !FEEDBACK.categoryEntry || !FEEDBACK.textEntry) return null
  if (!/^https:\/\/docs\.google\.com\/forms\//.test(FEEDBACK.formUrl)) return null
  const q = new URLSearchParams({ usp: 'pp_url', [`entry.${FEEDBACK.categoryEntry}`]: category, [`entry.${FEEDBACK.textEntry}`]: cleanFeedback(text) })
  return `${FEEDBACK.formUrl}?${q.toString()}`
}

