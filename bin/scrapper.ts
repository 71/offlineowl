import { User, DictionaryItem, Completion } from './types'

import { LanguageTrack, Lesson, WordId, Word } from '../app/ts/db'

const fetch: typeof window.fetch = require('node-fetch')
const MAX_PARALLEL_REQUESTS = 10


export class Scrapper {
  failures = 0

  readonly items = [] as DictionaryItem[]
  readonly completions = [] as Completion[]

  readonly lookupQueue: [string, string][] = []

  private reportFailure() {
    if (this.failures++ > 20) {
      // Ten failures is a lot, we probably have a rate-limiting problem
      console.error('[-] Too many failures in the past requests; aborting.')

      process.exit(3)
    }
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

  async fetchCompletion<A extends string, B extends string>(word: string, languageId: A, uiLanguageId: B) {
    try {
      const res = await fetch(`https://duolingo-lexicon-prod.duolingo.com/api/1/complete?languageId=${languageId}&query=${word}&uiLanguageId=${uiLanguageId}`)

      if (!res.ok) {
        this.reportFailure()

        return `Error fetching completions for '${word}': ${res.statusText || `Error ${res.status}`}.`
      }

      return Object.assign(await res.json() as Completion<A, B>, { word, languageId, uiLanguageId })
    } catch {
      return `Could not find completions for word ${word}.`
    }
  }

  async addFromQueue() {
    const queue: [string, string][] = []

    for (const [lang, id] of this.lookupQueue.splice(0)) {
      if (queue.some(x => x[0] === lang && x[1] === id))
        continue
      if (this.items.some(x => x.lexeme_id === id))
        continue

      queue.push([lang, id])
    }

    console.error('[i] Adding at most', queue.length, 'item(s) from queue.')

    const tasks = queue.map(async ([lang, id]) => {
      const item = await this.fetchDictionaryItem(id, lang)

      if (typeof item === 'string')
        return console.error('[-] Not adding item:', item)

      console.error('[+] Adding', item)
      this.addWord(item)
    })

    for (let i = 0; i < tasks.length; i += MAX_PARALLEL_REQUESTS)
      await Promise.all(tasks.slice(i, i + MAX_PARALLEL_REQUESTS))
  }

  async fetchUserData(username: string) {
    const res = await fetch(`https://www.duolingo.com/users/${username}`)

    if (!res.ok) {
      this.reportFailure()

      return `Error fetching user '${username}': ${res.statusText || `Error ${res.status}`}.`
    }

    return await res.json() as User
  }

  async scrapeUser(user: User, language: string, intoLanguage: string) {
    const lang = user.language_data[language]
    const ids: string[] = []

    for (const skill of lang.skills)
    for (const lesson in skill.progress_v3_debug_info.lexeme_ids_by_lesson)
    for (const id of skill.progress_v3_debug_info.lexeme_ids_by_lesson[lesson]) {
      if (ids.indexOf(id) === -1 && !this.items.some(x => x.lexeme_id === id))
        ids.push(id)
    }

    console.error('[i] Found', ids.length, 'item(s) to scrape.')

    for (let i = 0; i < ids.length; i += MAX_PARALLEL_REQUESTS)
      await Promise.all(
        ids.slice(i, i + MAX_PARALLEL_REQUESTS).map(async id => {
          const item = await this.fetchDictionaryItem(id, intoLanguage)

          if (typeof item === 'string')
            return console.error('[-]', item)

          this.addWord(item)
        })
      )
  }

  addCompletion(completion: Completion) {
    this.completions.push(completion)
  }

  addWord(word: DictionaryItem) {
    this.items.push(word)
    this.lookupQueue.push(...word.related_lexemes.map(x => [word.from_language, x.url.substr(x.url.lastIndexOf('/') + 1)] as [string, string]))
  }

  async createDbLanguageTrack(user: User, learningLanguageId: string, userLanguageId: string, userLanguage: string): Promise<LanguageTrack> {
    console.error('[i] Creating db.json file for', learningLanguageId, '/', userLanguageId + '.')

    await this.scrapeUser(user, learningLanguageId, userLanguageId)

    const track: LanguageTrack = {
      learningLanguageId, userLanguageId,

      userLanguage,
      learningLanguage: user.language_data[learningLanguageId].language_string,

      lessons: user.language_data[learningLanguageId].skills.map(skill => {
        const words: WordId[] = []

        for (const i in skill.progress_v3_debug_info.lexeme_ids_by_lesson)
        for (const word of skill.progress_v3_debug_info.lexeme_ids_by_lesson[i])
          words.push(word)

        return {
          id: skill.id,
          name: skill.name,
          title: skill.title,
          shortName: skill.short,
          explanation: skill.explanation,
          dependencies: skill.dependencies_name,
          words
        } as Lesson
      }),

      words: {}
    }

    for (const lesson of track.lessons) {
      lesson.dependencies = lesson.dependencies.map(name => track.lessons.find(x => x.name === name)!.id)

      for (const wordId of lesson.words) {
        const word = this.items.find(x => x.lexeme_id === wordId)

        if (word !== undefined) {
          track.words[wordId] = dicItemToWord(word)
        } else {
          const word = await this.fetchDictionaryItem(wordId, userLanguageId)

          if (typeof word === 'string') {
            console.error('[-]', word)

            continue
          }

          console.error('[+] Adding word', wordId)

          this.addWord(word)
          await this.addFromQueue()

          track.words[wordId] = dicItemToWord(word)
        }
      }
    }

    track.lessons.sort((a, b) => {
      const skills = user.language_data[learningLanguageId].skills

      const aSkills = skills.find(x => x.id === a.id)!,
            bSkills = skills.find(x => x.id === b.id)!

      return (aSkills.coords_y * 10 + aSkills.coords_x) - (bSkills.coords_y * 10 + bSkills.coords_x)
    })

    return track
  }
}

function dicItemToWord(item: DictionaryItem): Word {
  return {
    id: item.lexeme_id,
    word: item.word,
    translations: item.translations,
    examples: item.alternative_forms.map(x => ({ sentence: x.example_sentence, translation: x.translation })),
    related: item.related_lexemes.map(x => x.url.substr(x.url.lastIndexOf('/') + 1))
  }
}
