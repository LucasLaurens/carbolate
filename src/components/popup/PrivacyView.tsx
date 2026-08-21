import { PRIVACY_POLICY } from "../../legal/privacy";
import type { Language } from "../../i18n/types";

type Props = { language: Language };

/**
 * The policy inside the product, because Chrome requires the disclosure to be in
 * the extension's UI and not only behind the store's privacy-policy link.
 *
 * One collapsed `<details>` per section: ten sections of prose would bury the
 * panel, while ten headings fit a 320px column and let a reader open only the
 * question they came with.
 */
export default function PrivacyView({ language }: Props) {
  const policy = PRIVACY_POLICY[language];

  return (
    <div className="flex flex-col gap-3">
      <div>
        <h2 className="text-[10px] font-semibold text-stone-400 uppercase tracking-widest">
          {policy.title}
        </h2>
        <p className="mt-1 text-[11px] text-stone-400">{policy.effective}</p>
      </div>

      <div className="flex flex-col divide-y divide-stone-200 border-y border-stone-200">
        {policy.sections.map((section) => (
          <details key={section.heading} className="group py-2.5">
            <summary className="flex items-start gap-1.5 text-xs font-medium text-stone-600 cursor-pointer list-none marker:content-none hover:text-stone-800">
              <span className="inline-block mt-px transition-transform group-open:rotate-90">
                &#9656;
              </span>
              <span>{section.heading}</span>
            </summary>
            <div className="mt-2 pl-4 flex flex-col gap-2 text-xs leading-relaxed text-stone-500">
              {section.paragraphs.map((paragraph) => (
                <p key={paragraph}>{paragraph}</p>
              ))}
            </div>
          </details>
        ))}
      </div>
    </div>
  );
}
