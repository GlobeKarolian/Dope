export default async function handler(req, res){
  res.setHeader('Cache-Control','public, max-age=600');
  res.json({
    AUTH0_DOMAIN: process.env.AUTH0_DOMAIN || null,
    AUTH0_CLIENT_ID: process.env.AUTH0_CLIENT_ID || null
  });
}