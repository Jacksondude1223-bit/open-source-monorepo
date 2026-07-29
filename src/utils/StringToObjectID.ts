import { ObjectId } from 'mongodb';

export default function StringToObjectID(objId: string): ObjectId {
  return new ObjectId(objId);
}
