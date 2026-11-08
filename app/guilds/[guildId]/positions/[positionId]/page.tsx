import {redirect} from 'next/navigation';
import {pageUser} from '@/src/server/auth/page-session';
import {getPool} from '@/src/server/db/client';
import {positionView} from '@/src/server/services/positions';
import {invariant} from '@/src/domain/errors';
export default async function Page({params}:{params:Promise<{guildId:string;positionId:string}>}){const {guildId,positionId}=await params,user=await pageUser(`/positions/${positionId}`),p=await positionView(getPool(),user,positionId);invariant(p.guildId===guildId,'forbidden','Position unavailable in this guild');redirect(`/positions/${positionId}`);}
