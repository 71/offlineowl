import { get, set }    from 'idb-keyval'


const fourbytes = new ArrayBuffer(4)
const fourbytesDv = new DataView(fourbytes)

const lessonMagic = new Uint8Array([0])
const wordMagic = new Uint8Array([1])

const MAGIC = new Uint8Array([224, 204, 62, 91])

export interface WriteStream {
  write(buf: Uint8Array): void
  write(str: string, encoding: 'utf8'): void
}

function readString(stream: DataView, offset: [number]) {
  const len = stream.getUint32(offset[0])
  const buf = stream.buffer.slice(offset[0] + 4, offset[0] + 4 + len)
  const str = new TextDecoder().decode(buf)

  offset[0] += 4 + len

  return str
}

function writeUint32(stream: WriteStream, nbr: number) {
  fourbytesDv.setUint32(0, nbr)
  stream.write(new Uint8Array(fourbytes))
}

function writeUint16(stream: WriteStream, nbr: number) {
  fourbytesDv.setUint16(0, nbr)
  stream.write(new Uint8Array(fourbytes.slice(0, 2)))
}

function writeString(stream: WriteStream, str: string) {
  writeUint32(stream, Buffer.byteLength(str, 'utf8'))
  stream.write(str, 'utf8')
}

function incr(offset: [number], by: number) {
  const value = offset[0]
  offset[0] += by
  return value
}

export const availableLanguages = {
  'en': 'English',
  'fr': 'French',
  'ja': 'Japanese',
  'ko': 'Korean',
}

export type LanguageId = string
export type LessonId   = number
export type WordId     = number

export class DeserializationContext {
  readonly lessons: Lesson[] = []
  readonly words: Word[] = []

  getLesson(id: number) {
    while (this.lessons.length <= id)
      this.lessons.push(new Lesson(this.lessons.length))

    return this.lessons[id]
  }

  getWord(id: number) {
    while (this.words.length <= id)
      this.words.push(new Word(this.words.length))

    return this.words[id]
  }
}

export class Lesson {
  constructor(readonly id: LessonId) {}

  title!: string
  name!: string
  shortName!: string

  explanation!: string

  dependencies!: Lesson[]
  words!: Word[]
}

export function serializeLesson(stream: WriteStream, lesson: Lesson) {
  stream.write(lessonMagic)
  writeUint32(stream, lesson.id)

  writeString(stream, lesson.title)
  writeString(stream, lesson.name)
  writeString(stream, lesson.shortName)
  writeString(stream, lesson.explanation)

  writeUint16(stream, lesson.dependencies.length)

  for (const dep of lesson.dependencies)
    writeUint32(stream, dep.id)

  writeUint16(stream, lesson.words.length)

  for (const word of lesson.words)
    writeUint32(stream, word.id)
}

export function deserializeLesson(ctx: DeserializationContext, stream: DataView, offset: [number]) {
  const id = stream.getUint32(incr(offset, 4))
  const lesson = ctx.getLesson(id)

  lesson.title       = readString(stream, offset)
  lesson.name        = readString(stream, offset)
  lesson.shortName   = readString(stream, offset)
  lesson.explanation = readString(stream, offset)

  const depsLength = stream.getUint16(incr(offset, 2)),
        deps = new Array<Lesson>(depsLength)

  for (let i = 0; i < depsLength; i++)
    deps[i] = ctx.getLesson(stream.getUint32(incr(offset, 4)))

  lesson.dependencies = deps

  const wordsLength = stream.getUint16(incr(offset, 2)),
        words = new Array<Word>(wordsLength)

  for (let i = 0; i < wordsLength; i++)
    words[i] = ctx.getWord(stream.getUint32(incr(offset, 4)))

  lesson.words = words
}


export interface Example {
  sentence: string
  translation: string
}

export class Word {
  constructor(readonly id: WordId) {}

  word!: string
  translations!: string

  examples!: Example[]
  related!: Word[]
}

export function serializeWord(stream: WriteStream, word: Word) {
  stream.write(wordMagic)
  writeUint32(stream, word.id)

  writeString(stream, word.word)
  writeString(stream, word.translations)

  writeUint16(stream, word.examples.length)

  for (const example of word.examples) {
    writeString(stream, example.sentence)
    writeString(stream, example.translation)
  }

  writeUint16(stream, word.related.length)

  for (const related of word.related) {
    writeUint32(stream, related.id)
  }
}

export function deserializeWord(ctx: DeserializationContext, stream: DataView, offset: [number]) {
  const id = stream.getUint32(incr(offset, 4))
  const word = ctx.getWord(id)

  word.word = readString(stream, offset)
  word.translations = readString(stream, offset)

  const examplesLength = stream.getUint16(incr(offset, 2)),
        examples = new Array<Example>(examplesLength)

  for (let i = 0; i < examplesLength; i++)
    examples[i] = { sentence: readString(stream, offset), translation: readString(stream, offset) }

  word.examples = examples

  const relatedLength = stream.getUint16(incr(offset, 2)),
        related = new Array<Word>(relatedLength)

  for (let i = 0; i < relatedLength; i++)
    related[i] = ctx.getWord(stream.getUint32(incr(offset, 4)))

  word.related = related
}

export class LanguageTrack {
  learningLanguage!: string
  learningLanguageId!: LanguageId

  userLanguage!: string
  userLanguageId!: LanguageId

  lessons!: Lesson[]
  words!: Word[]
}

export function serializeLanguageTrackHeader(
  stream: WriteStream,
  learningLanguage  : string,
  learningLanguageId: string,
  userLanguage      : string,
  userLanguageId    : string,
) {
  stream.write(MAGIC)

  writeString(stream, learningLanguageId)
  writeString(stream, userLanguageId)
  writeString(stream, learningLanguage)
  writeString(stream, userLanguage)
}

export function deserializeLanguageTrack(stream: DataView) {
  if (stream.getUint8(0) !== MAGIC[0] || stream.getUint8(1) !== MAGIC[1] || stream.getUint8(2) !== MAGIC[2] || stream.getUint8(3) !== MAGIC[3])
    return 'Invalid magic number at start of stream.'

  const track = new LanguageTrack()

  const ctx = new DeserializationContext()
  const offset = [4] as [number]

  track.learningLanguageId = readString(stream, offset)
  track.userLanguageId     = readString(stream, offset)
  track.learningLanguage   = readString(stream, offset)
  track.userLanguage       = readString(stream, offset)

  while (offset[0] < stream.byteLength) {
    const k = stream.getUint8(offset[0]++)

    if (k === 0)
      // Reading lesson
      deserializeLesson(ctx, stream, offset)
    else
      deserializeWord(ctx, stream, offset)
  }

  track.lessons = ctx.lessons
  track.words = ctx.words

  return track
}


/**
 * Defines a database built using the joined scraper.
 */
export class Database {
  readonly availableCourses = {
    'en': {
      'fr': 'French',
      'ja': 'Japanese',
      'ko': 'Korean',
    },
  }

  readonly languages: Record<LanguageId, LanguageTrack> = {}
  readonly words    : Record<WordId, Word> = {}

  load(languageTrackBuffer: DataView) {
    const track = deserializeLanguageTrack(languageTrackBuffer)

    if (typeof track === 'string')
      throw new Error('Invalid track format.')

    return this.languages[track.learningLanguageId] = track
  }

  async loadByName(learningLanguageId: string, userLanguageId: string) {
    const trackId = `${userLanguageId}-${learningLanguageId}`
    const cachedTrack = await get<DataView>(trackId)

    if (cachedTrack !== undefined)
      return this.load(cachedTrack)

    const url = process.env.NODE_ENV === 'development' ? `/${trackId}.dat` : `/offlineowl/${trackId}.dat`
    const req = await fetch(url)

    if (!req.ok)
      throw new Error('Could not import course: ' + req.statusText + '.')

    const content = new DataView(await req.arrayBuffer())

    await set(trackId, content)

    return this.load(content)
  }
}
