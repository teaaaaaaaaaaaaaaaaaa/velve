const express = require('express');
const mongoose = require('mongoose');
const { Expo } = require('expo-server-sdk');
const router = express.Router();
const { requireAuth, maybeAuth } = require('../middleware/auth');
const User = require('../models/User');
const Item = require('../models/Item');
const Follow = require('../models/Follow');
const BlockedUser = require('../models/BlockedUser');
const Report = require('../models/Report');
const TradeRequest = require('../models/TradeRequest');
const ItemView = require('../models/ItemView');
const { enrichItems } = require('../lib/enrichItems');
const { imageUpload } = require('../lib/uploadMiddleware');
const { createBodyScanKey, deleteObject, keyFromUrl, uploadBuffer } = require('../lib/r2');
const {
  getDiscoverySignals,
  getBehavioralAffinity,
  getVisualSimilarity,
} = require('../lib/discovery');

const LIVE_ITEM_STATUSES = ['available', 'pending_trade', 'unavailable'];
const DRAFT_ITEM_STATUSES = ['draft'];
const ARCHIVE_ITEM_STATUSES = ['archived', 'sold', 'swapped', 'traded'];
const AI_SERVER_URL = process.env.AI_SERVER_URL || 'http://localhost:8000';
const BODY_SCAN_ANALYSIS_TIMEOUT_MS = 45000;
const DEFAULT_NOTIFICATION_PREFERENCES = {
  allPush: true,
  likes: true,
  follows: true,
  trades: true,
  messages: true,
  ratings: true,
  marketing: false,
};

function buildOnboardingUpdates(body = {}) {
  const { stylePreferences, favoriteBrands, categories, sizes, location } = body;

  const hasOnboardingPayload = [stylePreferences, favoriteBrands, categories, sizes, location].some(
    (value) => value !== undefined
  );

  if (!hasOnboardingPayload) {
    return null;
  }

  const updates = {
    onboardingCompleted: true,
  };

  if (Array.isArray(stylePreferences)) {
    updates.stylePreferences = stylePreferences.slice(0, 20);
  }

  if (Array.isArray(favoriteBrands)) {
    updates.favoriteBrands = favoriteBrands.slice(0, 20);
  }

  if (Array.isArray(categories)) {
    updates.categories = categories.slice(0, 20);
  }

  if (sizes && typeof sizes === 'object') {
    updates.sizes = {
      clothing: sizes.clothing ? String(sizes.clothing).slice(0, 10) : '',
      shoes: sizes.shoes ? String(sizes.shoes).slice(0, 10) : '',
    };
  }

  if (location && typeof location === 'object') {
    updates.location = {
      city: location.city ? String(location.city).slice(0, 100) : '',
      region: location.region ? String(location.region).slice(0, 100) : '',
    };
  }

  return updates;
}

function calculateProfileCompleteness(user = {}) {
  let score = 0;

  score += 13.3;
  if (user.photoURL) score += 13.3;
  if (user.bio) score += 13.3;

  if (Array.isArray(user.stylePreferences) && user.stylePreferences.length > 0) score += 10;
  if (Array.isArray(user.categories) && user.categories.length > 0) score += 10;
  if (Array.isArray(user.favoriteBrands) && user.favoriteBrands.length > 0) score += 10;
  if (user.sizes?.clothing) score += 10;
  if (user.sizes?.shoes) score += 10;
  if (user.location?.city) score += 10;

  return Math.round(score);
}

function sortItemsByRequestedIds(items, sortedIds) {
  const order = new Map(sortedIds.map((id, index) => [String(id), index]));
  return [...items].sort((a, b) => {
    return (
      (order.get(String(a._id)) ?? Number.MAX_SAFE_INTEGER) -
      (order.get(String(b._id)) ?? Number.MAX_SAFE_INTEGER)
    );
  });
}

function getFreshnessScore(createdAt) {
  const ageMs = Date.now() - new Date(createdAt).getTime();
  const ageDays = ageMs / (1000 * 60 * 60 * 24);
  return Math.max(0, 1 - ageDays / 45);
}

async function buildTrustMetrics(user) {
  const incomingTrades = await TradeRequest.find({ receiverId: user._id })
    .select('status cancelledBy')
    .lean();

  let measurableRequests = 0;
  let respondedRequests = 0;

  for (const trade of incomingTrades) {
    if (trade.status === 'accepted' || trade.status === 'rejected') {
      measurableRequests += 1;
      respondedRequests += 1;
      continue;
    }

    if (trade.status === 'expired') {
      measurableRequests += 1;
      continue;
    }

    if (trade.status === 'cancelled' && trade.cancelledBy === 'receiver') {
      measurableRequests += 1;
      respondedRequests += 1;
    }
  }

  return {
    joinedAt: user.createdAt,
    responseRate:
      measurableRequests > 0 ? Math.round((respondedRequests / measurableRequests) * 100) : null,
    successfulSwaps: user.completedTrades || 0,
    profileCompleteness: calculateProfileCompleteness(user),
  };
}

async function buildClosetCounts(userId) {
  const [live, drafts, archive, publicItems] = await Promise.all([
    Item.countDocuments({
      userId,
      isDeleted: false,
      status: { $in: LIVE_ITEM_STATUSES },
    }),
    Item.countDocuments({
      userId,
      isDeleted: false,
      status: { $in: DRAFT_ITEM_STATUSES },
    }),
    Item.countDocuments({
      userId,
      $or: [{ isDeleted: true }, { status: { $in: ARCHIVE_ITEM_STATUSES } }],
    }),
    Item.countDocuments({
      userId,
      isDeleted: false,
      status: 'available',
    }),
  ]);

  return {
    live,
    drafts,
    archive,
    publicItems,
  };
}

async function buildUserProfilePayload(userDoc, viewerId = null) {
  const user = typeof userDoc.toObject === 'function' ? userDoc.toObject() : { ...userDoc };

  const isSelf = viewerId ? String(viewerId) === String(user._id) : false;

  const [followersCount, followingCount, closetCounts, trustMetrics, isFollowing] =
    await Promise.all([
      Follow.countDocuments({ followingId: user._id }),
      Follow.countDocuments({ followerId: user._id }),
      buildClosetCounts(user._id),
      buildTrustMetrics(user),
      viewerId && !isSelf ? Follow.exists({ followerId: viewerId, followingId: user._id }) : false,
    ]);

  return {
    ...user,
    followersCount,
    followingCount,
    itemsCount: isSelf ? closetCounts.live + closetCounts.drafts : closetCounts.publicItems,
    closetCounts: {
      live: closetCounts.live,
      drafts: closetCounts.drafts,
      archive: closetCounts.archive,
    },
    ...trustMetrics,
    isFollowing: Boolean(isFollowing),
    isSelf,
  };
}

function normalizeNotificationPreferences(preferences = {}) {
  const normalized = { ...DEFAULT_NOTIFICATION_PREFERENCES };

  for (const key of Object.keys(DEFAULT_NOTIFICATION_PREFERENCES)) {
    if (preferences[key] !== undefined) {
      normalized[key] = Boolean(preferences[key]);
    }
  }

  return normalized;
}

async function buildConnectionPayload({ userId, mode, viewerId }) {
  const query = mode === 'followers' ? { followingId: userId } : { followerId: userId };
  const populatePath = mode === 'followers' ? 'followerId' : 'followingId';
  const connections = await Follow.find(query)
    .sort({ createdAt: -1 })
    .populate(populatePath, 'displayName photoURL bio averageRating completedTrades location')
    .lean();

  const users = connections.map((entry) => entry[populatePath]).filter(Boolean);
  const viewerFollowing =
    users.length > 0
      ? await Follow.find({
          followerId: viewerId,
          followingId: { $in: users.map((user) => user._id) },
        })
          .select('followingId')
          .lean()
      : [];
  const followingIds = new Set(viewerFollowing.map((entry) => String(entry.followingId)));

  return users.map((user) => ({
    ...user,
    isSelf: String(user._id) === String(viewerId),
    isFollowing: followingIds.has(String(user._id)),
  }));
}

async function saveCurrentUser(req, res, updates) {
  const updated = await User.findByIdAndUpdate(req.dbUser._id, updates, { new: true });
  const payload = await buildUserProfilePayload(updated, req.dbUser._id);
  res.json({ ok: true, data: payload });
}

async function analyzeBodyScanFile(file) {
  if (!file) {
    throw new Error('Image file is required');
  }

  const formData = new FormData();
  formData.append(
    'file',
    new Blob([file.buffer], { type: file.mimetype }),
    file.originalname || 'body-scan.jpg'
  );

  const response = await fetch(`${AI_SERVER_URL}/analyze-body-scan`, {
    method: 'POST',
    body: formData,
    signal: AbortSignal.timeout(BODY_SCAN_ANALYSIS_TIMEOUT_MS),
  });

  if (!response.ok) {
    let message = 'Body scan validation failed';
    try {
      const errorBody = await response.json();
      message = errorBody.detail || errorBody.error || message;
    } catch {
      message = await response.text();
    }
    throw new Error(message);
  }

  return response.json();
}

async function readAiErrorBody(response) {
  try {
    const errorBody = await response.json();
    return errorBody.detail || errorBody.error || JSON.stringify(errorBody);
  } catch {
    return response.text();
  }
}

async function removeBodyScanBackground(file) {
  if (!file) {
    throw new Error('Image file is required');
  }

  const formData = new FormData();
  formData.append(
    'file',
    new Blob([file.buffer], { type: file.mimetype }),
    file.originalname || 'body-scan.jpg'
  );

  const response = await fetch(`${AI_SERVER_URL}/remove-background`, {
    method: 'POST',
    body: formData,
    signal: AbortSignal.timeout(BODY_SCAN_ANALYSIS_TIMEOUT_MS),
  });

  if (!response.ok) {
    const message = await readAiErrorBody(response);
    throw new Error(message || 'Body scan background removal failed');
  }

  return Buffer.from(await response.arrayBuffer());
}

async function buildRecentlyViewedItems(userId, limit = 8) {
  const [signals, recentViews] = await Promise.all([
    getDiscoverySignals(userId),
    ItemView.find({ userId })
      .sort({ lastViewedAt: -1 })
      .limit(Math.max(limit * 3, 12))
      .select('itemId')
      .lean(),
  ]);

  const recentIds = [...new Set(recentViews.map((entry) => String(entry.itemId)))];
  if (recentIds.length === 0) {
    return [];
  }

  const blockedObjectIds = signals.blockedUserIds
    .filter((id) => mongoose.Types.ObjectId.isValid(id))
    .map((id) => new mongoose.Types.ObjectId(id));
  const hiddenObjectIds = signals.hiddenItemIds
    .filter((id) => mongoose.Types.ObjectId.isValid(id))
    .map((id) => new mongoose.Types.ObjectId(id));

  const items = await Item.find({
    _id: {
      $in: recentIds
        .filter((id) => mongoose.Types.ObjectId.isValid(id))
        .map((id) => new mongoose.Types.ObjectId(id)),
      ...(hiddenObjectIds.length > 0 ? { $nin: hiddenObjectIds } : {}),
    },
    userId: {
      $nin: [userId, ...blockedObjectIds],
    },
    status: 'available',
    isDeleted: false,
  })
    .populate('userId', 'displayName photoURL averageRating completedTrades location')
    .lean();

  const sortedItems = sortItemsByRequestedIds(items, recentIds).slice(0, limit);
  return enrichItems(sortedItems, userId);
}

async function buildRecommendedItems(userId, limit = 10) {
  const [signals, recentViews] = await Promise.all([
    getDiscoverySignals(userId),
    ItemView.find({ userId }).sort({ lastViewedAt: -1 }).limit(20).select('itemId').lean(),
  ]);

  const recentViewIds = recentViews
    .map((entry) => String(entry.itemId))
    .filter((id) => mongoose.Types.ObjectId.isValid(id));

  const blockedObjectIds = signals.blockedUserIds
    .filter((id) => mongoose.Types.ObjectId.isValid(id))
    .map((id) => new mongoose.Types.ObjectId(id));
  const excludedItemIds = [...signals.hiddenItemIds, ...recentViewIds]
    .filter((id) => mongoose.Types.ObjectId.isValid(id))
    .map((id) => new mongoose.Types.ObjectId(id));

  const candidates = await Item.find({
    status: 'available',
    isDeleted: false,
    userId: { $nin: [userId, ...blockedObjectIds] },
    ...(excludedItemIds.length > 0 ? { _id: { $nin: excludedItemIds } } : {}),
  })
    .sort({ createdAt: -1, _id: -1 })
    .limit(120)
    .populate('userId', 'displayName photoURL averageRating completedTrades location')
    .lean();

  if (candidates.length === 0) {
    return [];
  }

  const scoredCandidates = candidates
    .map((item) => {
      const behavioralScore = getBehavioralAffinity(item, signals);
      const visualScore = getVisualSimilarity(item, signals);
      const freshnessScore = getFreshnessScore(item.createdAt);
      const recommendationScore =
        behavioralScore * 0.55 + visualScore * 0.3 + freshnessScore * 0.15;

      return {
        ...item,
        recommendationScore,
      };
    })
    .sort((a, b) => {
      if (b.recommendationScore !== a.recommendationScore) {
        return b.recommendationScore - a.recommendationScore;
      }
      return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
    });

  const hasMeaningfulSignals = scoredCandidates.some((item) => item.recommendationScore > 0.05);
  const selectedItems = (hasMeaningfulSignals ? scoredCandidates : candidates).slice(0, limit);

  return enrichItems(selectedItems, userId);
}

// GET /api/users/me - current signed-in user profile
router.get('/me', requireAuth, async (req, res) => {
  try {
    console.log('[Users/me] Building current user payload', {
      uid: req.user?.uid || null,
      dbUserId: req.dbUser?._id || null,
      onboardingCompleted: req.dbUser?.onboardingCompleted || false,
    });
    const payload = await buildUserProfilePayload(req.dbUser, req.dbUser._id);
    console.log('[Users/me] Returning current user payload', {
      userId: payload?._id || null,
      firebaseUid: payload?.firebaseUid || null,
      itemsCount: payload?.itemsCount ?? null,
      onboardingCompleted: payload?.onboardingCompleted || false,
    });
    res.json({ ok: true, data: payload });
  } catch (err) {
    console.error('[Users/me] Failed to build current user payload', {
      message: err.message,
      stack: err.stack,
    });
    res.status(500).json({ error: err.message });
  }
});

// GET /api/users/me/modules - recently viewed + recommendations for profile modules
router.get('/me/modules', requireAuth, async (req, res) => {
  try {
    const [recentlyViewed, recommended] = await Promise.all([
      buildRecentlyViewedItems(req.dbUser._id, 8),
      buildRecommendedItems(req.dbUser._id, 10),
    ]);

    res.json({
      ok: true,
      data: {
        recentlyViewed,
        recommended,
      },
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// PUT /api/users/me - update profile
router.put('/me', requireAuth, async (req, res) => {
  try {
    const allowed = ['displayName', 'bio', 'photoURL'];
    const updates = {};
    for (const key of allowed) {
      if (req.body[key] !== undefined) {
        updates[key] = req.body[key];
      }
    }

    if (updates.displayName) updates.displayName = updates.displayName.slice(0, 50);
    if (updates.bio) updates.bio = updates.bio.slice(0, 200);

    const onboardingUpdates = buildOnboardingUpdates(req.body);
    if (onboardingUpdates) {
      Object.assign(updates, onboardingUpdates);
    }

    await saveCurrentUser(req, res, updates);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// PUT /api/users/me/push-token - save Expo push token
router.put('/me/push-token', requireAuth, async (req, res) => {
  try {
    const { token } = req.body;
    if (!token) {
      return res.status(400).json({ error: 'token is required' });
    }
    if (!Expo.isExpoPushToken(token)) {
      return res.status(400).json({ error: 'Invalid Expo push token' });
    }

    await User.findByIdAndUpdate(req.dbUser._id, { expoPushToken: token });
    res.json({ ok: true, message: 'Push token saved' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/me/notification-preferences', requireAuth, async (req, res) => {
  try {
    res.json({
      ok: true,
      data: normalizeNotificationPreferences(req.dbUser.notificationPreferences || {}),
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.put('/me/notification-preferences', requireAuth, async (req, res) => {
  try {
    const preferences = normalizeNotificationPreferences({
      ...(req.dbUser.notificationPreferences || {}),
      ...(req.body || {}),
    });

    await User.findByIdAndUpdate(req.dbUser._id, { notificationPreferences: preferences });
    res.json({ ok: true, data: preferences });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/me/blocked-users', requireAuth, async (req, res) => {
  try {
    const blocks = await BlockedUser.find({ userId: req.dbUser._id })
      .sort({ createdAt: -1 })
      .populate('blockedUserId', 'displayName photoURL bio averageRating completedTrades location')
      .lean();

    res.json({
      ok: true,
      data: blocks
        .filter((entry) => entry.blockedUserId)
        .map((entry) => ({
          _id: entry._id,
          createdAt: entry.createdAt,
          reason: entry.reason || '',
          user: entry.blockedUserId,
        })),
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/:id/followers', requireAuth, async (req, res) => {
  try {
    if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
      return res.status(400).json({ error: 'Invalid user ID' });
    }

    const data = await buildConnectionPayload({
      userId: req.params.id,
      mode: 'followers',
      viewerId: req.dbUser._id,
    });
    res.json({ ok: true, data });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/:id/following', requireAuth, async (req, res) => {
  try {
    if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
      return res.status(400).json({ error: 'Invalid user ID' });
    }

    const data = await buildConnectionPayload({
      userId: req.params.id,
      mode: 'following',
      viewerId: req.dbUser._id,
    });
    res.json({ ok: true, data });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/body-scan', requireAuth, async (req, res) => {
  try {
    res.json({
      ok: true,
      data: {
        exists: !!req.dbUser.bodyScanUrl,
        url: req.dbUser.bodyScanUrl || null,
        createdAt: req.dbUser.bodyScanCreatedAt || null,
      },
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/body-scan', requireAuth, imageUpload.single('image'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'image is required' });
    }

    let analysis = null;
    try {
      analysis = await analyzeBodyScanFile(req.file);
    } catch (error) {
      console.warn('[Users/body-scan] Body scan analysis skipped', {
        userId: String(req.dbUser?._id || ''),
        message: error.message,
      });
    }

    let uploadBufferPayload = req.file.buffer;
    let uploadContentType = req.file.mimetype || 'image/jpeg';
    let backgroundRemoved = false;

    try {
      uploadBufferPayload = await removeBodyScanBackground(req.file);
      uploadContentType = 'image/png';
      backgroundRemoved = true;
    } catch (error) {
      console.warn('[Users/body-scan] Background removal skipped', {
        userId: String(req.dbUser?._id || ''),
        message: error.message,
      });
    }

    const key = createBodyScanKey(
      req.dbUser._id,
      uploadContentType === 'image/png' ? '.png' : '.jpg'
    );
    const uploadResult = await uploadBuffer({
      key,
      buffer: uploadBufferPayload,
      contentType: uploadContentType,
    });

    const bodyScanCreatedAt = new Date();
    await User.findByIdAndUpdate(req.dbUser._id, {
      bodyScanUrl: uploadResult.url,
      bodyScanCreatedAt,
    });

    res.status(201).json({
      ok: true,
      data: {
        url: uploadResult.url,
        createdAt: bodyScanCreatedAt,
        analysis,
        validated: Boolean(analysis?.ready),
        backgroundRemoved,
      },
    });
  } catch (err) {
    res.status(500).json({
      error: err.message || 'Body scan trenutno nije moguce sacuvati.',
    });
  }
});

router.delete('/body-scan', requireAuth, async (req, res) => {
  try {
    const existingUrl = req.dbUser.bodyScanUrl || '';

    if (existingUrl) {
      try {
        await deleteObject(keyFromUrl(existingUrl));
      } catch (error) {
        console.warn('[Users/body-scan] Failed to delete body scan file from R2', {
          userId: String(req.dbUser?._id || ''),
          message: error.message,
        });
      }
    }

    await User.findByIdAndUpdate(req.dbUser._id, {
      $unset: {
        bodyScanUrl: 1,
        bodyScanCreatedAt: 1,
      },
    });

    res.json({ ok: true, message: 'Body scan deleted' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// PUT /api/users/me/onboarding - complete onboarding
async function handleOnboardingUpdate(req, res) {
  try {
    const updates = buildOnboardingUpdates(req.body);
    if (!updates) {
      return res.status(400).json({ error: 'Onboarding payload is required' });
    }

    await saveCurrentUser(req, res, updates);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}

router.put('/me/onboarding', requireAuth, handleOnboardingUpdate);
router.post('/me/onboarding', requireAuth, handleOnboardingUpdate);
router.patch('/me/onboarding', requireAuth, handleOnboardingUpdate);

// POST /api/users/:id/block - block another user
router.post('/:id/block', requireAuth, async (req, res) => {
  try {
    if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
      return res.status(400).json({ error: 'Invalid user ID' });
    }

    if (String(req.params.id) === String(req.dbUser._id)) {
      return res.status(400).json({ error: 'You cannot block yourself' });
    }

    const targetUser = await User.findById(req.params.id).lean();
    if (!targetUser) {
      return res.status(404).json({ error: 'User not found' });
    }

    const block = await BlockedUser.findOneAndUpdate(
      { userId: req.dbUser._id, blockedUserId: req.params.id },
      {
        userId: req.dbUser._id,
        blockedUserId: req.params.id,
        reason: String(req.body.reason || '').slice(0, 200),
      },
      { upsert: true, new: true, setDefaultsOnInsert: true }
    );

    res.json({ ok: true, data: block });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// DELETE /api/users/:id/block - unblock user
router.delete('/:id/block', requireAuth, async (req, res) => {
  try {
    if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
      return res.status(400).json({ error: 'Invalid user ID' });
    }

    await BlockedUser.deleteOne({
      userId: req.dbUser._id,
      blockedUserId: req.params.id,
    });

    res.json({ ok: true, message: 'User unblocked' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/users/:id/report - report a profile
router.post('/:id/report', requireAuth, async (req, res) => {
  try {
    if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
      return res.status(400).json({ error: 'Invalid user ID' });
    }

    if (String(req.params.id) === String(req.dbUser._id)) {
      return res.status(400).json({ error: 'You cannot report yourself' });
    }

    const targetUser = await User.findById(req.params.id).lean();
    if (!targetUser) {
      return res.status(404).json({ error: 'User not found' });
    }

    const reason = String(req.body.reason || '')
      .trim()
      .slice(0, 100);
    if (!reason) {
      return res.status(400).json({ error: 'reason is required' });
    }

    const report = await Report.create({
      reporterId: req.dbUser._id,
      targetType: 'user',
      targetUserId: req.params.id,
      reason,
      details: String(req.body.details || '')
        .trim()
        .slice(0, 500),
    });

    res.status(201).json({ ok: true, data: report });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/users/:id - public user profile
router.get('/:id', maybeAuth, async (req, res) => {
  try {
    if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
      return res.status(400).json({ error: 'Invalid user ID' });
    }

    if (req.dbUser) {
      const isBlockedRelation = await BlockedUser.exists({
        $or: [
          { userId: req.dbUser._id, blockedUserId: req.params.id },
          { userId: req.params.id, blockedUserId: req.dbUser._id },
        ],
      });

      if (isBlockedRelation) {
        return res.status(404).json({ error: 'User not found' });
      }
    }

    const user = await User.findById(req.params.id)
      .select('-firebaseUid -expoPushToken -email')
      .lean();
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    const payload = await buildUserProfilePayload(user, req.dbUser?._id || null);
    res.json({ ok: true, data: payload });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
