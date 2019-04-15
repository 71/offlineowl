import { observableArray } from 'ricochet/array'
import { subject }         from 'ricochet/reactive'

import { get, set, del, keys, clear, Store as IndexedDbStore } from 'idb-keyval'


export interface AlternativeForm {
  example_sentence: string
  translation: string

  highlighted: boolean
  invalid: boolean

  word: string
  word_value_matched: string
}

export interface DictionaryItem {
  lexeme_id: string

  from_language: string
  from_language_name: string

  learning_language: string
  learning_language_name: string

  translations: string
  word: string
  tts?: string

  alternative_forms: AlternativeForm[]
  related_lexemes: { anchor: string, url: string }[]
}

export type CompletionLanguages<A extends string, B extends string> = {
  [Language in A | B]: {
    lexemeId: string
    matchedLanguageId: A | B
    matchedText: string
  }[]
}
export type Completion<A extends string = string, B extends string = string> = CompletionLanguages<A, B> & {
  languageId: A
  uiLanguageId: B
  word: string
}

export class Store {
  private readonly itemsStore = new IndexedDbStore('items')
  private readonly completionsStore = new IndexedDbStore('completions')

  readonly items = observableArray<DictionaryItem>()
  readonly completions = observableArray<Completion>()

  readonly languageFrom = subject('')
  readonly languageTo = subject('')
  readonly searchQuery = subject('')

  async init() {
    this.languageFrom.next(await get('language-from') || 'en')
    this.languageTo.next(await get('language-to') || 'fr')
    this.searchQuery.next(await get('search-query') || '')

    this.languageFrom.subscribe(v => set('language-from', v))
    this.languageTo.subscribe(v => set('language-to', v))
    this.searchQuery.subscribe(v => set('search-query', v))

    this.items.push(
      ...(await Promise.all((await keys(this.itemsStore)).map(key => get<DictionaryItem>(key, this.itemsStore))))
    )

    this.completions.push(
      ...(await Promise.all((await keys(this.completionsStore)).map(key => get<Completion>(key, this.completionsStore))))
    )
  }

  async findDictionaryItem(id: string, intoLanguage: string) {
    const existingItem = this.items.find(x => x.lexeme_id === id)

    if (existingItem !== undefined)
      return existingItem

    try {
      const res = await fetch(`https://${intoLanguage}.duolingo.com/api/1/dictionary_page?lexeme_id=${id}`, {
        headers: {
          Cookie: `lang=${intoLanguage}`
        }
      })
      const word = await res.json() as DictionaryItem

      return word
    } catch {
      return `Could not find vocabulary information for ID ${id}.`
    }
  }

  async findIds<A extends string, B extends string>(word: string, languageId: A, uiLanguageId: B) {
    const existingCompletion = this.completions.find(x => x.word === word && x.languageId === languageId && x.uiLanguageId === uiLanguageId)

    if (existingCompletion !== undefined)
      return existingCompletion

    try {
      const res = await fetch(`https://duolingo-lexicon-prod.duolingo.com/api/1/complete?languageId=${languageId}&query=${word}&uiLanguageId=${uiLanguageId}`)
      const completion = await res.json() as Completion<A, B>

      return Object.assign(completion, { word, languageId, uiLanguageId })
    } catch {
      return `Could not find completions for word ${word}.`
    }
  }

  async addWords<A extends string, B extends string>(search: string, languageId: A, uiLanguageId: B) {
    search = search.trim().toLowerCase()

    const existingCompletion = this.completions.find(x => x.word === search && x.languageId === languageId && x.uiLanguageId === uiLanguageId)

    if (existingCompletion !== undefined)
      return existingCompletion

    const completion = await this.findIds(search, languageId, uiLanguageId)

    if (typeof completion === 'string')
      return completion

    await this.addCompletion(completion)

    const items = [
      ...await Promise.all(completion[uiLanguageId].map(x => this.findDictionaryItem(x.lexemeId, x.matchedLanguageId))),
      ...await Promise.all(completion[  languageId].map(x => this.findDictionaryItem(x.lexemeId, x.matchedLanguageId))),
    ]

    for (const item of items) {
      if (typeof item === 'string')
        continue

      const existingItem = this.items.find(x => x.lexeme_id === item.lexeme_id)

      if (existingItem !== undefined)
        continue

      await this.addWord(item)
    }

    return items.filter(x => typeof x === 'string').join(' ') || undefined
  }

  async addCompletion(completion: Completion) {
    this.completions.push(completion)

    await set(`${completion.word}/${completion.languageId}/${completion.uiLanguageId}`, completion, this.completionsStore)
  }

  async removeCompletion(completion: Completion) {
    const index = this.completions.findIndex(x => x.word === completion.word && x.languageId === completion.languageId && x.uiLanguageId === completion.uiLanguageId)

    if (index !== -1)
      this.completions.splice(index, 1)

    await del(`${completion.word}/${completion.languageId}/${completion.uiLanguageId}`, this.completionsStore)
  }

  async addWord(word: DictionaryItem) {
    this.items.push(word)

    await set(word.lexeme_id, word, this.itemsStore)
  }

  async removeWord(word: DictionaryItem) {
    const index = this.items.findIndex(x => x.lexeme_id === word.lexeme_id)

    if (index !== -1)
      this.items.splice(index, 1)

    await del(word.lexeme_id, this.itemsStore)
  }

  async reset() {
    this.items.splice(0)
    this.completions.splice(0)

    await clear(this.itemsStore)
    await clear(this.completionsStore)
  }
}
