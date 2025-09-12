export default class EntriesValidator {
    public readonly MIN = 1;
    private entries: Record<string, any>;

    constructor(entries: Record<string, any>) {
        this.entries = entries
    }

    validate(): boolean {
        return this.entries.length >= this.MIN
    }

    message(): string {
        return 'Unable to find any entries from the main content page'
    }
}