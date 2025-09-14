import { EntriesEnum } from "../enums/EntriesEnum";

export default class EntriesValidator {
    public readonly MIN = 1;
    private entries: Record<EntriesEnum, any[]>;

    constructor(entries: Record<EntriesEnum, any[]>) {
        this.entries = entries
    }

    validate(): boolean {
        return Object.keys(this.entries).length >= this.MIN
    }

    message(): string {
        return 'Unable to find any entries from the main content page'
    }
}