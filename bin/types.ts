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

export interface PointsData {
  languages: any[]
  total: number
}

export interface PointsRankingData {
  username: string
  language_string: string
  points_data: PointsData
  avatar: string
  language: string
  fullname: string
  id: number
  rank: number
  self: boolean
}

export interface Calendar {
  improvement: number
  datetime: any
}

export interface NextLesson {
  lesson_number: number
  skill_title: string
  skill_url: string
}

export interface CommentData {
}

export interface ProgressV3 {
  level: number
}

export interface LevelProgress {
  [key: string]: string
}

export interface LexemeIdsByLesson {
  [lesson: number]: string[]
}

export interface Original {
  level: number
}

export interface OriginalDebugInfo {
  level_progress: LevelProgress
  lexeme_ids_by_lesson: LexemeIdsByLesson
}

export interface ProgressV3DebugInfo {
  level_progress: LevelProgress
  lexeme_ids_by_lesson: LexemeIdsByLesson
  original_level_session_index?: number
  original: Original
  original_debug_info: OriginalDebugInfo
}

export interface Skill {
  language_string: string
  dependencies_name: string[]
  practice_recommended: boolean
  disabled: boolean
  test_count: number
  missing_lessons: number
  lesson: boolean
  has_explanation: any
  url_title: string
  icon_color: string
  category: string
  num_lessons: number
  strength: number
  beginner: boolean
  title: string
  level_sessions_finished: number
  coords_y: number
  coords_x: number
  id: string
  levels_finished: number
  test: boolean
  lesson_number: number
  learned: boolean
  num_translation_nodes: number
  achievements: any[]
  description: string
  index: number
  bonus: boolean
  explanation: string
  num_lexemes: number
  num_missing: number
  comment_data: CommentData
  dependencies: string[]
  known_lexemes: string[]
  progress_v3: ProgressV3
  words: string[]
  num_sessions_for_level: number
  path: any[]
  num_levels: number
  learned_ts: number
  progress_v3_debug_info: ProgressV3DebugInfo
  short: string
  locked: boolean
  name: string
  language: string
  progress_v3_level_session_index: number
  new_index: number
  progress_percent: number
  mastered: boolean
}

export interface PointsRankingDataDict {
  [key: number]: PointsRankingData
}

export interface PlacementTest {
  attempts: number
}

export interface LangData {
  streak: number
  language_string: string
  level_progress: number
  first_time: boolean
  bonus_rows: any[]
  points_rank: number
  fluency_score: number
  level_tests: any[]
  direction_status: string
  next_level: number
  linkedin_share_url: string
  points_ranking_data: PointsRankingData[]
  num_skills_learned: number
  calendar: Calendar[]
  level_left: number
  no_dep: boolean
  language_strength: number
  next_lesson: NextLesson
  max_level: boolean
  level_percent: number
  language: string
  level: number
  skills: Skill[]
  bonus_skills: any[]
  level_points: number
  all_time_rank: string[]
  max_depth_learned: number
  points: number
  immersion_enabled: boolean
  points_ranking_data_dict: PointsRankingDataDict
  placement_test: PlacementTest
  exempt_from_health: boolean
  max_tree_level: number
}

export interface LanguageData {
  [langId: string]: LangData
}

export interface LastStreak {
  shortened_product_id: string
  is_available_for_repair: boolean
  google_play_product_id: string
  product_id: string
  days_ago: number
  length: number
  last_reached_goal: number
}

export interface PrivacySettings {
  disable_clubs: boolean
  disable_discussions: boolean
  disable_events: boolean
  disable_stream: boolean
  disable_immersion: boolean
  disable_mature_words: boolean
}

export interface Calendar2 {
  improvement: number
  datetime: any
}

export interface Language {
  streak: number
  language_string: string
  points: number
  learning: boolean
  language: string
  level: number
  current_learning: boolean
  sentences_translated: number
  to_next_level: number
}

export interface Inventory {
  flirting_en: string
  superhero_outfit: string
  luxury_outfit: string
  timed_practice: string
  streak_repair: string
  formal_outfit: string
  premium_subscription: string
  idioms_de: string
  flirting_de: string
  idioms_en: string
}

export interface User {
  language_data: LanguageData
  last_streak: LastStreak
  'upload-self-service': boolean
  is_blocked_by: boolean
  has_observer: boolean
  deactivated: boolean
  privacy_settings: PrivacySettings
  site_streak: number
  is_following: boolean
  calendar: Calendar2[]
  tts_base_url_http: string
  id: number
  dict_base_url: string
  cohort?: any
  daily_goal: number
  'delete-permissions': boolean
  ads_enabled: boolean
  languages: Language[]
  'change-design': boolean
  location: string
  is_self_observer: boolean
  notif_event_ids: any[]
  learning_language_string: string
  inventory: Inventory
  username: string
  bio: string
  tts_cdn_url: string
  email_verified: boolean
  is_blocking: boolean
  num_classrooms: number
  rupees: number
  invite_url: string
  is_observer: boolean
  browser_language: string
  num_observees: number
  is_follower_by: boolean
  tts_base_url: string
  trial_account: boolean
  created: string
  admin: boolean
  streak_extended_today: boolean
  learning_language: string
  'freeze-permissions': boolean
  avatar: string
  transliterate: boolean
  ui_language: string
  fullname: string
}
