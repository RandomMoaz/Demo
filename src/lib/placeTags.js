export const FOOD_TYPES = ['restaurant', 'fast_food', 'cafe', 'food_court', 'ice_cream']
export const SHOP_TYPES = ['butcher', 'supermarket', 'convenience', 'greengrocer', 'bakery', 'deli']
export const HALAL_LEVELS = ['yes', 'only', 'limited']
const DENOMINATIONS = ['sunni', 'shia', 'ibadi', 'sufi', 'ahmadiyya']

export const WANTED_TAGS = [
  'name', 'name:en', 'name:ar', 'brand', 'amenity', 'shop', 'religion', 'denomination', 'diet:halal', 'cuisine',
  'opening_hours', 'phone', 'contact:phone', 'website', 'contact:website', 'email', 'contact:email',
  'addr:housenumber', 'addr:street', 'addr:city', 'addr:suburb', 'addr:postcode', 'addr:full',
  'wheelchair', 'takeaway', 'delivery', 'outdoor_seating', 'diet:vegetarian', 'internet_access',
]

/** Name in the user's language when the map has one, else the local name. */
export function placeName(tags, lang) {
  if (!tags) return ''
  return tags[`name:${lang}`] || tags.name || tags['name:en'] || tags['name:ar'] || tags.brand || ''
}

export function kindOf(tags) {
  if (tags.amenity === 'place_of_worship') return ['muslim', 'multifaith'].includes(tags.religion) ? 'mosque' : null
  const halal = HALAL_LEVELS.includes(tags['diet:halal'])
  if (halal && FOOD_TYPES.includes(tags.amenity)) return 'food'
  if (halal && tags.shop) return 'shop'
  return null
}

function address(tags) {
  const street = [tags['addr:housenumber'], tags['addr:street']].filter(Boolean).join(' ')
  const town = [tags['addr:postcode'], tags['addr:city'] || tags['addr:suburb']].filter(Boolean).join(' ')
  return [street, town].filter(Boolean).join(', ') || tags['addr:full'] || ''
}

const tidyCuisine = (c) => (c ? c.split(/[;,]/).map((x) => x.trim().replace(/_/g, ' ')).filter(Boolean).slice(0, 3) : [])
const yes = (v) => v === 'yes' || v === 'only'

function features(tags) {
  const f = []
  if (tags.wheelchair === 'yes') f.push('wheelchair')
  else if (tags.wheelchair === 'limited') f.push('wheelchairLimited')
  if (yes(tags.takeaway)) f.push('takeaway')
  if (yes(tags.delivery)) f.push('delivery')
  if (tags.outdoor_seating === 'yes') f.push('outdoor')
  if (yes(tags['diet:vegetarian'])) f.push('veg')
  if (['wlan', 'yes', 'wifi'].includes(tags.internet_access)) f.push('wifi')
  return f
}

export function placeFromTags(id, lat, lng, tags = {}, lang = 'en') {
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null
  const kind = kindOf(tags)
  if (!kind) return null
  const name = placeName(tags, lang)
  const denom = String(tags.denomination || '').toLowerCase()
  return {
    id, kind, lat, lng, name,
    local: tags.name && tags.name !== name ? tags.name : '',
    halal: kind === 'mosque' ? null : tags['diet:halal'], // only | yes | limited
    type: kind === 'food' ? tags.amenity
      : kind === 'shop' ? (SHOP_TYPES.includes(tags.shop) ? tags.shop : 'other')
        : tags.religion === 'multifaith' ? 'multifaith' : null,
    denom: kind === 'mosque' && DENOMINATIONS.includes(denom) ? denom : null,
    cuisine: kind === 'mosque' ? [] : tidyCuisine(tags.cuisine),
    address: address(tags),
    hours: tags.opening_hours || '',
    phone: tags.phone || tags['contact:phone'] || '',
    website: tags.website || tags['contact:website'] || '',
    email: tags.email || tags['contact:email'] || '',
    features: features(tags),
  }
}
