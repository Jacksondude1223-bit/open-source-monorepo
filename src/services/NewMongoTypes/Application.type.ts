import { ObjectId } from "mongodb";

// The verb shown on the form's submission button. Each verb maps to a distinct
// log event + applicant-facing confirmation language.
export type FormButtonType =
  | 'submit'
  | 'send'
  | 'apply'
  | 'request'
  | 'complete'
  | 'sign';

// The full set of statuses a response can move through. The first four are the
// legacy statuses kept for backwards compatibility; the remainder power the
// richer status indications configurable per-form.
export type ResponseStatus =
  | 'pending'
  | 'passed'
  | 'reported'
  | 'failed'
  | 'received'
  | 'read'
  | 'completed'
  | 'denied'
  | 'review';

export type ApplicationPermissions = {
  acceptingResponses: boolean;
  ranking: {
    minRank: number;
    maxRank: number;
  };
  applyOnce: boolean;
  // Cooldown (in days) a user must wait before responding again. 0 = no cooldown.
  timeUntilApplyAgain: number;
};

// A Roblox audio that can be played in the in-game Application Center. Multiple
// audios can be linked and are played/shuffled by the client.
export type ApplicationAudio = {
  assetId: string;
  name?: string;
};

// Visual + audio customization for the in-game Application Center experience.
export type ApplicationAppearance = {
  // Roblox image asset ids (numbers or rbxassetid:// strings stored as text).
  logoAssetId?: string;
  // In-game (Roblox) banner asset id.
  bannerAssetId?: string;
  // Web banner image shown on the online apply page. Stored as a private CDN
  // object key (uploaded & moderated via uploadWebBanner); older forms may
  // still hold a legacy public https url.
  webBannerUrl?: string;
  // Linked background audios (supports multiple).
  audios: ApplicationAudio[];
  // Optional Roblox sound asset played ONLY inside Roblox experiences.
  soundAssetId?: string;
  // Font family applied to all form text.
  font?: string;
  // Visibility toggles.
  showLogo?: boolean;
  showBanner?: boolean;
  // Hex colour theme overrides (e.g. "#3B82F6"). Empty/undefined = use default.
  theme: {
    accent?: string;
    background?: string;
    surface?: string;
    text?: string;
  };
};

// Window during which the form accepts responses. Times are stored as EST
// (America/New_York) wall-clock strings ("YYYY-MM-DDTHH:mm") and surfaced to
// end users in their own timezone.
export type FormResponseWindow = {
  enabled: boolean;
  start?: string;
  end?: string;
};

// Controls which channels can collect responses for this form.
export type FormResponseChannels = {
  web: boolean;
  game: boolean;
};

// What an applicant is allowed to see about their own submission afterwards.
export type FormApplicantVisibility = {
  showAnswers: boolean;
  showQuizCorrectness: boolean;
  showCorrectAnswers: boolean;
  showStatus: boolean;
};

// Optional "join" call-to-action buttons shown on the form.
export type FormLinks = {
  showRobloxGroup: boolean;
  showDiscord: boolean;
};

type NormalQuestionAutoGrading = string | number;
type MultipleSelectChoiceQuestionAutoGrading = string[];
type ScaledQuestionAutoGrading = {
  min: number;
  max: number;
};
export type AutoGradingQuestion =
  | NormalQuestionAutoGrading
  | MultipleSelectChoiceQuestionAutoGrading
  | ScaledQuestionAutoGrading;

export type ApplicationAutoGrading = {
  enabled: boolean;
  mingrade: number;
  questions: {
    [questionId: string]: AutoGradingQuestion;
  };
};

export type ApplicationRobloxAutomation = {
  enabled: boolean;
  ranking: {
    enabled: boolean;
    rankTo: number;
  };
  punishment: {
    exile: boolean;
  };
};
export type ApplicationDiscordAutomation = {
  dm: {
    enabled: boolean;
    message: string;
  };
  ranking: {
    enabled: boolean;
    rank: string;
  };
  punishment: {
    ban: boolean;
    kick: boolean;
  };
};

export type ApplicationAutomations = {
  roblox: {
    sent: ApplicationRobloxAutomation;
    passed: ApplicationRobloxAutomation;
    reported: ApplicationRobloxAutomation;
    failed: ApplicationRobloxAutomation;
  };
  discord: {
    sent: ApplicationDiscordAutomation;
    passed: ApplicationDiscordAutomation;
    reported: ApplicationDiscordAutomation;
    failed: ApplicationDiscordAutomation;
  };
};

export type QuestionTypes =
  | 'text_response'
  | 'multiple_choice'
  | 'scaled_response'
  | 'typing_speed_test';

export type BaseQuestion = {
  type: QuestionTypes;
  questionText: string;
  id: string;
  position: number;
};

export interface TextQuestion extends BaseQuestion {
  type: 'text_response';
  text_placeholder: string;
}
export interface MultipleChoiceQuestion extends BaseQuestion {
  type: 'multiple_choice';
  choices: string[];
  allow_multiple_selections: boolean;
}
export interface ScaledResponseQuestion extends BaseQuestion {
  type: 'scaled_response';
  number_placeholder: number;
  scale_min: number;
  scale_max: number;
}
export interface TypingSpeedTestQuestion extends BaseQuestion {
  type: 'typing_speed_test';
  time: number;
}

export type ApplicationQuestion =
  | TextQuestion
  | MultipleChoiceQuestion
  | ScaledResponseQuestion
  | TypingSpeedTestQuestion;

export type ResponseApplicationQuestion =
  | ({ answer: string | string[]; correct?: boolean } & TextQuestion)
  | ({ answer: string | string[]; correct?: boolean } & MultipleChoiceQuestion)
  | ({ answer: string | string[]; correct?: boolean } & ScaledResponseQuestion)
  | ({
    answer: string | string[];
    correct?: boolean;
  } & TypingSpeedTestQuestion);


export type Application = {
  _id?: ObjectId;
  groupId: string;
  name: string;
  description: string;
  applyOnlineId?: string;
  permissions: ApplicationPermissions;
  autoGrading: ApplicationAutoGrading;
  automations: ApplicationAutomations;
  questions: ApplicationQuestion[];
  appearance?: ApplicationAppearance;
  // The submission button verb (defaults to "submit").
  buttonType?: FormButtonType;
  // Window during which responses are accepted.
  responseWindow?: FormResponseWindow;
  // Which channels (web / in-game) accept responses.
  responseChannels?: FormResponseChannels;
  // When true, the form is shown but locked for users who cannot respond.
  hideIfIneligible?: boolean;
  // Statuses the workspace has enabled for reviewers to assign.
  statusOptions?: ResponseStatus[];
  // What applicants can see about their own response after submitting.
  applicantVisibility?: FormApplicantVisibility;
  // Optional join-group / join-discord CTA buttons.
  links?: FormLinks;
  created: Date;
}
