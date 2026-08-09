import type { BottomTabBarProps } from '@react-navigation/bottom-tabs';
import { Text, TouchableOpacity, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Svg, { Line, Path, Rect } from 'react-native-svg';

import { colors } from '@/design/tokens';

const TAB_BAR_HEIGHT = 64;
const TAB_BAR_MAX_WIDTH = 362;
const TAB_SLOT_SIZE = 54;
const PLUS_SIZE = 54;

const visibleTabNames = ['feed', 'wishlist', 'upload', 'chat/index', 'profile'];
type VisibleTabName = (typeof visibleTabNames)[number];

function isVisibleTabName(name: string): name is VisibleTabName {
  return visibleTabNames.includes(name);
}

function FigmaTabIcon({
  name,
  color,
  active,
}: {
  name: VisibleTabName;
  color: string;
  active: boolean;
}) {
  if (name === 'upload') {
    return (
      <Svg width={28} height={28} viewBox="0 0 28 28" fill="none">
        <Rect x={13} y={5} width={2.5} height={18} rx={1.25} fill={colors.navPlus} />
        <Rect
          x={22}
          y={13}
          width={2.5}
          height={18}
          rx={1.25}
          transform="rotate(90 22 13)"
          fill={colors.navPlus}
        />
      </Svg>
    );
  }

  if (name === 'wishlist') {
    return (
      <Svg width={28} height={28} viewBox="105 26 28 28" fill="none">
        <Path
          d="M109.757 41.2984L118.424 48.168L118.424 48.168C118.678 48.3697 118.805 48.4705 118.952 48.4847C118.984 48.4878 119.016 48.4878 119.048 48.4847C119.195 48.4705 119.322 48.3697 119.577 48.168L128.244 41.2984C131.172 38.9772 131.512 34.657 128.983 31.9062C126.357 29.0506 121.71 29.5844 119.8 32.961L119.647 33.232C119.362 33.7348 118.638 33.7348 118.354 33.232L118.2 32.961C116.29 29.5844 111.643 29.0506 109.017 31.9062C106.488 34.657 106.828 38.9772 109.757 41.2984Z"
          stroke={color}
        />
      </Svg>
    );
  }

  if (name === 'chat/index') {
    return (
      <Svg width={28} height={28} viewBox="257 27 28 28" fill="none">
        <Path
          d="M281.125 30.0611C281.649 30.0117 282.193 30.0609 282.559 30.5026C282.924 30.9445 282.871 31.4882 282.725 31.9938C282.576 32.5049 282.278 33.1557 281.914 33.9547L277.012 44.7164C276.234 46.4228 275.629 47.7552 275.052 48.6539C274.48 49.5436 273.832 50.1753 272.917 50.1754C272.002 50.1754 271.354 49.5436 270.782 48.6539C270.205 47.7552 269.6 46.423 268.822 44.7164L268.031 42.982C267.731 42.3229 267.624 42.1007 267.467 41.9342C267.382 41.8439 267.285 41.7646 267.181 41.6979C266.988 41.5749 266.749 41.5102 266.045 41.3385C263.789 40.7882 262.063 40.3671 260.857 39.9596C260.254 39.7557 259.753 39.5462 259.369 39.3102C258.988 39.0757 258.672 38.7836 258.522 38.3932C258.302 37.818 258.302 37.1812 258.522 36.6061C258.672 36.2158 258.988 35.9235 259.369 35.6891C259.753 35.453 260.254 35.2435 260.857 35.0397C262.063 34.6322 263.789 34.211 266.045 33.6608L279.047 30.4899C279.9 30.2818 280.595 30.1112 281.125 30.0611ZM281.219 31.0563C280.779 31.0978 280.17 31.2455 279.284 31.4615L266.282 34.6324C264.006 35.1876 262.332 35.5968 261.178 35.9869C260.601 36.1818 260.182 36.3631 259.894 36.5406C259.603 36.7197 259.494 36.8641 259.456 36.9635C259.324 37.3086 259.324 37.6907 259.456 38.0358C259.494 38.1351 259.602 38.2794 259.894 38.4586C260.182 38.6362 260.601 38.8174 261.178 39.0123C262.332 39.4025 264.006 39.8116 266.282 40.3668C266.92 40.5223 267.352 40.6214 267.718 40.8541C267.892 40.9653 268.052 41.098 268.194 41.2486C268.491 41.5638 268.67 41.9702 268.941 42.567L269.731 44.3024C270.523 46.0397 271.094 47.2907 271.623 48.1139C272.158 48.9462 272.546 49.1754 272.917 49.1754C273.288 49.1753 273.676 48.946 274.211 48.1139C274.74 47.2907 275.311 46.0396 276.103 44.3024L281.005 33.5406C281.383 32.7107 281.642 32.1394 281.765 31.7154C281.889 31.2861 281.821 31.1805 281.788 31.1403C281.755 31.0998 281.663 31.0144 281.219 31.0563Z"
          fill={color}
        />
      </Svg>
    );
  }

  if (name === 'profile') {
    return (
      <Svg width={28} height={28} viewBox="328 28 28 28" fill="none">
        <Path
          d="M341.5 29.8333C344.063 29.8334 346.166 31.9821 346.167 34.6663C346.167 37.3506 344.063 39.5001 341.5 39.5002C338.938 39.5002 336.833 37.3507 336.833 34.6663C336.834 31.982 338.938 29.8333 341.5 29.8333Z"
          stroke={color}
          strokeLinecap="round"
        />
        <Path
          d="M332.61 45.4752C333.433 43.1428 335.844 42 338.317 42H344.683C347.156 42 349.567 43.1428 350.39 45.4752C350.747 46.4855 351.045 47.6779 351.148 49.0001C351.191 49.5507 350.74 50 350.187 50H332.813C332.26 50 331.809 49.5507 331.852 49.0001C331.955 47.6779 332.253 46.4855 332.61 45.4752Z"
          stroke={color}
          strokeLinecap="round"
        />
        {active ? <Line x1={333} y1={52.5} x2={350} y2={52.5} stroke={color} /> : null}
      </Svg>
    );
  }

  return (
    <Svg width={28} height={28} viewBox="41 27 28 28" fill="none">
      <Path
        d="M45.0835 39.4178C45.0835 37.7772 45.0835 36.9569 45.4723 36.2358C45.8611 35.5147 46.5913 34.9809 48.0518 33.9132L49.4684 32.8775C52.1081 30.9476 53.428 29.9827 55.0002 29.9827C56.5723 29.9827 57.8922 30.9476 60.5319 32.8775L61.9486 33.9132C63.409 34.9809 64.1392 35.5147 64.528 36.2358C64.9168 36.9569 64.9168 37.7772 64.9168 39.4178V44.5416C64.9168 46.82 64.9168 47.9593 64.087 48.6671C63.2571 49.3749 61.9215 49.3749 59.2502 49.3749H50.7502C48.0789 49.3749 46.7432 49.3749 45.9134 48.6671C45.0835 47.9593 45.0835 46.82 45.0835 44.5416V39.4178Z"
        stroke={color}
      />
      <Path
        d="M58.5418 49.375V43.125C58.5418 42.5727 58.0941 42.125 57.5418 42.125H52.4585C51.9062 42.125 51.4585 42.5727 51.4585 43.125V49.375"
        stroke={color}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </Svg>
  );
}

function Badge({ value, tone = 'deep' }: { value: number; tone?: 'deep' | 'highlight' }) {
  if (value <= 0) return null;

  return (
    <View
      className={`absolute -right-1 top-0 min-w-[18px] items-center justify-center rounded-full px-1 ${
        tone === 'highlight' ? 'bg-brand-highlight' : 'bg-brand-accent-deep'
      }`}
      style={{ height: 18 }}
    >
      <Text
        className={`font-sans text-[10px] font-bold ${
          tone === 'highlight' ? 'text-ink-dark' : 'text-base-canvas'
        }`}
      >
        {value > 99 ? '99+' : value}
      </Text>
    </View>
  );
}

export function VelveTabBar({ state, descriptors, navigation }: BottomTabBarProps) {
  const insets = useSafeAreaInsets();
  const bottomOffset = Math.max(insets.bottom, 12);
  const visibleRoutes = state.routes.filter((route) => visibleTabNames.includes(route.name));

  if (visibleRoutes.length === 0) return null;

  return (
    <View
      pointerEvents="box-none"
      className="absolute inset-x-0 bottom-0"
      style={{ height: bottomOffset + 96 }}
    >
      <View
        className="absolute self-center rounded-full"
        style={{
          bottom: bottomOffset,
          height: TAB_BAR_HEIGHT,
          width: '91%',
          maxWidth: TAB_BAR_MAX_WIDTH,
          backgroundColor: colors.navDark,
          shadowColor: colors.navShadow,
          shadowOpacity: 0.35,
          shadowRadius: 24,
          shadowOffset: { width: 0, height: 10 },
          elevation: 14,
        }}
      >
        <View className="h-full flex-row items-center justify-between px-[20px]">
          {visibleRoutes.map((route) => {
            const routeIndex = state.routes.findIndex((candidate) => candidate.key === route.key);
            const isFocused = state.index === routeIndex;
            const options = descriptors[route.key]?.options;
            const isUpload = route.name === 'upload';
            const badge =
              typeof options?.tabBarBadge === 'number' ? Number(options.tabBarBadge) : undefined;
            if (!isVisibleTabName(route.name)) return null;

            const iconColor = isUpload
              ? colors.navPlus
              : isFocused
                ? colors.navPink
                : colors.baseCanvas;

            const onPress = () => {
              const event = navigation.emit({
                type: 'tabPress',
                target: route.key,
                canPreventDefault: true,
              });

              if (!isFocused && !event.defaultPrevented) {
                navigation.navigate(route.name, route.params);
              }
            };

            const onLongPress = () => {
              navigation.emit({
                type: 'tabLongPress',
                target: route.key,
              });
            };

            return (
              <TouchableOpacity
                key={route.key}
                accessibilityRole="button"
                accessibilityState={isFocused ? { selected: true } : {}}
                accessibilityLabel={options?.tabBarAccessibilityLabel}
                activeOpacity={0.78}
                onPress={onPress}
                onLongPress={onLongPress}
                className="items-center justify-center"
                style={{ width: TAB_SLOT_SIZE, height: TAB_SLOT_SIZE }}
              >
                <View
                  className="items-center justify-center rounded-full"
                  style={
                    isUpload
                      ? {
                          width: PLUS_SIZE,
                          height: PLUS_SIZE,
                          backgroundColor: colors.navPink,
                          shadowColor: colors.navPink,
                          shadowOpacity: 0.4,
                          shadowRadius: 16,
                          shadowOffset: { width: 0, height: 6 },
                          elevation: 10,
                        }
                      : { width: TAB_SLOT_SIZE, height: TAB_SLOT_SIZE }
                  }
                >
                  <FigmaTabIcon name={route.name} color={iconColor} active={isFocused} />
                </View>
                {badge ? (
                  <Badge value={badge} tone={route.name === 'profile' ? 'highlight' : 'deep'} />
                ) : null}
              </TouchableOpacity>
            );
          })}
        </View>
      </View>
    </View>
  );
}
