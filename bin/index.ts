import { Scrapper } from './scrapper'


function usage() {
  console.warn(`
USAGE:
  ${process.argv[0]} ${process.argv[1]} <username> <learning-lang> <user-lang>

WITH:
  <username>     : A valid Duolingo username used for scrapping.
  <learning-lang>: The track ID of the target (learning) language.
  <user-lang>    : The track ID of the source (user) language.
`)

  process.exit(1)
}


// Find target language and source language from args
const args = process.argv.slice(2)

if (args.length !== 3)
  usage()

const [username, learningLanguageId, userLanguageId] = args

if (learningLanguageId.length !== 2 || userLanguageId.length !== 2)
  usage()

const fullLanguageNames: Record<string, string> = {
  'en': 'English',
  'fr': 'Français',
  'ja': '日本語',
  'ko': '한국어',
}

const userLanguage = fullLanguageNames[userLanguageId],
      learningLanguage = fullLanguageNames[learningLanguageId]

if (learningLanguage == undefined || userLanguage === undefined)
  usage()


// Scrap things
const scrapper = new Scrapper()

scrapper
  .fetchUserData(username)
  .then(user => {
    if (typeof user === 'string') {
      console.warn(user)

      return process.exit(2)
    }

    scrapper
      .createDbLanguageTrack(user, learningLanguageId, userLanguageId, userLanguage)
      .then(track => console.log(JSON.stringify(track)))
  })
