import { useLocalSearchParams, useRouter } from 'expo-router'
import { useEffect, useMemo, useState } from 'react'
import {
  ActivityIndicator,
  Alert,
  ScrollView,
  Text,
  TouchableOpacity,
  View,
} from 'react-native'

import client from '@/api/client'
import { BrandedLoader } from '@/components/BrandedLoader'
import { RemoteImage } from '@/components/RemoteImage'
import { VelveTextInput } from '@/components/VelveTextInput'
import { colors } from '@/design/tokens'
import { getPrimaryItemImage } from '@/lib/itemImages'

type ItemPayload = {
  _id: string
  title: string
  brand?: string
  category?: string
  images?: string[]
  imageClean?: string | null
  primaryImage?: string | null
}

type RenderRouteParams = {
  itemId?: string | string[]
  itemIds?: string | string[]
  mode?: string | string[]
}

type RenderResult = {
  vtoImageUrl: string | null
  renderModel: string
  isChainRender: boolean
  chainSteps: number
  categoriesUsed: string[]
}

function normalizeParam(value?: string | string[]) {
  if (Array.isArray(value)) {
    return value[0]
  }

  return value
}

function parseSelectedItemIds(itemId?: string | string[], itemIds?: string | string[]) {
  const singleItemId = normalizeParam(itemId)
  const rawItemIds = normalizeParam(itemIds)

  if (rawItemIds) {
    try {
      const parsed = JSON.parse(rawItemIds)
      if (Array.isArray(parsed)) {
        return parsed.map((entry) => String(entry || '').trim()).filter(Boolean)
      }
    } catch {
      return rawItemIds
        .split(',')
        .map((entry) => String(entry || '').trim())
        .filter(Boolean)
    }
  }

  return singleItemId ? [singleItemId] : []
}

export default function VtoRenderScreen() {
  const router = useRouter()
  const params = useLocalSearchParams<RenderRouteParams>()
  const [requestId] = useState(
    () => `vto-mobile-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
  )
  const [items, setItems] = useState<ItemPayload[]>([])
  const [renderResult, setRenderResult] = useState<RenderResult | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [outfitName, setOutfitName] = useState(() =>
    parseSelectedItemIds(params.itemId, params.itemIds).length > 1
      ? 'Velve Outfit'
      : 'Misty Night Out'
  )

  const mode = normalizeParam(params.mode)
  const selectedItemIds = useMemo(
    () => parseSelectedItemIds(params.itemId, params.itemIds),
    [params.itemId, params.itemIds]
  )
  const isMultiItem = selectedItemIds.length > 1

  useEffect(() => {
    if (selectedItemIds.length === 0) {
      router.replace('/vto/select')
      return
    }

    let active = true
    ;(async () => {
      try {
        console.log('[VTO][Mobile] Render requested', {
          requestId,
          itemIds: selectedItemIds,
          mode: mode || 'closet',
        })

        if (mode === 'quick') {
          const bodyScanResponse = await client.get('/api/users/body-scan')
          const hasBodyScan = bodyScanResponse.data?.data?.exists

          if (!hasBodyScan) {
            console.log('[VTO][Mobile] Missing body scan, redirecting to onboarding', {
              requestId,
              itemIds: selectedItemIds,
            })
            if (active) {
              router.replace({
                pathname: '/vto/body-scan',
                params: {
                  returnTo: '/vto/render',
                  ...(selectedItemIds.length === 1
                    ? { itemId: selectedItemIds[0] }
                    : { itemIds: JSON.stringify(selectedItemIds) }),
                  mode: 'quick',
                },
              })
            }
            return
          }
        }

        const itemRequests = Promise.all(
          selectedItemIds.map((itemId) => client.get(`/api/items/${itemId}`))
        )
        const renderRequest =
          selectedItemIds.length > 1
            ? client.post(
                '/api/vto/try-on-outfit',
                { itemIds: selectedItemIds, requestId },
                { timeout: 120000 }
              )
            : client.post(
                '/api/vto/try-on',
                { itemId: selectedItemIds[0], requestId },
                { timeout: 120000 }
              )

        const [itemResponses, tryOnResponse] = await Promise.all([itemRequests, renderRequest])

        if (!active) return
        const loadedItems = itemResponses
          .map((response) => response.data?.data)
          .filter(Boolean) as ItemPayload[]
        const payload = tryOnResponse.data?.data || {}

        console.log('[VTO][Mobile] Render response received', {
          requestId,
          itemIds: selectedItemIds,
          hasItems: loadedItems.length > 0,
          hasVtoImageUrl: Boolean(payload?.vtoImageUrl),
          isChainRender: Boolean(payload?.isChainRender),
          chainSteps: payload?.chainSteps || 1,
        })

        setItems(loadedItems)
        setRenderResult({
          vtoImageUrl: payload?.vtoImageUrl || null,
          renderModel: payload?.renderModel || 'fashn-vton-1.5',
          isChainRender: Boolean(payload?.isChainRender),
          chainSteps: Number(payload?.chainSteps) || 1,
          categoriesUsed: Array.isArray(payload?.categoriesUsed)
            ? payload.categoriesUsed.map((entry: unknown) => String(entry))
            : [],
        })
      } catch (error: any) {
        const message =
          error?.response?.data?.error || error?.message || 'Pokusaj ponovo za nekoliko trenutaka.'
        console.log('[VTO][Mobile] Render failed', {
          requestId,
          itemIds: selectedItemIds,
          message,
          status: error?.response?.status || null,
        })

        if (active) {
          Alert.alert('Try-On nije uspeo', message, [
            {
              text: 'Nazad',
              onPress: () => {
                if (mode === 'quick' && selectedItemIds[0]) {
                  router.replace({
                    pathname: '/items/[id]',
                    params: { id: selectedItemIds[0] },
                  })
                  return
                }

                router.replace('/vto/select')
              },
            },
          ])
        }
      } finally {
        if (active) {
          console.log('[VTO][Mobile] Render request finished', {
            requestId,
            itemIds: selectedItemIds,
          })
          setLoading(false)
        }
      }
    })()

    return () => {
      active = false
    }
  }, [mode, requestId, router, selectedItemIds])

  async function saveOutfit() {
    if (!renderResult?.vtoImageUrl || selectedItemIds.length === 0) return

    try {
      setSaving(true)
      await client.post('/api/vto/outfits', {
        name: outfitName.trim() || 'Untitled Outfit',
        itemIds: selectedItemIds,
        vtoImageUrl: renderResult.vtoImageUrl,
        renderModel: renderResult.renderModel,
        isChainRender: renderResult.isChainRender,
        chainSteps: renderResult.chainSteps,
        categoriesUsed: renderResult.categoriesUsed,
      })

      Alert.alert('Sacuvano', 'Outfit je dodat u kolekciju.')
      router.replace({
        pathname: '/vto/hub',
        params: { vtoImageUrl: renderResult.vtoImageUrl },
      })
    } catch (error: any) {
      Alert.alert(
        'Ne mogu da sacuvam fit',
        error?.response?.data?.error || error?.message || 'Pokusaj ponovo.'
      )
    } finally {
      setSaving(false)
    }
  }

  if (loading) {
    return (
      <BrandedLoader
        label={
          isMultiItem
            ? 'Slazemo tvoj outfit korak po korak. Ovo moze da potraje malo duze od minuta.'
            : 'Renderujemo tvoj Virtual Try-On. Ovo moze da potraje oko minut.'
        }
        showSpinner
      />
    )
  }

  return (
    <ScrollView className="flex-1 bg-base-canvas" contentContainerStyle={{ paddingBottom: 48 }}>
      <View className="px-5 pb-8 pt-14">
        <Text className="font-sans text-xs uppercase tracking-[1.4px] text-ink-dark/45">
          Digitalni snajder
        </Text>
        <Text className="mt-2 font-display text-4xl text-ink-dark">
          Try-On rezultat
        </Text>

        <RemoteImage
          uri={renderResult?.vtoImageUrl || undefined}
          className="mt-6 h-[560px] w-full rounded-[34px] bg-white"
        />

        <View className="mt-5 rounded-[28px] bg-surface-panel px-4 py-4">
          <Text className="font-display text-3xl text-ink-dark">
            Clothes ({items.length} {items.length === 1 ? 'item' : 'items'})
          </Text>
          {renderResult?.isChainRender ? (
            <Text className="mt-2 font-sans text-sm leading-6 text-ink-dark/65">
              Outfit je renderovan u {renderResult.chainSteps} koraka modelom {renderResult.renderModel}.
            </Text>
          ) : null}

          <View className="mt-4 gap-3">
            {items.map((item) => (
              <View key={item._id} className="flex-row items-center">
                <RemoteImage
                  uri={getPrimaryItemImage(item) || undefined}
                  className="h-24 w-20 rounded-[20px]"
                />
                <View className="ml-3 flex-1">
                  <Text className="font-display text-2xl text-ink-dark">{item.title}</Text>
                  <Text className="mt-1 font-sans text-xs text-ink-dark/55">
                    {[item.brand, item.category].filter(Boolean).join(' / ')}
                  </Text>
                </View>
              </View>
            ))}
          </View>
        </View>

        <View className="mt-5 rounded-[28px] bg-surface-panel px-4 py-4">
          <Text className="font-display text-3xl text-ink-dark">Sacuvaj fit</Text>
          <VelveTextInput
            value={outfitName}
            onChangeText={setOutfitName}
            placeholder={isMultiItem ? 'Velve Outfit' : 'Misty Night Out'}
            className="mt-4 rounded-[22px] bg-base-canvas px-4 py-4 font-sans text-sm text-ink-dark"
          />

          <TouchableOpacity
            onPress={saveOutfit}
            disabled={saving}
            className="mt-4 items-center rounded-full bg-brand-accent-deep px-4 py-4"
          >
            {saving ? (
              <ActivityIndicator size="small" color={colors.baseCanvas} />
            ) : (
              <Text className="font-sans text-base font-semibold text-base-canvas">
                Save Outfit
              </Text>
            )}
          </TouchableOpacity>

          <TouchableOpacity
            onPress={() =>
              router.replace({
                pathname: '/vto/hub',
                params: { vtoImageUrl: renderResult?.vtoImageUrl || undefined },
              })
            }
            className="mt-3 items-center rounded-full border border-brand-accent-deep/15 bg-base-canvas px-4 py-4"
          >
            <Text className="font-sans text-base font-semibold text-ink-dark">
              Otvori hub
            </Text>
          </TouchableOpacity>
        </View>
      </View>
    </ScrollView>
  )
}
