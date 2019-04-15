import { h, eventListener, attach, Observable } from 'ricochet'
import { BuiltinSubject, compute }                       from 'ricochet/reactive'

import { MDCSelect }    from '@material/select'
import { MDCTextField } from '@material/textfield'

import { Store, DictionaryItem } from './store'


const availableLanguages = {
  'en': 'English',
  'fr': 'French',
  'ja': 'Japanese',
  'ko': 'Korean',
}

function raw(value: string) {
  const wrapper = document.createElement('div')
  wrapper.innerHTML = value
  return [...wrapper.childNodes]
}

function late(ctor: { new(element: Element): any }) {
  return function(element: Element) {
    setTimeout(() => new ctor(element), 1)
  }
}

function Select({ text, items, selected }: { text: string, items: Record<string, string>, selected: BuiltinSubject<string> }) {
  const input$ = eventListener('input')

  attach(
    input$.subscribe(input => {
      selected.next((input.target as HTMLInputElement).value)
    })
  )

  return (
    <div class='mdc-select mdc-select--outlined' connect={late(MDCSelect)}>
      <i class='mdc-select__dropdown-icon'></i>
      <select class='mdc-select__native-control' connect={input$}>
        { selected.map(from =>
          Object.keys(items).map(x => <option value={x} selected={from === x}>{items[x]}</option>)
        ) }
      </select>

      <div class='mdc-notched-outline'>
        <div class='mdc-notched-outline__leading'></div>
        <div class='mdc-notched-outline__notch'>
          <label class='mdc-floating-label'>{text}</label>
        </div>
        <div class='mdc-notched-outline__trailing'></div>
      </div>
    </div>
  )
}

export interface AppProps {
  store: Store
}

export function App({ store }: AppProps) {
  const inputEvent$ = eventListener('input')
  const displayItem = new WeakMap<DictionaryItem, Observable<'block' | 'none'>>()

  let ignore = false
  let lastTimeout = 0

  function display$(item: DictionaryItem) {
    let d$ = displayItem.get(item)

    if (d$ === undefined) {
      d$ = compute($ =>
        (item.from_language === $(store.languageFrom)) &&
        (item.learning_language === $(store.languageTo)) &&
        (item.word.includes($(store.searchQuery)) || item.translations.includes($(store.searchQuery)))
          ? 'block' : 'none'
      )

      displayItem.set(item, d$)
    }

    return d$
  }

  attach(
    inputEvent$.subscribe(e => {
      if (ignore) return

      ignore = true
      store.searchQuery.next((e.target as HTMLInputElement).value)
      ignore = false

      if (lastTimeout !== 0)
        clearTimeout(lastTimeout)

      lastTimeout = setTimeout(() => {
        lastTimeout = 0

        if (navigator.onLine)
          store.addWords(store.searchQuery.value, store.languageTo.value, store.languageFrom.value)
      })
    }),
  )

  function goToWord(this: HTMLAnchorElement) {
    store.searchQuery.next(this.innerText)
  }

  return (
    <div class='app'>
      <div class='header mdc-elevation--z4'>
        <div class='search-box mdc-text-field mdc-text-field--outlined' connect={late(MDCTextField)}>
          <input type='text' id='tf-outlined' class='mdc-text-field__input' connect={inputEvent$} value={store.searchQuery} />
          <div class='mdc-notched-outline'>
            <div class='mdc-notched-outline__leading'></div>
            <div class='mdc-notched-outline__notch'>
              {/*
               // @ts-ignore */}
              <label for='tf-outlined' class='mdc-floating-label'>Search</label>
            </div>
            <div class='mdc-notched-outline__trailing'></div>
          </div>
        </div>

        <Select items={availableLanguages} selected={store.languageFrom} text='From' />
        <Select items={availableLanguages} selected={store.languageTo}   text='To' />
      </div>

      <ul class='items'>
        { store.items.sync(item =>
          <li class='item mdc-elevation--z4' style={{ display: display$(item) }}>
            <div class='item-content'>
              <table>
                <tr class='from'>
                  <th>{item.from_language_name}</th>
                  <th>{item.learning_language_name}</th>
                </tr>

                <tr class='to'>
                  <td>{item.translations}</td>
                  <td>{item.word}</td>
                </tr>

                { item.alternative_forms.map(x =>
                  <tr>
                    <td>{raw(x.translation)}</td>
                    <td>{raw(x.example_sentence)}</td>
                  </tr>
                ) }
              </table>

              { item.related_lexemes.length !== 0 &&
                <div class='related'>
                  { item.related_lexemes.map(x =>
                    <div><a href='#' onclick={goToWord}>{x.anchor}</a></div>
                  ) }
                </div>
              }
            </div>
          </li>
        ) }
      </ul>
    </div>
  )
}
