import { ObjectId } from 'mongodb';

export type CommandParamater = {
    id: string;
    paramaterType: 'numer' | 'text' | 'long_text';
    optional: boolean;
} | {
    id: string;
    paramaterType: 'player';
    fallbackFind: boolean;
    optional: boolean;
};

export type GameCommand = {
    _id?: ObjectId;

    groupId: string;
    gameId: number;
    placeId: number;

    id: string;
    name: string;
    paramaters: CommandParamater[];
    enabled: boolean;
    permissions: {
        usableByDepartments: ObjectId[];
        usableByUsers: string[];
        usableByGroupRole: string[];
    };

    detected: boolean;
    updated: Date;
    created: Date;
}
