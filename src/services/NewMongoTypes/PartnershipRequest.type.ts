import { ObjectId } from 'mongodb';

export type PartnershipRequestStatus = 'pending' | 'reviewing' | 'approved' | 'declined';

export type PartnershipRequest = {
  _id?: ObjectId;
  groupId: string;
  groupName?: string;
  robloxId: string; // robloxId of the user who submitted the application
  contact: string; // Discord invite or website
  communityType: string; // What type of community are you?
  currentStaffManagement: string; // How are you currently managing staff?
  featuresUsed: string; // Which ReAdmin features do you use or want to use?
  reason: string; // Why do you want to become a partner?
  willingToProvideFeedback: boolean; // Would you provide feedback/testimonial if accepted?
  status: PartnershipRequestStatus;
  created: Date;
};
