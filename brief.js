import Parser from 'rss-parser';
import { createRemoteJWKSet, jwtVerify } from 'jose';

// Boston.com section feeds provided by user
const SECTION_FEEDS = {
  Local: 'https://www.boston.com/tag/local-news/?feed=rss',
  National: 'https://www.boston.com/tag/national-news/?feed=rss',
  Politics: 'https://www.boston.com/tag/politics/feed/',
  Crime: 'https://www.boston.com/tag/crime/feed/',
  Traffic: 'https://www.boston.com/tag/traffic/feed/',
  Sports: 'https://www.boston.com/category/sports/feed/',
  Culture: 'https://www.boston.com/category/culture/feed/'
};

const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
const AUTH0_DOMAIN = process.env.AUTH0_DOMAIN;
const AUTH0_AUDIENCE = process.env.AUTH0_AUDIENCE;

async function maybeVerifyJWT(req){
  if(!AUTH0_DOMAIN || !AUTH0_AUDIENCE) return null;
  try{
    const auth = req.headers['authorization'] || '';
    const token = auth.startsWith('Bearer ') ? auth.slice(7) : null;
    if(!token) return null;
    const JWKS = createRemoteJWKSet(new URL(`https://${AUTH0_DOMAIN}/.well-known/jwks.json`));
    const { payload } = await jwtVerify(token, JWKS, { audience: AUTH0_AUDIENCE, issuer: `https://${AUTH0_DOMAIN}/` });
    return payload;
  }catch(e){ return null; }
}

function trimHtml(str=''){
  return (str||'').replace(/<[^>]+>/g,' ').replace(/\s+/g,' ').trim();
}

async function summarizeBatch(items){
  // items = [{title, link, section, snippet}]
  if(!OPENAI_API_KEY){
    return items.map(x => ({ ...x, summary: (x.snippet || '').slice(0, 220), durationSec: 75 }));
  }
  const sys = 'You are a concise Boston.com news summarizer. For each item, return a one- or two-sentence summary (60–80 words) suitable for a ~15–20 second read. No bullets. Return JSON array of strings in the same order.';
  const usr = JSON.stringify(items.map(x => ({ title: x.title, url: x.link, section: x.section, snippet: x.snippet })));
  const resp = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${OPENAI_API_KEY}` },
    body: JSON.stringify({ model: 'gpt-4o-mini', temperature: 0.4, messages: [{role:'system', content: sys},{role:'user', content: usr}] })
  });
  const data = await resp.json();
  const text = data.choices?.[0]?.message?.content || '';
  let arr;
  try { arr = JSON.parse(text); } catch { arr = text.split(/\n+/).filter(Boolean); }
  return items.map((x,i)=>({ ...x, summary: typeof arr[i]==='string'?arr[i]:(arr[i]?.summary || x.snippet || ''), durationSec: 75 }));
}

export default async function handler(req, res){
  await maybeVerifyJWT(req); // optional
  const perSection = Math.max(1, Math.min(10, parseInt(req.query.perSection || '3', 10)));
  const totalLimit = Math.max(1, Math.min(50, parseInt(req.query.limit || '18', 10)));
  const sections = Object.keys(SECTION_FEEDS);
  const parser = new Parser({ timeout: 10000 });

  // Fetch all section feeds in parallel
  let results = await Promise.all(sections.map(async (section) => {
    try{
      const feed = await parser.parseURL(SECTION_FEEDS[section]);
      const items = (feed.items || []).slice(0, perSection).map(x => ({
        title: x.title || 'Untitled',
        link: x.link,
        section,
        snippet: trimHtml(x.contentSnippet || x['content:encoded'] || ''),
        pubDate: x.isoDate || x.pubDate || null,
        guid: x.guid || x.link
      }));
      const summarized = await summarizeBatch(items);
      return summarized.map(s => ({
        id: s.guid || s.link,
        title: s.title,
        url: s.link,
        summary: s.summary,
        section: section,
        durationSec: s.durationSec || 75
      }));
    }catch(e){
      return [];
    }
  }));

  // Flatten, sort by pubDate desc when available, then cap
  let all = results.flat();
  // Sorting best-effort since some items may lack pubDates after summarization
  all = all.slice(0, totalLimit);
  res.setHeader('Cache-Control', 'public, s-maxage=300, stale-while-revalidate=120');
  res.status(200).json({ generatedAt: new Date().toISOString(), dailyGoalMinutes: 10, stories: all });
}
