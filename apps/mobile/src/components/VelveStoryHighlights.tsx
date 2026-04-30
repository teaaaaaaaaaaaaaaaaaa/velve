import { Ionicons } from '@expo/vector-icons'
import { useMemo, useState } from 'react'
import { Modal, ScrollView, Text, TouchableOpacity, View } from 'react-native'

import { colors } from '@/design/tokens'

type HighlightProfile = {
  displayName?: string
  bio?: string
  stylePreferences?: string[]
  favoriteBrands?: string[]
  completedTrades?: number
  successfulSwaps?: number
  averageRating?: number
}

type Highlight = {
  id: string
  label: string
  title: string
  body: string
  icon: keyof typeof Ionicons.glyphMap
  pills: string[]
}

function fallbackStyle(profile: HighlightProfile) {
  if (profile.bio) return profile.bio
  return 'Profil jos gradi svoj stil potpis. Prvi komadi i sacuvani brendovi ce ovde brzo napraviti jasniju pricu.'
}

export function VelveStoryHighlights({ profile }: { profile: HighlightProfile }) {
  const [activeHighlight, setActiveHighlight] = useState<Highlight | null>(null)

  const highlights = useMemo<Highlight[]>(() => {
    const stylePills = profile.stylePreferences?.length ? profile.stylePreferences.slice(0, 5) : []
    const brandPills = profile.favoriteBrands?.length ? profile.favoriteBrands.slice(0, 6) : []
    const swaps = profile.successfulSwaps || profile.completedTrades || 0

    return [
      {
        id: 'style',
        label: 'Moj stil',
        title: 'Moj stil',
        body: stylePills.length
          ? `${profile.displayName || 'Korisnik'} najvise gravitira ka ovim stilskim signalima.`
          : fallbackStyle(profile),
        icon: 'sparkles-outline',
        pills: stylePills.length ? stylePills : ['U izgradnji'],
      },
      {
        id: 'brands',
        label: 'Brendovi',
        title: 'Omiljeni brendovi',
        body: brandPills.length
          ? 'Brendovi koji najcesce oblikuju discovery i trade predloge.'
          : 'Dodaj omiljene brendove kroz onboarding ili profil edit da drugi brze razumeju tvoj ukus.',
        icon: 'pricetag-outline',
        pills: brandPills.length ? brandPills : ['Nema jos brendova'],
      },
      {
        id: 'trades',
        label: 'Razmene',
        title: 'Uspesne razmene',
        body: swaps > 0
          ? `${swaps} uspesnih razmena gradi poverenje ovog profila.`
          : 'Kada se zavrse prve razmene, ovde ce stajati trust signal profila.',
        icon: 'repeat-outline',
        pills: [
          `${swaps} razmena`,
          profile.averageRating && profile.averageRating > 0
            ? `${profile.averageRating.toFixed(1)} ocena`
            : 'Bez ocene',
        ],
      },
    ]
  }, [profile])

  return (
    <>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        className="mt-5"
        contentContainerStyle={{ paddingRight: 12 }}
      >
        {highlights.map((highlight) => (
          <TouchableOpacity
            key={highlight.id}
            activeOpacity={0.86}
            onPress={() => setActiveHighlight(highlight)}
            className="mr-4 w-[82px] items-center"
          >
            <View className="h-[72px] w-[72px] items-center justify-center rounded-full border-2 border-brand-accent-deep bg-base-canvas p-1">
              <View className="h-full w-full items-center justify-center rounded-full bg-brand-accent-light/25">
                <Ionicons name={highlight.icon} size={25} color={colors.accentDeep} />
              </View>
            </View>
            <Text className="mt-2 text-center font-sans text-xs font-semibold text-ink-dark" numberOfLines={1}>
              {highlight.label}
            </Text>
          </TouchableOpacity>
        ))}
      </ScrollView>

      <Modal
        transparent
        animationType="fade"
        visible={Boolean(activeHighlight)}
        onRequestClose={() => setActiveHighlight(null)}
      >
        <View className="flex-1 justify-end bg-ink-dark/55">
          <TouchableOpacity className="flex-1" activeOpacity={1} onPress={() => setActiveHighlight(null)} />
          {activeHighlight ? (
            <View className="rounded-t-[32px] bg-base-canvas px-5 pb-8 pt-5">
              <View className="mb-5 h-1.5 w-12 self-center rounded-full bg-ink-dark/16" />
              <View className="flex-row items-center">
                <View className="h-14 w-14 items-center justify-center rounded-full bg-brand-accent-deep">
                  <Ionicons name={activeHighlight.icon} size={24} color={colors.baseCanvas} />
                </View>
                <View className="ml-3 flex-1">
                  <Text className="font-display text-3xl text-ink-dark">{activeHighlight.title}</Text>
                  <Text className="mt-1 font-sans text-sm text-ink-dark/55">
                    {profile.displayName || 'Velve profil'}
                  </Text>
                </View>
              </View>
              <Text className="mt-5 font-sans text-sm leading-6 text-ink-dark/70">
                {activeHighlight.body}
              </Text>
              <View className="mt-5 flex-row flex-wrap">
                {activeHighlight.pills.map((pill) => (
                  <View key={pill} className="mb-2 mr-2 rounded-pill bg-surface-panel px-4 py-2.5">
                    <Text className="font-sans text-sm font-semibold text-ink-dark">{pill}</Text>
                  </View>
                ))}
              </View>
              <TouchableOpacity
                onPress={() => setActiveHighlight(null)}
                className="mt-4 items-center rounded-pill bg-brand-accent-deep px-5 py-4"
              >
                <Text className="font-sans text-base font-semibold text-base-canvas">Zatvori</Text>
              </TouchableOpacity>
            </View>
          ) : null}
        </View>
      </Modal>
    </>
  )
}
