const path = require('path')
require('dotenv').config({ path: path.resolve(__dirname, '..', '.env') })

const mongoose = require('mongoose')
const User = require('../src/models/User')
const Item = require('../src/models/Item')
const Like = require('../src/models/Like')
const Wishlist = require('../src/models/Wishlist')

const COMMONS_API_URL = 'https://commons.wikimedia.org/w/api.php'
const AI_SERVER_URL = process.env.AI_SERVER_URL || 'http://localhost:8000'
const USE_COMMONS_LOOKUP = process.env.SEED_LOOKUP_IMAGES === 'true'

const SEED_USERS = [
  {
    key: 'anja',
    firebaseUid: 'seed-anja-curates',
    email: 'seed.anja@velve.dev',
    displayName: 'anja.curates',
    bio: 'Soft tailoring, quiet luxury, clean city layers.',
    averageRating: 4.9,
    totalRatings: 34,
    completedTrades: 18,
    onboardingCompleted: true,
    stylePreferences: ['minimal', 'tailored', 'soft neutrals'],
    favoriteBrands: ['COS', 'Arket', 'Massimo Dutti'],
    categories: ['outerwear', 'bags', 'dresses'],
    sizes: { clothing: 'S', shoes: '38' },
    location: { city: 'Beograd', region: 'Srbija' },
  },
  {
    key: 'mila',
    firebaseUid: 'seed-mila-softcore',
    email: 'seed.mila@velve.dev',
    displayName: 'mila.softcore',
    bio: 'Dreamy knits, soft layers and romantic staples.',
    averageRating: 4.8,
    totalRatings: 29,
    completedTrades: 14,
    onboardingCompleted: true,
    stylePreferences: ['romantic', 'soft textures', 'feminine'],
    favoriteBrands: ['Mango', 'Reserved', 'Zara'],
    categories: ['tops', 'dresses', 'knitwear'],
    sizes: { clothing: 'M', shoes: '39' },
    location: { city: 'Novi Sad', region: 'Srbija' },
  },
  {
    key: 'teo',
    firebaseUid: 'seed-teo-street',
    email: 'seed.teo@velve.dev',
    displayName: 'teo.street',
    bio: 'Streetwear, utility silhouettes and clean sneakers.',
    averageRating: 4.7,
    totalRatings: 22,
    completedTrades: 12,
    onboardingCompleted: true,
    stylePreferences: ['streetwear', 'utility', 'sport'],
    favoriteBrands: ['Nike', 'Weekday', 'Carhartt'],
    categories: ['hoodies', 'pants', 'shoes'],
    sizes: { clothing: 'L', shoes: '43' },
    location: { city: 'Nis', region: 'Srbija' },
  },
  {
    key: 'luka',
    firebaseUid: 'seed-luka-archive',
    email: 'seed.luka@velve.dev',
    displayName: 'luka.archive',
    bio: 'Vintage archive, denim and sharp second-hand finds.',
    averageRating: 4.9,
    totalRatings: 41,
    completedTrades: 21,
    onboardingCompleted: true,
    stylePreferences: ['vintage', 'archive', 'denim'],
    favoriteBrands: ['Levis', 'Acne Studios', 'Diesel'],
    categories: ['denim', 'outerwear', 'shoes'],
    sizes: { clothing: 'M', shoes: '42' },
    location: { city: 'Subotica', region: 'Srbija' },
  },
]

const SEED_ITEMS = [
  {
    ownerKey: 'anja',
    title: 'Soft tailored blazer',
    description: 'Lagani sako sa cistom siluetom i dovoljno prostora za slojevito stilizovanje preko majice ili slip haljine.',
    category: 'outerwear',
    brand: 'COS',
    size: 'S',
    condition: 'like_new',
    listingType: 'both',
    price: 54,
    tradeFor: 'minimalna jakna ili kvalitetna torba',
    imageQuery: 'blazer woman fashion',
    fallbackImageUrl: 'https://upload.wikimedia.org/wikipedia/commons/0/0a/From_Spain_post_%2851909266400%29.jpg',
  },
  {
    ownerKey: 'luka',
    title: 'Vintage denim jacket',
    description: 'Klasicna teksas jakna sa vintage pranjem i malo sirom formom za svakodnevni layering.',
    category: 'outerwear',
    brand: 'Levis',
    size: 'M',
    condition: 'good',
    listingType: 'trade',
    tradeFor: 'hoodie ili ravne farmerke',
    imageQuery: 'denim jacket model',
    fallbackImageUrl: 'https://upload.wikimedia.org/wikipedia/commons/a/a1/Laughing_woman_in_jean_jacket_%28Unsplash%29.jpg',
  },
  {
    ownerKey: 'mila',
    title: 'Little black slip dress',
    description: 'Jednostavna crna haljina koja radi i za nocni izlazak i za slojevite dnevne kombinacije.',
    category: 'dresses',
    brand: 'Mango',
    size: 'M',
    condition: 'new',
    listingType: 'sell',
    price: 38,
    imageQuery: 'black mini dress fashion photo',
    fallbackImageUrl: 'https://upload.wikimedia.org/wikipedia/commons/e/e1/Little_Black_Dress_%28Unsplash%29.jpg',
  },
  {
    ownerKey: 'teo',
    title: 'White court sneakers',
    description: 'Ciste bele patike koje podizu i streetwear i smart-casual kombinacije.',
    category: 'shoes',
    brand: 'Nike',
    size: '43',
    condition: 'good',
    listingType: 'sell',
    price: 49,
    imageQuery: 'white sneakers shoes',
    fallbackImageUrl: 'https://upload.wikimedia.org/wikipedia/commons/3/3a/Black_white_sneakers_logo_%28Unsplash%29.jpg',
  },
  {
    ownerKey: 'anja',
    title: 'Mini leather shoulder bag',
    description: 'Kompaktna torba za svaki dan, taman za telefon, novcanik i essentials.',
    category: 'bags',
    brand: 'Zara',
    size: 'One size',
    condition: 'like_new',
    listingType: 'both',
    price: 31,
    tradeFor: 'statement nakit ili mokasine',
    imageQuery: 'black leather handbag',
    fallbackImageUrl: 'https://upload.wikimedia.org/wikipedia/commons/a/a4/Handbag_%28AM_2016.7.17-1%29.jpg',
  },
  {
    ownerKey: 'teo',
    title: 'Soft gray hoodie',
    description: 'Deblji duks sa kapuljacom, idealan za utility ili relaxed look.',
    category: 'tops',
    brand: 'Weekday',
    size: 'L',
    condition: 'good',
    listingType: 'trade',
    tradeFor: 'oversized jakna ili cargo pantalone',
    imageQuery: 'hoodie unsplash',
    fallbackImageUrl: 'https://upload.wikimedia.org/wikipedia/commons/b/b5/Bearded_man_in_hoodie_%28Unsplash%29.jpg',
  },
  {
    ownerKey: 'luka',
    title: 'Ripped straight jeans',
    description: 'Farmerke ravnog kroja sa lagano izbledelim pranjem i opustenim fitom.',
    category: 'bottoms',
    brand: 'Diesel',
    size: '32',
    condition: 'good',
    listingType: 'sell',
    price: 42,
    imageQuery: 'jeans unsplash',
    fallbackImageUrl: 'https://upload.wikimedia.org/wikipedia/commons/0/01/In_ripped_jeans_eating_popcorn_%28Unsplash%29.jpg',
  },
  {
    ownerKey: 'anja',
    title: 'Camel wrap coat',
    description: 'Topli kaput u boji peska sa pojasom i mekom siluetom za tranzicione dane.',
    category: 'outerwear',
    brand: 'Massimo Dutti',
    size: 'S',
    condition: 'like_new',
    listingType: 'sell',
    price: 76,
    imageQuery: 'coat unsplash',
    fallbackImageUrl: 'https://upload.wikimedia.org/wikipedia/commons/a/a0/Brown_fur_coat_%28Unsplash_7wZGMet4bDQ%29.jpg',
  },
  {
    ownerKey: 'mila',
    title: 'Off-shoulder silk blouse',
    description: 'Lagani top koji izgleda romanticno uz jeans, ali i dovoljno uredno uz suknju ili sako.',
    category: 'tops',
    brand: 'Reserved',
    size: 'M',
    condition: 'new',
    listingType: 'both',
    price: 27,
    tradeFor: 'neutralna midi suknja',
    imageQuery: 'blouse unsplash',
    fallbackImageUrl: 'https://upload.wikimedia.org/wikipedia/commons/7/75/Off_The_Shoulder_Blouse_%28Unsplash%29.jpg',
  },
  {
    ownerKey: 'mila',
    title: 'Pleated silver midi skirt',
    description: 'Lagano plisirana suknja koja daje editorijalni momenat i u dnevnim kombinacijama.',
    category: 'bottoms',
    brand: 'Zara',
    size: 'M',
    condition: 'like_new',
    listingType: 'trade',
    tradeFor: 'mekani dzemper ili bela kosulja',
    imageQuery: 'skirt unsplash',
    fallbackImageUrl: 'https://upload.wikimedia.org/wikipedia/commons/6/61/Fashionable_woman_in_a_skirt_%28Unsplash%29.jpg',
  },
  {
    ownerKey: 'anja',
    title: 'Cream ankle boots',
    description: 'Cizme koje rade i uz haljinu i uz ravne pantalone, sa dovoljno cistom linijom za svaki dan.',
    category: 'shoes',
    brand: 'Aldo',
    size: '38',
    condition: 'good',
    listingType: 'sell',
    price: 46,
    imageQuery: 'ankle boots woman',
    fallbackImageUrl: 'https://upload.wikimedia.org/wikipedia/commons/0/04/Pair_of_Woman%27s_Ankle_Boots_%28Wedding%29_LACMA_30.36.2a-b.jpg',
  },
  {
    ownerKey: 'teo',
    title: 'Graphic tee with washed print',
    description: 'Majica sa izbledelelim printom, dobra baza za slojeve i street kombinacije.',
    category: 'tops',
    brand: 'Weekday',
    size: 'L',
    condition: 'good',
    listingType: 'trade',
    tradeFor: 'siroka kosulja ili patike',
    imageQuery: 'graphic tee unsplash',
    fallbackImageUrl: 'https://upload.wikimedia.org/wikipedia/commons/3/39/Urban_Street_Outfit_%28Unsplash%29.jpg',
  },
  {
    ownerKey: 'mila',
    title: 'Cropped cardigan',
    description: 'Kratak kardigan koji super radi uz visoki struk i lagane slojeve.',
    category: 'tops',
    brand: 'H&M',
    size: 'S',
    condition: 'like_new',
    listingType: 'sell',
    price: 19,
    imageQuery: 'cardigan unsplash',
    fallbackImageUrl: 'https://upload.wikimedia.org/wikipedia/commons/d/d2/Cardigan_%28sweater%29_2.jpg',
  },
  {
    ownerKey: 'teo',
    title: 'Utility cargo pants',
    description: 'Opustene utility pantalone sa dovoljno prostora i dobrom strukturom za everyday street styling.',
    category: 'bottoms',
    brand: 'Carhartt',
    size: '34',
    condition: 'good',
    listingType: 'both',
    price: 44,
    tradeFor: 'neutralan duks ili vintage jakna',
    imageQuery: 'street style unsplash',
    fallbackImageUrl: 'https://upload.wikimedia.org/wikipedia/commons/a/aa/Chriss_Style_%28Unsplash%29.jpg',
  },
  {
    ownerKey: 'anja',
    title: 'Crossbody city bag',
    description: 'Torba za grad sa dovoljno prostora za essentials i cistim, tihim dizajnom.',
    category: 'bags',
    brand: 'Mango',
    size: 'One size',
    condition: 'like_new',
    listingType: 'sell',
    price: 33,
    imageQuery: 'crossbody bag woman',
    fallbackImageUrl: 'https://upload.wikimedia.org/wikipedia/commons/b/b3/A_woman_walking_%28Unsplash%29.jpg',
  },
  {
    ownerKey: 'teo',
    title: 'Glossy puffer jacket',
    description: 'Topla jakna sa malo sjaja i izrazito utility vibe-om za zimu.',
    category: 'outerwear',
    brand: 'Nike',
    size: 'XL',
    condition: 'good',
    listingType: 'trade',
    tradeFor: 'deblji hoodie ili heavy denim',
    imageQuery: 'puffer jacket woman',
    fallbackImageUrl: 'https://upload.wikimedia.org/wikipedia/commons/1/10/Denny_Strickland_Country_Rap_artist_Nashville_spotting_2025_in_orange_puffer_jacket_with_beautiful_mystery_woman_in_artist_avenue_behind_legends.jpg',
  },
  {
    ownerKey: 'mila',
    title: 'Floral midi dress',
    description: 'Lagana cvetna haljina za dnevne kombinacije i meke slojeve preko ramena.',
    category: 'dresses',
    brand: 'Reserved',
    size: 'M',
    condition: 'new',
    listingType: 'both',
    price: 41,
    tradeFor: 'sandale ili mala torba',
    imageQuery: 'dress unsplash',
    fallbackImageUrl: 'https://upload.wikimedia.org/wikipedia/commons/6/65/Laughing_woman_in_floral_dress_%28Unsplash%29.jpg',
  },
  {
    ownerKey: 'mila',
    title: 'Mohair knit sweater',
    description: 'Mekani dzemper sa teksturom, idealan za hladnije dane i jednostavne kombinacije.',
    category: 'tops',
    brand: 'COS',
    size: 'M',
    condition: 'like_new',
    listingType: 'sell',
    price: 36,
    imageQuery: 'knit sweater woman',
    fallbackImageUrl: 'https://upload.wikimedia.org/wikipedia/commons/1/10/Mohair_trui_en_gehaakte_muts_-_Mohair_sweater_and_crochet_baret_%284106588882%29.jpg',
  },
  {
    ownerKey: 'luka',
    title: 'Brown penny loafers',
    description: 'Klasican par mokasina za clean archive look i smart casual styling.',
    category: 'shoes',
    brand: 'G.H. Bass',
    size: '42',
    condition: 'good',
    listingType: 'sell',
    price: 52,
    imageQuery: 'loafers shoes',
    fallbackImageUrl: 'https://upload.wikimedia.org/wikipedia/commons/6/61/A_Penny_Loafer.jpg',
  },
  {
    ownerKey: 'luka',
    title: 'Hooded weather jacket',
    description: 'Lagani gornji sloj za vetar i prelazni period, sa cistom utilitarnom linijom.',
    category: 'outerwear',
    brand: 'Uniqlo',
    size: 'M',
    condition: 'like_new',
    listingType: 'both',
    price: 47,
    tradeFor: 'patike ili utility torba',
    imageQuery: 'jacket unsplash',
    fallbackImageUrl: 'https://upload.wikimedia.org/wikipedia/commons/8/89/Jacket_With_A_Hood_%28Unsplash%29.jpg',
  },
]

function getSeededDate(index) {
  return new Date(Date.now() - index * 1000 * 60 * 37)
}

function getCandidateImageUrl(page) {
  const url = page?.imageinfo?.[0]?.url
  if (!url) return null
  return /\.(jpe?g|png)$/i.test(url) ? url : null
}

async function resolveCommonsImageUrl(imageQuery, fallbackImageUrl) {
  try {
    const searchParams = new URLSearchParams({
      action: 'query',
      format: 'json',
      generator: 'search',
      gsrnamespace: '6',
      gsrlimit: '8',
      prop: 'imageinfo',
      iiprop: 'url',
      gsrsearch: imageQuery,
    })

    const response = await fetch(`${COMMONS_API_URL}?${searchParams.toString()}`)
    if (!response.ok) {
      throw new Error(`Commons search failed with ${response.status}`)
    }

    const data = await response.json()
    const pages = Object.values(data.query?.pages || {})
    const candidate = pages.map(getCandidateImageUrl).find(Boolean)
    return candidate || fallbackImageUrl
  } catch (error) {
    console.warn(`[Seed] Commons image lookup failed for "${imageQuery}": ${error.message}`)
    return fallbackImageUrl
  }
}

async function embedImage(imageUrl) {
  try {
    const response = await fetch(`${AI_SERVER_URL}/embed`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ image_url: imageUrl }),
    })

    if (!response.ok) {
      throw new Error(`AI embed failed with ${response.status}`)
    }

    const data = await response.json()
    return Array.isArray(data.embedding) && data.embedding.length > 0 ? data.embedding : null
  } catch (error) {
    console.warn(`[Seed] Embedding skipped for ${imageUrl}: ${error.message}`)
    return null
  }
}

async function upsertSeedUsers() {
  const usersByKey = new Map()

  for (const userDefinition of SEED_USERS) {
    const user = await User.findOneAndUpdate(
      { firebaseUid: userDefinition.firebaseUid },
      {
        $set: {
          email: userDefinition.email,
          displayName: userDefinition.displayName,
          bio: userDefinition.bio,
          averageRating: userDefinition.averageRating,
          totalRatings: userDefinition.totalRatings,
          completedTrades: userDefinition.completedTrades,
          onboardingCompleted: userDefinition.onboardingCompleted,
          stylePreferences: userDefinition.stylePreferences,
          favoriteBrands: userDefinition.favoriteBrands,
          categories: userDefinition.categories,
          sizes: userDefinition.sizes,
          location: userDefinition.location,
        },
      },
      {
        upsert: true,
        new: true,
        setDefaultsOnInsert: true,
      }
    )

    usersByKey.set(userDefinition.key, user)
  }

  return usersByKey
}

async function removeStaleSeedItems(seedUserIds, desiredKeys) {
  const existingSeedItems = await Item.find({ userId: { $in: seedUserIds } }).select('_id userId title').lean()

  const staleItemIds = existingSeedItems
    .filter((item) => !desiredKeys.has(`${String(item.userId)}:${item.title}`))
    .map((item) => item._id)

  if (staleItemIds.length === 0) {
    return
  }

  await Promise.all([
    Like.deleteMany({ itemId: { $in: staleItemIds } }),
    Wishlist.deleteMany({ itemId: { $in: staleItemIds } }),
    Item.deleteMany({ _id: { $in: staleItemIds } }),
  ])

  console.log(`[Seed] Removed ${staleItemIds.length} stale seed items`)
}

async function seedItems(usersByKey) {
  const desiredKeys = new Set(
    SEED_ITEMS.map((definition) => `${usersByKey.get(definition.ownerKey)._id}:${definition.title}`)
  )

  await removeStaleSeedItems(
    Array.from(usersByKey.values()).map((user) => user._id),
    desiredKeys
  )

  const seededItems = []

  for (const [index, definition] of SEED_ITEMS.entries()) {
    const owner = usersByKey.get(definition.ownerKey)
    const imageUrl = USE_COMMONS_LOOKUP
      ? await resolveCommonsImageUrl(definition.imageQuery, definition.fallbackImageUrl)
      : definition.fallbackImageUrl
    const createdAt = getSeededDate(index)

    const setPayload = {
      userId: owner._id,
      title: definition.title,
      description: definition.description,
      category: definition.category,
      brand: definition.brand,
      size: definition.size,
      condition: definition.condition,
      listingType: definition.listingType,
      images: imageUrl ? [imageUrl] : [],
      status: 'available',
      isDeleted: false,
      engagementScore: Number((0.32 + (index % 7) * 0.08).toFixed(2)),
      createdAt,
      updatedAt: createdAt,
    }

    const unsetPayload = { deletedAt: 1 }

    if (definition.listingType === 'sell' || definition.listingType === 'both') {
      setPayload.price = definition.price
    } else {
      unsetPayload.price = 1
    }

    if (definition.listingType === 'trade' || definition.listingType === 'both') {
      setPayload.tradeFor = definition.tradeFor
    } else {
      unsetPayload.tradeFor = 1
    }

    const item = await Item.findOneAndUpdate(
      { userId: owner._id, title: definition.title },
      { $set: setPayload, $unset: unsetPayload },
      {
        upsert: true,
        new: true,
        setDefaultsOnInsert: true,
        timestamps: false,
      }
    )

    const embedding = imageUrl ? await embedImage(imageUrl) : null
    if (embedding) {
      item.embedding = embedding
      await item.save()
    }

    seededItems.push(item)
    console.log(`[Seed] Upserted item: ${definition.title}`)
  }

  return seededItems
}

async function seedEngagementSignals(items, usersByKey) {
  const seedUserIds = Array.from(usersByKey.values()).map((user) => user._id)
  const itemIds = items.map((item) => item._id)

  await Promise.all([
    Like.deleteMany({ userId: { $in: seedUserIds }, itemId: { $in: itemIds } }),
    Wishlist.deleteMany({ userId: { $in: seedUserIds }, itemId: { $in: itemIds } }),
  ])

  for (const [index, item] of items.entries()) {
    const ownerId = String(item.userId)
    const otherUsers = Array.from(usersByKey.values()).filter((user) => String(user._id) !== ownerId)
    const likeUsers = otherUsers.slice(0, 1 + (index % 2))
    const wishlistUsers = otherUsers.slice(-((index % 3) === 0 ? 2 : 1))

    for (const user of likeUsers) {
      await Like.updateOne(
        { userId: user._id, itemId: item._id },
        { $setOnInsert: { userId: user._id, itemId: item._id } },
        { upsert: true }
      )
    }

    for (const user of wishlistUsers) {
      await Wishlist.updateOne(
        { userId: user._id, itemId: item._id },
        { $setOnInsert: { userId: user._id, itemId: item._id } },
        { upsert: true }
      )
    }
  }
}

async function main() {
  if (!process.env.MONGODB_URI) {
    throw new Error('MONGODB_URI is missing in apps/api/.env')
  }

  await mongoose.connect(process.env.MONGODB_URI)
  console.log('[Seed] MongoDB connected')

  const usersByKey = await upsertSeedUsers()
  const items = await seedItems(usersByKey)
  await seedEngagementSignals(items, usersByKey)

  console.log(`[Seed] Ready. Users: ${usersByKey.size}, items: ${items.length}`)
}

main()
  .catch((error) => {
    console.error('[Seed] Failed:', error.message)
    process.exitCode = 1
  })
  .finally(async () => {
    await mongoose.disconnect()
  })
