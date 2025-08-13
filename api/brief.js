import Parser from 'rss-parser';
import { createRemoteJWKSet, jwtVerify } from 'jose';

const FEED_URL = process.env.FEED_URL || 'https://www.boston.com/feed/';
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
  }catch(e){
    // If verification fails, continue unauthenticated (MVP). To require auth, send 401 here.
    return null;
  }
}

async function summarizeItems(items){
  if(!OPENAI_API_KEY) {
    // Return trimmed items without AI if missing key
    return items.map(x => ({
      id: x.guid || x.link,
      title: x.title,
      url: x.link,
      summary: (x.contentSnippet || '').slice(0, 180),
      topic: inferTopic(x),
      section: inferSection(x),
      durationSec: 75
    }));
  }
  const messages = [
    { role: 'system', content: 'You are a concise news summarizer for Boston.com. Write crisp 1–2 sentence summaries (~60–80 words) that a fast reader can read in about 15–20 seconds. Use plain language, no hype, no bullet points.' },
    { role: 'user', content: JSON.stringify(items.map((x)=> ({ title: x.title, link: x.link, snippet: x.contentSnippet || '', categories: x.categories || [] }))) }
  ];
  const resp = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${OPENAI_API_KEY}` },
    body: JSON.stringify({
      model: 'gpt-4o-mini',
      messages,
      temperature: 0.4
    })
  });
  const data = await resp.json();
  const text = data.choices?.[0]?.message?.content || '';
  // naive split: expect JSON array if the model cooperates, else line-split
  let summaries = [];
  try { summaries = JSON.parse(text); } catch { summaries = text.split(/\n+/).filter(Boolean); }
  const out = items.map((x, i)=> ({
    id: x.guid || x.link,
    title: x.title,
    url: x.link,
    summary: typeof summaries[i] === 'string' ? summaries[i] : (summaries[i]?.summary || (x.contentSnippet || '').slice(0, 180)),
    topic: inferTopic(x),
    section: inferSection(x),
    durationSec: 75
  }));
  return out;
}

function inferTopic(item){
  const s = ((item.categories||[]).join(' ') + ' ' + (item.title||'')).toLowerCase();
  if(/celtics|bruins|patriots|red sox|sox|nba|nhl|nfl|mlb|sports/.test(s)) return 'Sports';
  if(/weather|snow|rain|storm|forecast|heat|cold|humidity/.test(s)) return 'Weather';
  if(/business|market|stock|startup|fund|raise|biotech|economy/.test(s)) return 'Business';
  if(/art|movie|film|music|festival|theater|concert|museum|culture/.test(s)) return 'Arts';
  return 'News';
}
function inferSection(item){ return inferTopic(item); }

export default async function handler(req, res){
  await maybeVerifyJWT(req); // optional; ignore payload for MVP

  const limit = Math.max(1, Math.min(20, parseInt(req.query.limit || '10', 10)));
  const parser = new Parser({ timeout: 10000 });
  let feed;
  try{
    feed = await parser.parseURL(FEED_URL);
  }catch(e){
    res.status(502).json({ error: 'Failed to fetch RSS', details: e.message });
    return;
  }
  const items = (feed.items || []).slice(0, limit);
  const stories = await summarizeItems(items);
  const body = { generatedAt: new Date().toISOString(), dailyGoalMinutes: 10, stories };
  res.setHeader('Cache-Control', 'public, s-maxage=300, stale-while-revalidate=120');
  res.status(200).json(body);
}
