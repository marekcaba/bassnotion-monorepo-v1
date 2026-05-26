import { FounderCardConfig } from '@bassnotion/contracts';
import { renderBoldMarkers } from './markdown-bold';

interface FounderCardProps {
  config: FounderCardConfig;
  claimed: number;
  total: number;
  onCtaClick?: () => void;
  ctaDisabled?: boolean;
}

/**
 * Pure presentational founder upsell card. Renders the exact same DOM
 * shape, classes, and animations as the inline version we used to ship in
 * page.tsx — extracted so the homepage and the /admin/founder-card live
 * preview render from a single source of truth.
 *
 * `config` drives every string and per-block font size. `claimed`/`total`
 * drive the progress bar. CTA wiring is handler-injected so the
 * homepage's real Stripe redirect lives in the parent while the admin
 * preview can pass a no-op.
 */
export function FounderCard({
  config,
  claimed,
  total,
  onCtaClick,
  ctaDisabled = false,
}: FounderCardProps) {
  const spotsPct = Math.min(100, Math.round((claimed / total) * 100));
  const claimedSuffix = config.progressClaimedSuffix.replace(
    '{total}',
    String(total),
  );
  const closesLabel = config.progressClosesLabel.replace(
    '{total}',
    String(total),
  );

  return (
    <div
      className="relative rounded-[18px] border-[1.5px] border-[rgba(242,107,29,0.35)] p-6 text-center overflow-hidden"
      style={{
        background:
          'linear-gradient(160deg, rgba(242,107,29,0.09), rgba(242,107,29,0.02))',
      }}
    >
      {/* corner glow */}
      <div
        aria-hidden="true"
        className="absolute -top-[40%] -right-[10%] w-[200px] h-[200px] rounded-full pointer-events-none"
        style={{
          background:
            'radial-gradient(circle, rgba(242,107,29,0.18), transparent 70%)',
        }}
      />

      <div className="relative">
        {/* 1. Eyebrow */}
        <span
          className="inline-block font-extrabold tracking-[0.14em] uppercase text-[#F26B1D] bg-[rgba(242,107,29,0.12)] border border-[rgba(242,107,29,0.3)] rounded-full px-3 py-1.5 mb-4"
          style={{ fontSize: `${config.eyebrowSizePx}px` }}
        >
          {config.eyebrowText}
        </span>

        {/* 2. Headline + italic subhead */}
        <h3
          className="font-heading uppercase leading-none"
          style={{ fontSize: `${config.headlineSizePx}px` }}
        >
          {config.headlinePrefix}{' '}
          <span className="text-[#F26B1D]">{config.headlineAccent}</span>
        </h3>
        <p
          className="italic text-[#F5F1EB] mt-3 leading-snug max-w-[28em] mx-auto"
          style={{ fontSize: `${config.subheadSizePx}px` }}
        >
          {config.subheadText}
        </p>

        {/* 3. Vision line */}
        <p
          className="text-[#9A948C] max-w-[30em] mt-5 mx-auto leading-[1.55]"
          style={{ fontSize: `${config.visionSizePx}px` }}
        >
          {renderBoldMarkers(config.visionText)}
        </p>

        {/* 4. Three benefit bullets */}
        <ul className="list-none text-left max-w-[340px] mx-auto mt-5 space-y-2.5">
          {[
            { lead: config.bullet1Lead, body: config.bullet1Body },
            { lead: config.bullet2Lead, body: config.bullet2Body },
            { lead: config.bullet3Lead, body: config.bullet3Body },
          ].map((bullet, i) => (
            <li
              key={i}
              className="text-[#9A948C] flex gap-2.5 items-start"
              style={{ fontSize: `${config.bulletsSizePx}px` }}
            >
              <svg
                width="16"
                height="16"
                viewBox="0 0 24 24"
                fill="none"
                stroke="#F26B1D"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                className="flex-none mt-0.5"
                aria-hidden="true"
              >
                <polyline points="20 6 9 17 4 12" />
              </svg>
              <span>
                <b className="font-bold text-[#F5F1EB]">{bullet.lead}</b>{' '}
                {bullet.body}
              </span>
            </li>
          ))}
        </ul>

        {/* 5. Price block */}
        <div className="mt-6">
          <p
            className="text-[#F5F1EB] font-bold leading-none"
            style={{ fontSize: `${config.priceHeadlineSizePx}px` }}
          >
            {config.priceHeadline}
          </p>
          <p
            className="text-[#9A948C] mt-2 max-w-[28em] mx-auto leading-[1.55]"
            style={{ fontSize: `${config.priceCaptionSizePx}px` }}
          >
            {config.priceCaption}
          </p>
        </div>

        {/* 6. Spots progress */}
        <div className="mt-5 bg-black/25 border border-[rgba(242,107,29,0.18)] rounded-xl px-4 py-3.5">
          <div className="flex justify-between items-baseline text-[12.5px]">
            <span className="text-[#9A948C] font-medium">
              <b className="text-[#F5F1EB] font-extrabold">{claimed}</b>{' '}
              {claimedSuffix}
            </span>
            <span className="text-[#F26B1D] font-extrabold">{closesLabel}</span>
          </div>
          <div className="h-[7px] bg-[#221D18] rounded-md mt-2.5 overflow-hidden">
            <div
              className="h-full rounded-md transition-[width] duration-[1400ms] ease-[cubic-bezier(.2,.8,.2,1)]"
              style={{
                width: `${spotsPct}%`,
                background: 'linear-gradient(90deg, #C4530F, #FF7A22)',
              }}
            />
          </div>
        </div>

        {/* 7. Objection handler */}
        <div className="mt-5 bg-black/20 border border-[#26221E] rounded-xl px-4 py-3.5 text-left">
          <p
            className="text-[#F5F1EB] leading-[1.6]"
            style={{ fontSize: `${config.objectionSizePx}px` }}
          >
            <b className="font-semibold">{config.objectionLead}</b>{' '}
            <span className="text-[#9A948C]">
              {renderBoldMarkers(config.objectionBody)}
            </span>
          </p>
        </div>

        {/* 8. CTA button */}
        <button
          type="button"
          onClick={onCtaClick}
          disabled={ctaDisabled || !onCtaClick}
          className="w-full mt-5 bg-gradient-to-b from-[#FF7A22] to-[#C4530F] text-[#1A0D04] font-extrabold text-[17px] px-6 py-[18px] rounded-[13px] cursor-pointer border-none shadow-[0_14px_34px_-12px_rgba(242,107,29,0.6)] hover:-translate-y-0.5 hover:shadow-[0_20px_44px_-12px_rgba(242,107,29,0.7)] active:translate-y-0 transition-[transform,box-shadow] duration-200 disabled:opacity-70 leading-tight"
        >
          {config.ctaPrimary}
          <span className="block text-xs font-semibold text-[rgba(26,13,4,0.7)] mt-1">
            {config.ctaSecondary}
          </span>
        </button>
      </div>
    </div>
  );
}
