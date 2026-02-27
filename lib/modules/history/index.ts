import { HistoryRepository } from './history.repository'
import { HistoryService } from './history.service'

const historyRepository = new HistoryRepository()
export const historyService = new HistoryService(historyRepository)
