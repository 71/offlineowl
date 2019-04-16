import { get, set } from 'idb-keyval'


export const availableLanguages = {
  'en': 'English',
  'fr': 'French',
  'ja': 'Japanese',
  'ko': 'Korean',
}

export type LanguageId = string
export type LessonId   = string
export type WordId     = string

export interface Lesson {
  id: LessonId

  title: string
  name: string
  shortName: string

  explanation: string

  dependencies: LessonId[]
  words: WordId[]
}

export interface Example {
  sentence: string
  translation: string
}

export interface Word {
  id: WordId

  word: string
  translations: string

  examples: Example[]
  related: WordId[]
}

export interface LanguageTrack {
  learningLanguage: string
  learningLanguageId: LanguageId

  userLanguage: string
  userLanguageId: LanguageId

  lessons: Lesson[]
  words: Record<WordId, Word>
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

  load(languageTrack: LanguageTrack) {
    this.languages[languageTrack.learningLanguageId] = languageTrack

    for (const lesson of languageTrack.lessons)
    for (const word of lesson.words)
      this.words[word] = languageTrack.words[word]

    return languageTrack
  }

  async loadByName(learningLanguageId: string, userLanguageId: string) {
    const trackId = `${userLanguageId}-${learningLanguageId}`
    const cachedTrack = await get<LanguageTrack>(trackId)

    if (cachedTrack !== undefined)
      return this.load(cachedTrack)

    let track: LanguageTrack

    switch (`${userLanguageId}-${learningLanguageId}`) {
      case 'en-ko':
        track = await import('../../data/en-ko.json') as LanguageTrack
        break

      default:
        throw new Error('Could not import unknown course.')
    }

    await set(trackId, track)

    return this.load(track)
  }
}
