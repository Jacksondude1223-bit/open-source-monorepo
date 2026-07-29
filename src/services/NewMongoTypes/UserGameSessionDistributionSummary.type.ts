import { ObjectId } from "mongodb";

export type RequirementTypes = 'minutes' | 'activeMinutes' | 'minimumMessages' | 'minimumSessions'

export type ActivitygoalNumberType = {
  metGoal: boolean;
  at: number;
  percentage: number;
  goal: number;
};

export type DistributionActivityGoal = {
  [requirementId: string]: {
    [requirementType in RequirementTypes]: ActivitygoalNumberType;
  };
};

export type UserGameSessionDistributionSummary = {
  _id?: ObjectId;
  userId: string;
  groupId: string;
  distribution: string;
  sessions: ObjectId[];
  minutes: {
    total: number;
    active: number;
    inactive: number;
    typing: number;
    messages: number;
  };
  attendedSessions?: string[];
  goals: DistributionActivityGoal;
  updated?: Date;
  created: Date;
}
