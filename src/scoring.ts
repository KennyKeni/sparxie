export interface ScoreInput {
  applicationId: string
  score: number
  band: string
  roleRelevance: number
  careerSignal: number
  cityWorkMode: number
  compensationLogistics: number
  penalties: number[]
  rationale: string
  rubricVersion: string
}

export interface ScoreRecord extends ScoreInput {
  id: string
  createdAt: string
}
