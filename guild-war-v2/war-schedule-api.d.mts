import type {D1Database} from '@cloudflare/workers-types';

export function warScheduleApi(request:Request,env:{GUILD_WAR_DB:D1Database},now?:Date):Promise<Response|null>;
