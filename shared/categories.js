/**
 * Категории QuickDraw, на которых учится модель и из которых берутся реплеи.
 * key   — имя категории в датасете Google (часть URL),
 * ru    — подпись в интерфейсе,
 * emoji — для карточек.
 */
export const CATEGORIES = [
  { key: 'airplane', ru: 'самолёт', emoji: '✈️' },
  { key: 'apple', ru: 'яблоко', emoji: '🍎' },
  { key: 'banana', ru: 'банан', emoji: '🍌' },
  { key: 'bicycle', ru: 'велосипед', emoji: '🚲' },
  { key: 'butterfly', ru: 'бабочка', emoji: '🦋' },
  { key: 'car', ru: 'машина', emoji: '🚗' },
  { key: 'cat', ru: 'кот', emoji: '🐱' },
  { key: 'clock', ru: 'часы', emoji: '🕐' },
  { key: 'cloud', ru: 'облако', emoji: '☁️' },
  { key: 'crown', ru: 'корона', emoji: '👑' },
  { key: 'donut', ru: 'пончик', emoji: '🍩' },
  { key: 'envelope', ru: 'конверт', emoji: '✉️' },
  { key: 'eye', ru: 'глаз', emoji: '👁️' },
  { key: 'eyeglasses', ru: 'очки', emoji: '👓' },
  { key: 'fish', ru: 'рыба', emoji: '🐟' },
  { key: 'flower', ru: 'цветок', emoji: '🌸' },
  { key: 'hamburger', ru: 'бургер', emoji: '🍔' },
  { key: 'house', ru: 'дом', emoji: '🏠' },
  { key: 'key', ru: 'ключ', emoji: '🔑' },
  { key: 'ladder', ru: 'лестница', emoji: '🪜' },
  { key: 'lightning', ru: 'молния', emoji: '⚡' },
  { key: 'mushroom', ru: 'гриб', emoji: '🍄' },
  { key: 'pizza', ru: 'пицца', emoji: '🍕' },
  { key: 'scissors', ru: 'ножницы', emoji: '✂️' },
  { key: 'snowman', ru: 'снеговик', emoji: '⛄' },
  { key: 'star', ru: 'звезда', emoji: '⭐' },
  { key: 'sun', ru: 'солнце', emoji: '☀️' },
  { key: 't-shirt', ru: 'футболка', emoji: '👕' },
  { key: 'tree', ru: 'дерево', emoji: '🌳' },
  { key: 'umbrella', ru: 'зонт', emoji: '☂️' }
]

export const CATEGORY_KEYS = CATEGORIES.map((c) => c.key)

const BY_KEY = new Map(CATEGORIES.map((c) => [c.key, c]))
export function categoryByKey(key) {
  return BY_KEY.get(key) ?? { key, ru: key, emoji: '❓' }
}
