import { useMemo, useState } from 'react'

import wordmark from './assets/velve-wordmark.png'

type Locale = 'sr' | 'en' | 'ru'

const copy = {
  sr: {
    eyebrow: 'Alt fashion identity',
    script: 'for closet romantics',
    title: 'Velve je cisto promotivni prozor u modni svet koji gradimo.',
    description:
      'Ovaj sajt nije aplikacija i ne glumi product dashboard. On samo prenosi ton, estetiku i energiju Velve identiteta dok je glavna scena rezervisana za mobile iskustvo.',
    primary: 'mobile app uskoro',
    secondary: 'promo-only web',
    manifestoTitle: 'Nije resale sajt sa lepom paletom.',
    manifestoText:
      'Velve gradimo kao image-first, identity-led garderoba mrezu u kojoj discovery, razmena i licni stil deluju kao ista scena.',
    cards: [
      {
        index: '01',
        title: 'Image-first world',
        text: 'Fotografija vodi kadar, a interfejs ostaje tih i editorial.',
      },
      {
        index: '02',
        title: 'Trade as culture',
        text: 'Razmena je drustveni ritual, ne suva transakcija bez karaktera.',
      },
      {
        index: '03',
        title: 'Style identity',
        text: 'Profil izgleda kao licni modni prostor, a ne kao settings panel.',
      },
    ],
    band: ['neo-y2k', 'soft glass', 'deep velvet', 'serbia / english / russian'],
    footer:
      'Velve web ostaje namerno promotivan. Cela funkcionalna tezina proizvoda zivi u mobile aplikaciji.',
  },
  en: {
    eyebrow: 'Alt fashion identity',
    script: 'for closet romantics',
    title: 'Velve is a purely promotional window into the fashion world we are building.',
    description:
      'This website is not the app and it does not pretend to be a product dashboard. It only carries the tone, the aesthetic, and the energy of the Velve identity while the main stage stays inside the mobile experience.',
    primary: 'mobile app soon',
    secondary: 'promo-only web',
    manifestoTitle: 'Not a resale site with a prettier palette.',
    manifestoText:
      'Velve is being shaped as an image-first, identity-led wardrobe network where discovery, swapping, and personal style feel like the same scene.',
    cards: [
      {
        index: '01',
        title: 'Image-first world',
        text: 'Photography leads the frame while the interface stays quiet and editorial.',
      },
      {
        index: '02',
        title: 'Trade as culture',
        text: 'Swapping should feel like a social ritual, not a dry transaction.',
      },
      {
        index: '03',
        title: 'Style identity',
        text: 'Profiles should read like personal fashion spaces, not settings panels.',
      },
    ],
    band: ['neo-y2k', 'soft glass', 'deep velvet', 'serbian / english / russian'],
    footer:
      'The Velve website stays intentionally promotional. The full functional product lives in the mobile app.',
  },
  ru: {
    eyebrow: 'Alt fashion identity',
    script: 'for closet romantics',
    title: 'Velve — это чисто промо-окно в модный мир, который мы строим.',
    description:
      'Этот сайт не является приложением и не пытается выглядеть как product dashboard. Он передает только тон, эстетику и энергию Velve, пока главная сцена остается внутри mobile-опыта.',
    primary: 'mobile app скоро',
    secondary: 'promo-only web',
    manifestoTitle: 'Не resale-сайт с чуть более красивой палитрой.',
    manifestoText:
      'Velve строится как image-first, identity-led wardrobe network, где discovery, обмен и личный стиль ощущаются как одна сцена.',
    cards: [
      {
        index: '01',
        title: 'Image-first world',
        text: 'Фотография ведет кадр, а интерфейс остается тихим и editorial.',
      },
      {
        index: '02',
        title: 'Trade as culture',
        text: 'Обмен должен ощущаться как социальный ритуал, а не как сухая транзакция.',
      },
      {
        index: '03',
        title: 'Style identity',
        text: 'Профили должны выглядеть как личные модные пространства, а не как settings-панели.',
      },
    ],
    band: ['neo-y2k', 'soft glass', 'deep velvet', 'serbian / english / russian'],
    footer:
      'Сайт Velve остается намеренно промо-ориентированным. Весь функциональный вес продукта живет в mobile-приложении.',
  },
} as const

export default function App() {
  const [locale, setLocale] = useState<Locale>('sr')
  const current = useMemo(() => copy[locale], [locale])

  return (
    <main className="page-shell">
      <div className="page-noise" />
      <div className="page-orb orb-left" />
      <div className="page-orb orb-right" />

      <header className="top-bar">
        <span className="eyebrow">{current.eyebrow}</span>

        <div className="locale-switch" aria-label="Locale switch">
          {(['sr', 'en', 'ru'] as const).map((language) => (
            <button
              key={language}
              className={`locale-pill ${locale === language ? 'active' : ''}`}
              onClick={() => setLocale(language)}
              type="button"
            >
              {language.toUpperCase()}
            </button>
          ))}
        </div>
      </header>

      <section className="hero-grid">
        <div className="hero-column glass-panel hero-panel">
          <img className="wordmark" src={wordmark} alt="Velve" />
          <p className="hero-script">{current.script}</p>
          <h1>{current.title}</h1>
          <p className="hero-description">{current.description}</p>

          <div className="hero-actions">
            <div className="primary-pill">{current.primary}</div>
            <div className="secondary-pill">{current.secondary}</div>
          </div>

          <div className="mood-band">
            {current.band.map((item) => (
              <span key={item} className="mood-chip">
                {item}
              </span>
            ))}
          </div>
        </div>

        <div className="hero-column right-column">
          <article className="glass-panel manifesto-panel">
            <p className="manifesto-kicker">Velve manifesto</p>
            <h2>{current.manifestoTitle}</h2>
            <p>{current.manifestoText}</p>
          </article>

          <div className="card-stack">
            {current.cards.map((card, index) => (
              <article
                key={card.index}
                className={`glass-panel detail-card ${index === 2 ? 'detail-card-accent' : ''}`}
              >
                <span className="card-index">{card.index}</span>
                <h3>{card.title}</h3>
                <p>{card.text}</p>
              </article>
            ))}
          </div>
        </div>
      </section>

      <footer className="page-footer">{current.footer}</footer>
    </main>
  )
}
