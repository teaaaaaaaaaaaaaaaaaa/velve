import { Ionicons } from '@expo/vector-icons';
import { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Modal,
  Pressable,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';

import client from '@/api/client';
import { RemoteImage } from '@/components/RemoteImage';
import { colors } from '@/design/tokens';
import { getApiErrorMessage } from '@/lib/apiErrors';
import { showVelveToast } from '@/lib/velveAlert';

type ShareTarget = {
  _id: string;
  displayName: string;
  photoURL?: string;
};

type ChatListEntry = {
  _id: string;
  participants: { _id: string; displayName: string; photoURL?: string }[];
};

type Props = {
  visible: boolean;
  itemId: string | null;
  currentUserId?: string;
  onClose: () => void;
  onSent: (itemId: string) => void;
};

/**
 * Instagram-style "send to" sheet: lists people you already chat with and
 * shares the item into that conversation as an item card message.
 */
export function SendItemSheet({ visible, itemId, currentUserId, onClose, onSent }: Props) {
  const [targets, setTargets] = useState<ShareTarget[]>([]);
  const [loading, setLoading] = useState(false);
  const [sendingId, setSendingId] = useState<string | null>(null);
  const [sentIds, setSentIds] = useState<Set<string>>(new Set());

  useEffect(() => {
    if (!visible) return;
    setSentIds(new Set());
    setLoading(true);
    client
      .get('/api/chat')
      .then((response) => {
        if (!response.data.ok) throw new Error('CHAT_LIST_FAILED');
        const chats = (response.data.data || []) as ChatListEntry[];
        const seen = new Set<string>();
        const nextTargets: ShareTarget[] = [];
        for (const chat of chats) {
          for (const participant of chat.participants || []) {
            if (!participant?._id || participant._id === currentUserId) continue;
            if (seen.has(participant._id)) continue;
            seen.add(participant._id);
            nextTargets.push(participant);
          }
        }
        setTargets(nextTargets);
      })
      .catch(() => setTargets([]))
      .finally(() => setLoading(false));
  }, [visible, currentUserId]);

  const handleSend = useCallback(
    async (target: ShareTarget) => {
      if (!itemId || sendingId) return;
      setSendingId(target._id);
      try {
        const directResponse = await client.post(`/api/chat/direct/${target._id}`);
        const chatId = directResponse.data?.data?.chatId;
        if (!chatId) throw new Error('CHAT_OPEN_FAILED');

        await client.post(`/api/chat/${chatId}/share-item`, { itemId });

        setSentIds((prev) => new Set(prev).add(target._id));
        onSent(itemId);
        showVelveToast({
          title: 'Poslato',
          message: `Artikal je poslat korisniku ${target.displayName}.`,
          tone: 'success',
        });
      } catch (error) {
        showVelveToast({
          title: 'Slanje nije uspelo',
          message: getApiErrorMessage(error, 'Pokusaj ponovo za nekoliko trenutaka.'),
          tone: 'error',
        });
      } finally {
        setSendingId(null);
      }
    },
    [itemId, onSent, sendingId]
  );

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <Pressable className="flex-1 justify-end bg-black/55 px-4 py-4" onPress={onClose}>
        <Pressable className="max-h-[70%] rounded-[34px] bg-surface-panel px-5 pb-6 pt-5">
          <View className="mb-4 items-center">
            <View className="h-1 w-10 rounded-full bg-ink-dark/20" />
          </View>
          <Text className="font-display text-[26px] text-ink-dark">Posalji artikal</Text>
          <Text className="mt-1 font-sans text-sm leading-6 text-ink-dark/62">
            Podeli ovaj komad sa nekim sa kim vec imas razgovor.
          </Text>

          {loading ? (
            <View className="items-center py-10">
              <ActivityIndicator color={colors.accentDeep} />
            </View>
          ) : targets.length === 0 ? (
            <View className="items-center py-10">
              <Ionicons name="chatbubbles-outline" size={34} color={colors.mutedText} />
              <Text className="mt-3 text-center font-sans text-sm leading-6 text-ink-dark/55">
                Jos nemas razgovore. Otvori profil korisnika i zapocni chat da bi delio artikle.
              </Text>
            </View>
          ) : (
            <FlatList
              data={targets}
              keyExtractor={(target) => target._id}
              className="mt-3"
              showsVerticalScrollIndicator={false}
              renderItem={({ item: target }) => {
                const alreadySent = sentIds.has(target._id);
                const isSending = sendingId === target._id;
                return (
                  <View className="flex-row items-center py-2.5">
                    {target.photoURL ? (
                      <RemoteImage
                        uri={target.photoURL}
                        className="h-11 w-11 rounded-full"
                        fallback={
                          <View className="h-full w-full items-center justify-center rounded-full bg-brand-accent-deep/10">
                            <Text className="font-display text-base text-brand-accent-deep">
                              {(target.displayName || '?').charAt(0).toUpperCase()}
                            </Text>
                          </View>
                        }
                      />
                    ) : (
                      <View className="h-11 w-11 items-center justify-center rounded-full bg-brand-accent-deep/10">
                        <Text className="font-display text-base text-brand-accent-deep">
                          {(target.displayName || '?').charAt(0).toUpperCase()}
                        </Text>
                      </View>
                    )}
                    <Text
                      className="ml-3 min-w-0 flex-1 font-sans text-[15px] font-semibold text-ink-dark"
                      numberOfLines={1}
                    >
                      {target.displayName}
                    </Text>
                    <TouchableOpacity
                      disabled={alreadySent || isSending}
                      onPress={() => handleSend(target)}
                      activeOpacity={0.86}
                      className={`min-w-[92px] items-center rounded-full px-4 py-2.5 ${
                        alreadySent ? 'bg-ink-dark/6' : 'bg-brand-accent-deep'
                      }`}
                    >
                      {isSending ? (
                        <ActivityIndicator size="small" color={colors.baseCanvas} />
                      ) : (
                        <Text
                          className={`font-sans text-[13px] font-semibold ${
                            alreadySent ? 'text-ink-dark/55' : 'text-base-canvas'
                          }`}
                        >
                          {alreadySent ? 'Poslato' : 'Posalji'}
                        </Text>
                      )}
                    </TouchableOpacity>
                  </View>
                );
              }}
            />
          )}
        </Pressable>
      </Pressable>
    </Modal>
  );
}
