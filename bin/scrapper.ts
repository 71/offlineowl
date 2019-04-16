import { User, DictionaryItem, Skill } from './types'

import { serializeLesson, serializeWord, serializeLanguageTrackHeader, Lesson, Word, WriteStream } from '../app/ts/db'

const fetch: typeof window.fetch = require('node-fetch')
const MAX_PARALLEL_REQUESTS = 10


export class Scrapper {
  private readonly words = new Map<string, Word>()
  private readonly lessons = new Map<string, Lesson>()

  failures = 0

  readonly lookupQueue: [string, string][] = []

  constructor(readonly out: WriteStream) {}

  private reportFailure() {
    if (this.failures++ > 20) {
      // Ten failures is a lot, we probably have a rate-limiting problem
      console.error('[-] Too many failures in the past requests; aborting.')

      process.exit(3)
    }
  }

  private idToWord(id: string) {
    let word = this.words.get(id)

    if (word !== undefined)
      return word

    this.words.set(id, word = new Word(this.words.size))

    return word
  }

  private dicItemToWord(item: DictionaryItem) {
    let word = this.words.get(item.lexeme_id)

    if (word === undefined)
      this.words.set(item.lexeme_id, word = new Word(this.words.size))
    else if (word.word !== undefined)
      return word

    word.word = item.word
    word.translations = item.translations
    word.examples = item.alternative_forms.map(x => ({ sentence: x.example_sentence, translation: x.translation }))
    word.related = item.related_lexemes.map(x => this.idToWord(x.url.substr(x.url.lastIndexOf('/') + 1)))

    serializeWord(this.out, word)

    return word
  }

  private skillToLesson(skill: Skill, lang: string) {
    let lesson = this.lessons.get(skill.id)

    if (lesson === undefined)
      this.lessons.set(skill.id, lesson = new Lesson(this.lessons.size))
    else if (lesson.name !== undefined)
      return lesson

    const words = new Set<Word>()
    const original = skill.progress_v3_debug_info.original_debug_info

    for (const i in skill.progress_v3_debug_info.lexeme_ids_by_lesson)
    for (const word of skill.progress_v3_debug_info.lexeme_ids_by_lesson[i]) {
      const w = this.idToWord(word)

      if (w.word === undefined)
        this.lookupQueue.push([lang, word])

      words.add(w)
    }

    if (original !== undefined) {
      for (const i in original.lexeme_ids_by_lesson)
      for (const word of original.lexeme_ids_by_lesson[i]) {
        const w = this.idToWord(word)

        if (w.word === undefined)
          this.lookupQueue.push([lang, word])

        words.add(w)
      }
    }

    lesson.name = skill.name
    lesson.title = skill.title
    lesson.shortName = skill.short
    lesson.explanation = skill.explanation || ''
    lesson.dependencies = skill.dependencies_name.map(name => [...this.lessons.values()].find(x => x.name === name)!)
    lesson.words = [...words]

    // ^ Since we take the time to sort dependencies before hand, we know that all lessons we depend on
    //   have already been serialized.
    serializeLesson(this.out, lesson)

    return lesson
  }

  async fetchDictionaryItem(id: string, intoLanguage: string) {
    try {
      const res = await fetch(`https://${intoLanguage}.duolingo.com/api/1/dictionary_page?lexeme_id=${id}`, {
        headers: {
          Cookie: `lang=${intoLanguage}`
        }
      })

      if (!res.ok) {
        this.reportFailure()

        return `Error fetching item ${id}: ${res.statusText || `Error ${res.status}`}.`
      }

      return await res.json() as DictionaryItem
    } catch {
      return `Could not find vocabulary information for ID ${id}.`
    }
  }

  async fetchUserData(username: string, langId?: string) {
    const opts = langId === undefined ? {} : { headers: { Cookie: `lang=${langId}` } }
    const res = await fetch(`https://${langId || 'www'}.duolingo.com/users/${username}?learning_language=ja`, opts)

    if (!res.ok) {
      this.reportFailure()

      return `Error fetching user '${username}': ${res.statusText || `Error ${res.status}`}.`
    }

    return await res.json() as User
  }

  addWord(word: DictionaryItem) {
    this.dicItemToWord(word)
    this.lookupQueue.push(...word.related_lexemes.map(x => [word.from_language, x.url.substr(x.url.lastIndexOf('/') + 1)] as [string, string]))
  }

  async addFromQueue() {
    const queue: [string, string][] = []

    for (const [lang, id] of this.lookupQueue.splice(0)) {
      if (queue.some(x => x[0] === lang && x[1] === id))
        continue

      const w = this.words.get(id)

      if (w !== undefined && w.word !== undefined)
        continue

      queue.push([lang, id])
    }

    if (queue.length === 0)
      return false

    console.error('[i] Adding', queue.length, 'item(s) from queue.')

    const tasks = queue.map(async ([lang, id]) => {
      const item = await this.fetchDictionaryItem(id, lang)

      if (typeof item === 'string')
        return item

      this.addWord(item)
    })

    let timeout = 400
    let prevDate = Date.now()

    for (let i = 0; i < tasks.length; i += MAX_PARALLEL_REQUESTS) {
      const results = await Promise.all(tasks.slice(i, i + MAX_PARALLEL_REQUESTS))
      const failedResults = results.filter(x => x !== undefined && x.includes('Too Many Requests'))

      if (failedResults.length > 0) {
        console.log('[!] We made two many requests, and must slow down a little bit.')

        i -= MAX_PARALLEL_REQUESTS
        timeout *= 2

        this.failures -= failedResults.length

        await new Promise(resolve => setTimeout(resolve, timeout))
      } else if (prevDate > Date.now() - 1000) {
        // Wait a little
        await new Promise(resolve => setTimeout(resolve, timeout))
      }

      prevDate = Date.now()
    }

    return true
  }

  async writeLanguageTrack(user: User, learningLanguageId: string, userLanguageId: string, userLanguage: string) {
    console.error('[i] Creating database file for', learningLanguageId, '/', userLanguageId + '.')

    const lang = user.language_data[learningLanguageId]

    if (lang === undefined)
      return `User\'s current learning language is not set to ${learningLanguageId}.\nPlease updating it before attempting to invoke this method.`

    serializeLanguageTrackHeader(this.out, lang.language_string, learningLanguageId, userLanguage, userLanguageId)

    // Sort skills by order in which they're shown to the user
    lang.skills.sort((a, b) => (a.coords_y * 10 + a.coords_x) - (b.coords_y * 10 + b.coords_x))

    for (let i = 0; i < lang.skills.length; i++) {
      const skill = lang.skills[i]

      console.error('[i] Adding lesson', skill.title, `(${i + 1}/${lang.skills.length}), with`, skill.words.length, 'words.')

      // Serialize skill into lesson
      this.skillToLesson(skill, userLanguageId)

      // Serialize all dependent words as well
      while (await this.addFromQueue()) {
        // Nop.
      }
    }
  }
}
