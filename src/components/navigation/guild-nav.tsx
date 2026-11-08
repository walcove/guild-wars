import Link from "next/link";
export function GuildNav({ guildId }: { guildId?: string }) {
 const destinations = guildId ? [[`/guilds/${guildId}`, "Round"], [`/guilds/${guildId}/positions`, "Positions"], [`/guilds/${guildId}/results`, "Results"], [`/guilds/${guildId}/community`, "Community"]] : [["/guilds", "Round"], ["/positions", "Positions"], ["/guilds", "Results"], ["/guilds", "Community"]];
 return <nav aria-label="Guild navigation" className="guild-nav">{destinations.map(([href, name]) => <Link href={href} key={name}>{name}</Link>)}</nav>;
}
