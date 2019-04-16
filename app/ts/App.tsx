import { h, eventListener, attach, Observable } from 'ricochet'
import { observableArray }                      from 'ricochet/array'
import { compute, BuiltinSubject, subject }     from 'ricochet/reactive'

import { MDCSelect }    from '@material/select'
import { MDCTextField } from '@material/textfield'

import { Database, availableLanguages, Word } from './db'


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
  db: Database
}

export function App({ db }: AppProps) {
  const searchQuery$  = subject(localStorage.getItem('query') || '')
  const userLang$     = subject(localStorage.getItem('user-lang') || 'en')
  const learningLang$ = subject(localStorage.getItem('learning-lang') || 'fr')

  const track$ = compute($ => db.loadByName($(learningLang$), $(userLang$)))
  const items$ = observableArray<Word>()

  attach(
    searchQuery$.subscribe(v => localStorage.setItem('query', v)),
    userLang$.subscribe(v => localStorage.setItem('user-lang', v)),
    learningLang$.subscribe(v => localStorage.setItem('learning-lang', v)),

    track$.subscribe(track => track.then(x => items$.splice(0, undefined, ...Object.values(x.words)))),
  )


  const inputEvent$ = eventListener('input')
  const displayItem = new WeakMap<Word, Observable<'block' | 'none'>>()

  let ignore = false

  function display$(item: Word) {
    let d$ = displayItem.get(item)

    if (d$ === undefined) {
      d$ = compute($ =>
        (item.word.includes($(searchQuery$)) || item.translations.includes($(searchQuery$)))
          ? 'block'
          : 'none'
      )

      displayItem.set(item, d$)
    }

    return d$
  }

  attach(
    inputEvent$.subscribe(e => {
      if (ignore) return

      ignore = true
      searchQuery$.next((e.target as HTMLInputElement).value)
      ignore = false
    }),
  )

  function goToWord(this: HTMLAnchorElement) {
    searchQuery$.next(this.getAttribute('data-id'))
  }

  return (
    <div class='app'>
      <div class='header mdc-elevation--z4'>
        <div class='search-box mdc-text-field mdc-text-field--outlined' connect={late(MDCTextField)}>
          <input type='text' id='tf-outlined' class='mdc-text-field__input' connect={inputEvent$} value={searchQuery$} />
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

        <Select items={availableLanguages} selected={userLang$} text='From' />
        <Select items={{ any: 'Any', ...availableLanguages }} selected={learningLang$} text='To' />
      </div>

      <ul class='items'>
        { items$.sync((item, i) => i < 100 &&
          <li class='item mdc-elevation--z4' style={{ display: display$(item) }}>
            <div class='item-content'>
              <table>
                <tr class='lang-name'>
                  <th>{availableLanguages[userLang$.value]}</th>
                  <th>{availableLanguages[learningLang$.value]}</th>
                </tr>

                <tr class='main'>
                  <td>{item.translations}</td>
                  <td>{item.word}</td>
                </tr>

                { item.examples.map(x =>
                  <tr>
                    <td>{raw(x.translation)}</td>
                    <td>{raw(x.sentence)}</td>
                  </tr>
                ) }
              </table>

              { item.related.length !== 0 &&
                <div class='related'>
                  { item.related.map(x =>
                    <div>
                      <a href='#' onclick={goToWord} data-id={x.id}>{x.word}</a>
                    </div>
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
