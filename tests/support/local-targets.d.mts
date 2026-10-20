export function localTarget(value: string, label: string): string;
export function localTargets(env?: Record<string,string|undefined>): { backend: string; app: string; search: string; mailbox: string };
