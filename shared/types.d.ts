export type Game = {
  game_id: number,
  name: string,
  platform: string,
  release_date: string,
  summary: string,
  meta_score: number,
  user_review: number,
  isEighthGen: boolean
}

export type GameQueryParams = {
  game_id: string;
  name?: string;
  platform?: string;
}