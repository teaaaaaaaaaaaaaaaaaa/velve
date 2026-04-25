import {
  createContext,
  ReactNode,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react'

import { detectLocaleFromDevice, localeTags, SupportedLocale } from '@/design/tokens'
import { getStorage } from '@/lib/storage'

const STORAGE_KEY = '@velve:locale'

const dictionaries = {
  sr: {
    'common.search': 'Pretraga',
    'common.close': 'Zatvori',
    'common.refresh': 'Osveži',
    'common.language': 'Jezik',
    'common.loading': 'Velve slaže tvoj sledeći kadar',
    'tabs.feed': 'Feed',
    'tabs.upload': 'Dodaj',
    'tabs.chat': 'Poruke',
    'tabs.profile': 'Profil',
    'feed.discovery': 'Velve discovery',
    'feed.title': 'Za tvoj ukus danas',
    'feed.emptyTitle': 'Feed čeka tvoj sledeći signal',
    'feed.emptyDescription':
      'Sakrij šta ti nije vibe, sačuvaj šta jeste i discovery će brzo početi da liči na tvoj ukus.',
    'feed.manualFallback': 'Prazan kadar više ne prolazi. Ubaci sliku i nastavi.',
    'feed.sheetSubtitle': 'Prilagodi discovery tako da ostane u tvom ritmu.',
    'feed.hideItem': 'Sakrij ovu objavu',
    'feed.reportItem': 'Prijavi objavu',
    'feed.viewProfile': 'Pogledaj profil',
    'feed.blockUser': 'Blokiraj korisnika',
    'feed.trade': 'Razmeni',
    'feed.details': 'Detalji',
    'profile.title': 'Tvoj profil',
    'profile.edit': 'Izmeni profil',
    'profile.closet': 'Moj closet',
    'profile.tradeDesk': 'Trade desk',
    'profile.trust': 'Trust sloj',
    'profile.recentlyViewed': 'Skoro gledano',
    'profile.recommended': 'Za tvoj ukus',
    'profile.languageTitle': 'App language',
    'profile.languageDescription':
      'Promeni interfejs i AI copy tok bez ponovnog pokretanja aplikacije.',
    'profile.completeness': 'Kompletnost profila',
    'profile.followers': 'Pratioci',
    'profile.following': 'Pratiš',
    'profile.active': 'Aktivno',
    'profile.joinedPrefix': 'Od {{date}}',
    'profile.newMember': 'Novi član',
    'profile.responseRate': '{{value}}% odgovora',
    'profile.responseRateEmpty': 'Još nema dovoljno zahteva',
    'profile.live': 'Live',
    'profile.drafts': 'Drafts',
    'profile.archive': 'Archive',
    'profile.newListing': 'Nova objava',
    'profile.wishlist': 'Sačuvano',
    'profile.logout': 'Odjava',
    'profile.logoutConfirm': 'Da li želiš da završiš sesiju?',
    'profile.stay': 'Ostani',
    'profile.logoutCta': 'Odjavi se',
    'profile.emptyTitle': 'Profil trenutno nije dostupan',
    'profile.emptyDescription':
      'Veza sa backend profilom je pukla. Pokušaj ponovo za nastavak.',
    'chat.eyebrow': 'Messages',
    'chat.title': 'Inbox',
    'chat.tradePulse': 'Trade pulse',
    'chat.openTradeDesk': 'Otvori trade desk',
    'chat.emptyTitle': 'Inbox je još tih',
    'chat.emptyDescription':
      'Kada pošalješ trade predlog ili otvoriš direktan razgovor, ovde će se pojaviti uredan thread.',
    'chat.lifecycle': 'Lifecycle',
    'chat.directConversation': 'Direktan razgovor',
    'chat.placeholder': 'Napiši poruku...',
    'chat.typeStatus': '{{name}} piše...',
    'chat.threadEmpty': 'Započeo si thread. Sledeća poruka otvara tempo razgovora.',
    'chat.tradeProposal': 'Trade proposal',
    'chat.buyRequest': 'Buy request',
    'chat.tradeUpdate': 'Trade update',
    'chat.offers': 'Nudi',
    'chat.wants': 'Traži',
    'chat.item': 'Predmet',
    'chat.openRequestedItem': 'Otvori traženi predmet',
    'chat.openItem': 'Otvori predmet',
    'chat.tradeStatusLabel': 'Trade status: {{status}}',
    'chat.tradeStatusPanel':
      'Trade status za ovaj thread trenutno je "{{status}}". Sve odluke i history pregled su u trade desk modu.',
    'auth.tagline': 'Razmeni garderobu. Otkrij stil.',
    'auth.loginTitle': 'Uđi u svoj stil tok',
    'auth.loginDescription':
      'Google ostaje najbrži ulaz, a email je tu kada želiš mirniji fallback.',
    'auth.google': 'Nastavi sa Google',
    'auth.email': 'Nastavi sa emailom',
    'auth.signIn': 'Prijavi se',
    'auth.register': 'Registruj se',
    'auth.registerTitle': 'Pridruži se alt wardrobe mreži',
    'auth.registerDescription':
      'Napravi profil koji izgleda kao tvoj modni prostor, a ne kao generičan nalog.',
    'auth.haveAccount': 'Već imam nalog',
    'auth.noAccount': 'Nemaš nalog? Registruj se',
    'auth.emailPlaceholder': 'Email',
    'auth.passwordPlaceholder': 'Lozinka',
    'auth.passwordLongPlaceholder': 'Lozinka (min. 8 karaktera)',
    'onboarding.welcomeStep': 'Korak 1 od 5',
    'onboarding.welcomeTitle': 'Uđi u mrežu koja stil tretira kao scenu',
    'onboarding.welcomeDescription':
      'Velve spaja discovery, razmenu i modni identitet u jedan fluidan feed.',
    'onboarding.welcomeMood': 'curated for your style',
    'onboarding.start': 'Počni',
    'upload.aiGenerating': 'AI generiše opis...',
    'language.sr': 'SR',
    'language.en': 'EN',
    'language.ru': 'RU',
  },
  en: {
    'common.search': 'Search',
    'common.close': 'Close',
    'common.refresh': 'Refresh',
    'common.language': 'Language',
    'common.loading': 'Velve is curating your next frame',
    'tabs.feed': 'Feed',
    'tabs.upload': 'Add',
    'tabs.chat': 'Chat',
    'tabs.profile': 'Profile',
    'feed.discovery': 'Velve discovery',
    'feed.title': 'For your taste today',
    'feed.emptyTitle': 'The feed is waiting for your next signal',
    'feed.emptyDescription':
      'Hide what is off, save what clicks, and discovery will start looking like your style fast.',
    'feed.manualFallback': 'A blank frame is not enough. Add a photo and keep going.',
    'feed.sheetSubtitle': 'Tune discovery so it stays in your rhythm.',
    'feed.hideItem': 'Hide this listing',
    'feed.reportItem': 'Report listing',
    'feed.viewProfile': 'Open profile',
    'feed.blockUser': 'Block user',
    'feed.trade': 'Trade',
    'feed.details': 'Details',
    'profile.title': 'Your profile',
    'profile.edit': 'Edit profile',
    'profile.closet': 'My closet',
    'profile.tradeDesk': 'Trade desk',
    'profile.trust': 'Trust layer',
    'profile.recentlyViewed': 'Recently viewed',
    'profile.recommended': 'Recommended',
    'profile.languageTitle': 'App language',
    'profile.languageDescription':
      'Switch interface copy and the AI description flow without restarting the app.',
    'profile.completeness': 'Profile completeness',
    'profile.followers': 'Followers',
    'profile.following': 'Following',
    'profile.active': 'Active',
    'profile.joinedPrefix': 'Since {{date}}',
    'profile.newMember': 'New member',
    'profile.responseRate': '{{value}}% response rate',
    'profile.responseRateEmpty': 'Not enough requests yet',
    'profile.live': 'Live',
    'profile.drafts': 'Drafts',
    'profile.archive': 'Archive',
    'profile.newListing': 'New listing',
    'profile.wishlist': 'Saved',
    'profile.logout': 'Log out',
    'profile.logoutConfirm': 'Do you want to end this session?',
    'profile.stay': 'Stay',
    'profile.logoutCta': 'Log out',
    'profile.emptyTitle': 'Profile is unavailable right now',
    'profile.emptyDescription':
      'The connection to your profile broke for a moment. Try again to continue.',
    'chat.eyebrow': 'Messages',
    'chat.title': 'Inbox',
    'chat.tradePulse': 'Trade pulse',
    'chat.openTradeDesk': 'Open trade desk',
    'chat.emptyTitle': 'The inbox is still quiet',
    'chat.emptyDescription':
      'Once you send a trade proposal or open a direct conversation, the thread will appear here.',
    'chat.lifecycle': 'Lifecycle',
    'chat.directConversation': 'Direct conversation',
    'chat.placeholder': 'Write a message...',
    'chat.typeStatus': '{{name}} is typing...',
    'chat.threadEmpty': 'You started the thread. The next message sets the tone.',
    'chat.tradeProposal': 'Trade proposal',
    'chat.buyRequest': 'Buy request',
    'chat.tradeUpdate': 'Trade update',
    'chat.offers': 'Offers',
    'chat.wants': 'Wants',
    'chat.item': 'Item',
    'chat.openRequestedItem': 'Open requested item',
    'chat.openItem': 'Open item',
    'chat.tradeStatusLabel': 'Trade status: {{status}}',
    'chat.tradeStatusPanel':
      'The trade status for this thread is currently "{{status}}". Every decision and the full history live in trade desk mode.',
    'auth.tagline': 'Trade clothes. Discover style.',
    'auth.loginTitle': 'Step back into your style flow',
    'auth.loginDescription':
      'Google remains the fastest entry, while email stays as the quieter fallback.',
    'auth.google': 'Continue with Google',
    'auth.email': 'Continue with email',
    'auth.signIn': 'Sign in',
    'auth.register': 'Create account',
    'auth.registerTitle': 'Join the alt wardrobe network',
    'auth.registerDescription':
      'Build a profile that feels like your fashion space, not a generic account.',
    'auth.haveAccount': 'I already have an account',
    'auth.noAccount': "Don't have an account? Sign up",
    'auth.emailPlaceholder': 'Email',
    'auth.passwordPlaceholder': 'Password',
    'auth.passwordLongPlaceholder': 'Password (min. 8 characters)',
    'onboarding.welcomeStep': 'Step 1 of 5',
    'onboarding.welcomeTitle': 'Enter a network that treats style like a scene',
    'onboarding.welcomeDescription':
      'Velve blends discovery, swapping, and fashion identity into one fluid feed.',
    'onboarding.welcomeMood': 'curated for your style',
    'onboarding.start': 'Start',
    'upload.aiGenerating': 'AI is writing your copy...',
    'language.sr': 'SR',
    'language.en': 'EN',
    'language.ru': 'RU',
  },
  ru: {
    'common.search': 'Поиск',
    'common.close': 'Закрыть',
    'common.refresh': 'Обновить',
    'common.language': 'Язык',
    'common.loading': 'Velve собирает для тебя следующий кадр',
    'tabs.feed': 'Лента',
    'tabs.upload': 'Добавить',
    'tabs.chat': 'Чаты',
    'tabs.profile': 'Профиль',
    'feed.discovery': 'Velve discovery',
    'feed.title': 'Под твой вкус сегодня',
    'feed.emptyTitle': 'Лента ждет твой следующий сигнал',
    'feed.emptyDescription':
      'Скрывай то, что не цепляет, сохраняй то, что попадает в настроение, и discovery быстро подстроится под твой стиль.',
    'feed.manualFallback': 'Пустой кадр не работает. Добавь фото и продолжай.',
    'feed.sheetSubtitle': 'Настрой discovery так, чтобы он держал твой ритм.',
    'feed.hideItem': 'Скрыть этот лот',
    'feed.reportItem': 'Пожаловаться',
    'feed.viewProfile': 'Открыть профиль',
    'feed.blockUser': 'Заблокировать',
    'feed.trade': 'Обменять',
    'feed.details': 'Детали',
    'profile.title': 'Твой профиль',
    'profile.edit': 'Изменить профиль',
    'profile.closet': 'Мой closet',
    'profile.tradeDesk': 'Trade desk',
    'profile.trust': 'Слой доверия',
    'profile.recentlyViewed': 'Недавно просмотрено',
    'profile.recommended': 'Рекомендовано',
    'profile.languageTitle': 'Язык приложения',
    'profile.languageDescription':
      'Меняй язык интерфейса и AI-описаний без перезапуска приложения.',
    'profile.completeness': 'Заполненность профиля',
    'profile.followers': 'Подписчики',
    'profile.following': 'Подписки',
    'profile.active': 'Активно',
    'profile.joinedPrefix': 'С {{date}}',
    'profile.newMember': 'Новый участник',
    'profile.responseRate': '{{value}}% ответов',
    'profile.responseRateEmpty': 'Пока недостаточно запросов',
    'profile.live': 'Live',
    'profile.drafts': 'Черновики',
    'profile.archive': 'Архив',
    'profile.newListing': 'Новый лот',
    'profile.wishlist': 'Сохранено',
    'profile.logout': 'Выйти',
    'profile.logoutConfirm': 'Хочешь завершить эту сессию?',
    'profile.stay': 'Остаться',
    'profile.logoutCta': 'Выйти',
    'profile.emptyTitle': 'Профиль сейчас недоступен',
    'profile.emptyDescription':
      'Связь с профилем на мгновение прервалась. Попробуй снова, чтобы продолжить.',
    'chat.eyebrow': 'Messages',
    'chat.title': 'Inbox',
    'chat.tradePulse': 'Trade pulse',
    'chat.openTradeDesk': 'Открыть trade desk',
    'chat.emptyTitle': 'Inbox пока тихий',
    'chat.emptyDescription':
      'Когда ты отправишь trade-предложение или откроешь прямой разговор, тред появится здесь.',
    'chat.lifecycle': 'Lifecycle',
    'chat.directConversation': 'Прямой разговор',
    'chat.placeholder': 'Напиши сообщение...',
    'chat.typeStatus': '{{name}} печатает...',
    'chat.threadEmpty': 'Тред уже открыт. Следующее сообщение задает ритм.',
    'chat.tradeProposal': 'Trade proposal',
    'chat.buyRequest': 'Buy request',
    'chat.tradeUpdate': 'Trade update',
    'chat.offers': 'Предлагает',
    'chat.wants': 'Ищет',
    'chat.item': 'Предмет',
    'chat.openRequestedItem': 'Открыть нужный предмет',
    'chat.openItem': 'Открыть предмет',
    'chat.tradeStatusLabel': 'Статус trade: {{status}}',
    'chat.tradeStatusPanel':
      'Статус trade в этом треде сейчас "{{status}}". Все решения и история находятся в trade desk.',
    'auth.tagline': 'Обменивай одежду. Открывай стиль.',
    'auth.loginTitle': 'Вернись в свой стиль-поток',
    'auth.loginDescription':
      'Google остается самым быстрым входом, а email служит спокойным резервным вариантом.',
    'auth.google': 'Продолжить с Google',
    'auth.email': 'Продолжить через email',
    'auth.signIn': 'Войти',
    'auth.register': 'Создать аккаунт',
    'auth.registerTitle': 'Присоединись к alt wardrobe сети',
    'auth.registerDescription':
      'Собери профиль, который ощущается как твое модное пространство, а не как типичный аккаунт.',
    'auth.haveAccount': 'У меня уже есть аккаунт',
    'auth.noAccount': 'Еще нет аккаунта? Зарегистрируйся',
    'auth.emailPlaceholder': 'Email',
    'auth.passwordPlaceholder': 'Пароль',
    'auth.passwordLongPlaceholder': 'Пароль (минимум 8 символов)',
    'onboarding.welcomeStep': 'Шаг 1 из 5',
    'onboarding.welcomeTitle': 'Войди в сеть, где стиль ощущается как сцена',
    'onboarding.welcomeDescription':
      'Velve соединяет discovery, обмен и модную идентичность в одну плавную ленту.',
    'onboarding.welcomeMood': 'curated for your style',
    'onboarding.start': 'Начать',
    'upload.aiGenerating': 'AI пишет твой текст...',
    'language.sr': 'SR',
    'language.en': 'EN',
    'language.ru': 'RU',
  },
} as const

type TranslationKey = keyof typeof dictionaries.sr
type Params = Record<string, string | number>

type I18nContextValue = {
  locale: SupportedLocale
  setLocale: (nextLocale: SupportedLocale) => Promise<void>
  t: (key: TranslationKey, params?: Params) => string
  formatDate: (value: Date | string | number, options?: Intl.DateTimeFormatOptions) => string
}

const I18nContext = createContext<I18nContextValue | null>(null)

function fillTemplate(template: string, params?: Params) {
  if (!params) return template

  return Object.entries(params).reduce((result, [key, value]) => {
    return result.replace(new RegExp(`{{${key}}}`, 'g'), String(value))
  }, template)
}

export function I18nProvider({ children }: { children: ReactNode }) {
  const [locale, setLocaleState] = useState<SupportedLocale>(detectLocaleFromDevice())

  useEffect(() => {
    getStorage()
      .getItem(STORAGE_KEY)
      .then((stored) => {
        if (stored === 'sr' || stored === 'en' || stored === 'ru') {
          setLocaleState(stored)
        }
      })
      .catch(() => undefined)
  }, [])

  const setLocale = useCallback(async (nextLocale: SupportedLocale) => {
    setLocaleState(nextLocale)
    await getStorage().setItem(STORAGE_KEY, nextLocale)
  }, [])

  const t = useCallback(
    (key: TranslationKey, params?: Params) => {
      const value = dictionaries[locale]?.[key] ?? dictionaries.sr[key] ?? key
      return fillTemplate(value, params)
    },
    [locale]
  )

  const formatDate = useCallback(
    (value: Date | string | number, options?: Intl.DateTimeFormatOptions) =>
      new Date(value).toLocaleDateString(localeTags[locale], options),
    [locale]
  )

  const contextValue = useMemo(
    () => ({
      locale,
      setLocale,
      t,
      formatDate,
    }),
    [formatDate, locale, setLocale, t]
  )

  return <I18nContext.Provider value={contextValue}>{children}</I18nContext.Provider>
}

export function useI18n() {
  const context = useContext(I18nContext)

  if (!context) {
    throw new Error('useI18n must be used inside I18nProvider')
  }

  return context
}
