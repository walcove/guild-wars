import {redirect} from 'next/navigation';
import {pageUser} from '@/src/server/auth/page-session';
export default async function Page({params}:{params:Promise<{guildId:string}>}){const {guildId}=await params;await pageUser(`/guilds/${guildId}/positions`);redirect('/positions');}
