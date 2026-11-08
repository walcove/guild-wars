import {expect,it} from 'vitest';
import {escapeHtml,splitEscaped,linkPrompt} from '../../src/server/telegram/render';
it('escapes untrusted markup and splits without broken Unicode or entities',()=>{
 expect(escapeHtml('<script>&"')).toBe('&lt;script&gt;&amp;&quot;');
 const parts=splitEscaped('😀<&'.repeat(2000));expect(parts.length).toBeGreaterThan(1);
 expect(parts.every(p=>p.length<=3500&&!p.includes('<')&&!p.includes('\uFFFD'))).toBe(true);
});
it('uses ordinary links and compact callbacks, with no Mini App button',()=>{
 const card=linkPrompt('a'.repeat(64),'101','http://127.0.0.1:3000');
 expect(JSON.stringify(card)).not.toContain('web_app');
 for(const row of card.buttons)for(const button of row)if('callback_data' in button)expect(Buffer.byteLength(button.callback_data)).toBeLessThanOrEqual(64);
 expect(card.text).toContain('original browser');
});
