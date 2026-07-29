import { ObjectId } from "mongodb";


export type SiteAlert = {
  _id?: ObjectId;
  id: string;
  type: 'primary' | 'warning' | 'danger';
  title?: string;
  message: string;
  link?: string;
  linkMessage?: string;
  closable?: boolean;
  public: boolean;
  groupIds?: string[];
  userIds?: string[];
  created: Date;
}
