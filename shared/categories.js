/**
 * Категории QuickDraw, на которых учится модель и из которых берутся реплеи.
 *
 * key   — имя категории в датасете Google (часть URL),
 * ru    — подпись в интерфейсе,
 * emoji — для карточек,
 * tier  — уровень сложности: 1 лёгкий, 2 средний, 3 сложный.
 *
 * Модель учится сразу на всех 100 категориях. Уровень сложности не меняет
 * модель — он меняет, из какого подмножества берутся загадки и насколько
 * строго засчитывается ответ.
 */
export const CATEGORIES = [
  // ---------- tier 1: простые и ни на что не похожие ----------
  { key: 'airplane', ru: 'самолёт', emoji: '✈️', tier: 1 },
  { key: 'apple', ru: 'яблоко', emoji: '🍎', tier: 1 },
  { key: 'banana', ru: 'банан', emoji: '🍌', tier: 1 },
  { key: 'bicycle', ru: 'велосипед', emoji: '🚲', tier: 1 },
  { key: 'butterfly', ru: 'бабочка', emoji: '🦋', tier: 1 },
  { key: 'car', ru: 'машина', emoji: '🚗', tier: 1 },
  { key: 'cat', ru: 'кот', emoji: '🐱', tier: 1 },
  { key: 'clock', ru: 'часы', emoji: '🕐', tier: 1 },
  { key: 'cloud', ru: 'облако', emoji: '☁️', tier: 1 },
  { key: 'crown', ru: 'корона', emoji: '👑', tier: 1 },
  { key: 'donut', ru: 'пончик', emoji: '🍩', tier: 1 },
  { key: 'envelope', ru: 'конверт', emoji: '✉️', tier: 1 },
  { key: 'eye', ru: 'глаз', emoji: '👁️', tier: 1 },
  { key: 'eyeglasses', ru: 'очки', emoji: '👓', tier: 1 },
  { key: 'fish', ru: 'рыба', emoji: '🐟', tier: 1 },
  { key: 'flower', ru: 'цветок', emoji: '🌸', tier: 1 },
  { key: 'hamburger', ru: 'бургер', emoji: '🍔', tier: 1 },
  { key: 'house', ru: 'дом', emoji: '🏠', tier: 1 },
  { key: 'key', ru: 'ключ', emoji: '🔑', tier: 1 },
  { key: 'ladder', ru: 'лестница', emoji: '🪜', tier: 1 },
  { key: 'lightning', ru: 'молния', emoji: '⚡', tier: 1 },
  { key: 'mushroom', ru: 'гриб', emoji: '🍄', tier: 1 },
  { key: 'pizza', ru: 'пицца', emoji: '🍕', tier: 1 },
  { key: 'scissors', ru: 'ножницы', emoji: '✂️', tier: 1 },
  { key: 'snowman', ru: 'снеговик', emoji: '⛄', tier: 1 },
  { key: 'star', ru: 'звезда', emoji: '⭐', tier: 1 },
  { key: 'sun', ru: 'солнце', emoji: '☀️', tier: 1 },
  { key: 't-shirt', ru: 'футболка', emoji: '👕', tier: 1 },
  { key: 'tree', ru: 'дерево', emoji: '🌳', tier: 1 },
  { key: 'umbrella', ru: 'зонт', emoji: '☂️', tier: 1 },

  // ---------- tier 2: обычные предметы, кое-что уже путается ----------
  { key: 'bed', ru: 'кровать', emoji: '🛏️', tier: 2 },
  { key: 'bee', ru: 'пчела', emoji: '🐝', tier: 2 },
  { key: 'bird', ru: 'птица', emoji: '🐦', tier: 2 },
  { key: 'book', ru: 'книга', emoji: '📖', tier: 2 },
  { key: 'bridge', ru: 'мост', emoji: '🌉', tier: 2 },
  { key: 'bus', ru: 'автобус', emoji: '🚌', tier: 2 },
  { key: 'cake', ru: 'торт', emoji: '🎂', tier: 2 },
  { key: 'camera', ru: 'фотоаппарат', emoji: '📷', tier: 2 },
  { key: 'candle', ru: 'свеча', emoji: '🕯️', tier: 2 },
  { key: 'carrot', ru: 'морковь', emoji: '🥕', tier: 2 },
  { key: 'chair', ru: 'стул', emoji: '🪑', tier: 2 },
  { key: 'cookie', ru: 'печенье', emoji: '🍪', tier: 2 },
  { key: 'cup', ru: 'чашка', emoji: '☕', tier: 2 },
  { key: 'dog', ru: 'собака', emoji: '🐶', tier: 2 },
  { key: 'door', ru: 'дверь', emoji: '🚪', tier: 2 },
  { key: 'duck', ru: 'утка', emoji: '🦆', tier: 2 },
  { key: 'elephant', ru: 'слон', emoji: '🐘', tier: 2 },
  { key: 'fork', ru: 'вилка', emoji: '🍴', tier: 2 },
  { key: 'guitar', ru: 'гитара', emoji: '🎸', tier: 2 },
  { key: 'hand', ru: 'рука', emoji: '✋', tier: 2 },
  { key: 'hat', ru: 'шляпа', emoji: '🎩', tier: 2 },
  { key: 'headphones', ru: 'наушники', emoji: '🎧', tier: 2 },
  { key: 'helicopter', ru: 'вертолёт', emoji: '🚁', tier: 2 },
  { key: 'ice cream', ru: 'мороженое', emoji: '🍦', tier: 2 },
  { key: 'leaf', ru: 'лист', emoji: '🍃', tier: 2 },
  { key: 'light bulb', ru: 'лампочка', emoji: '💡', tier: 2 },
  { key: 'moon', ru: 'луна', emoji: '🌙', tier: 2 },
  { key: 'mountain', ru: 'гора', emoji: '⛰️', tier: 2 },
  { key: 'pencil', ru: 'карандаш', emoji: '✏️', tier: 2 },
  { key: 'rainbow', ru: 'радуга', emoji: '🌈', tier: 2 },
  { key: 'sailboat', ru: 'парусник', emoji: '⛵', tier: 2 },
  { key: 'shoe', ru: 'ботинок', emoji: '👞', tier: 2 },
  { key: 'snake', ru: 'змея', emoji: '🐍', tier: 2 },
  { key: 'spider', ru: 'паук', emoji: '🕷️', tier: 2 },
  { key: 'sword', ru: 'меч', emoji: '🗡️', tier: 2 },

  // ---------- tier 3: сложное и легко путающееся между собой ----------
  { key: 'ant', ru: 'муравей', emoji: '🐜', tier: 3 },
  { key: 'backpack', ru: 'рюкзак', emoji: '🎒', tier: 3 },
  { key: 'basketball', ru: 'мяч', emoji: '🏀', tier: 3 },
  { key: 'bear', ru: 'медведь', emoji: '🐻', tier: 3 },
  { key: 'broom', ru: 'метла', emoji: '🧹', tier: 3 },
  { key: 'cactus', ru: 'кактус', emoji: '🌵', tier: 3 },
  { key: 'castle', ru: 'замок', emoji: '🏰', tier: 3 },
  { key: 'cow', ru: 'корова', emoji: '🐮', tier: 3 },
  { key: 'crab', ru: 'краб', emoji: '🦀', tier: 3 },
  { key: 'dolphin', ru: 'дельфин', emoji: '🐬', tier: 3 },
  { key: 'dragon', ru: 'дракон', emoji: '🐉', tier: 3 },
  { key: 'drums', ru: 'барабаны', emoji: '🥁', tier: 3 },
  { key: 'frog', ru: 'лягушка', emoji: '🐸', tier: 3 },
  { key: 'giraffe', ru: 'жираф', emoji: '🦒', tier: 3 },
  { key: 'hammer', ru: 'молоток', emoji: '🔨', tier: 3 },
  { key: 'horse', ru: 'лошадь', emoji: '🐴', tier: 3 },
  { key: 'kangaroo', ru: 'кенгуру', emoji: '🦘', tier: 3 },
  { key: 'laptop', ru: 'ноутбук', emoji: '💻', tier: 3 },
  { key: 'lion', ru: 'лев', emoji: '🦁', tier: 3 },
  { key: 'lobster', ru: 'омар', emoji: '🦞', tier: 3 },
  { key: 'octopus', ru: 'осьминог', emoji: '🐙', tier: 3 },
  { key: 'owl', ru: 'сова', emoji: '🦉', tier: 3 },
  { key: 'panda', ru: 'панда', emoji: '🐼', tier: 3 },
  { key: 'penguin', ru: 'пингвин', emoji: '🐧', tier: 3 },
  { key: 'piano', ru: 'пианино', emoji: '🎹', tier: 3 },
  { key: 'rabbit', ru: 'кролик', emoji: '🐰', tier: 3 },
  { key: 'shark', ru: 'акула', emoji: '🦈', tier: 3 },
  { key: 'skull', ru: 'череп', emoji: '💀', tier: 3 },
  { key: 'snail', ru: 'улитка', emoji: '🐌', tier: 3 },
  { key: 'teapot', ru: 'чайник', emoji: '🫖', tier: 3 },
  { key: 'telephone', ru: 'телефон', emoji: '☎️', tier: 3 },
  { key: 'tiger', ru: 'тигр', emoji: '🐯', tier: 3 },
  { key: 'whale', ru: 'кит', emoji: '🐳', tier: 3 },
  { key: 'windmill', ru: 'мельница', emoji: '🌬️', tier: 3 },
  { key: 'zebra', ru: 'зебра', emoji: '🦓', tier: 3 }
]

export const CATEGORY_KEYS = CATEGORIES.map((c) => c.key)

const BY_KEY = new Map(CATEGORIES.map((c) => [c.key, c]))
export function categoryByKey(key) {
  return BY_KEY.get(key) ?? { key, ru: key, emoji: '❓', tier: 1 }
}

/**
 * Уровни сложности.
 *
 * maxTier     — какие категории попадают в игру,
 * winP        — какая уверенность сети нужна, чтобы засчитать рисунок (режим 1),
 * roundMs     — сколько времени на рисунок (режим 1),
 * think       — как часто сеть пересматривает холст, мс (режим 1),
 * holdFrames  — сколько проверок подряд она должна быть уверена, чтобы ответить,
 * options     — сколько вариантов ответа (режим 2),
 * replaySpeed — во сколько раз быстрее рисует ИИ (режим 2).
 */
export const DIFFICULTIES = [
  {
    id: 'easy',
    ru: 'Лёгкий',
    emoji: '🌱',
    hint: '30 простых слов, сеть согласна на смутное сходство',
    maxTier: 1,
    winP: 0.45,
    roundMs: 25000,
    think: 400,
    holdFrames: 2,
    options: 4,
    replaySpeed: 0.85
  },
  {
    id: 'normal',
    ru: 'Обычный',
    emoji: '🔥',
    hint: '65 слов, сеть требует уверенного рисунка',
    maxTier: 2,
    winP: 0.62,
    roundMs: 20000,
    think: 550,
    holdFrames: 3,
    options: 4,
    replaySpeed: 1
  },
  {
    id: 'hard',
    ru: 'Сложный',
    emoji: '💀',
    hint: 'все 100 слов, сеть придирчива, времени мало',
    maxTier: 3,
    winP: 0.75,
    roundMs: 15000,
    think: 700,
    holdFrames: 3,
    options: 6,
    replaySpeed: 1.35
  }
]

export const DEFAULT_DIFFICULTY = 'normal'

export function difficultyById(id) {
  return DIFFICULTIES.find((d) => d.id === id) ?? DIFFICULTIES[1]
}

/** Категории, доступные на выбранном уровне сложности. */
export function categoriesForTier(maxTier) {
  return CATEGORIES.filter((c) => c.tier <= maxTier)
}
