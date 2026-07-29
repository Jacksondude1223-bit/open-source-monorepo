import { ObjectId } from "mongodb";


export type logType = 'Output' | 'Info' | 'Warning' | 'Error';

export type RunningGameLogs = {
  _id?: ObjectId;
  internalGameId: string;
  runningGameId?: ObjectId;
  message: string;
  logType: logType;
  created: Date;
}
