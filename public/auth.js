// Simple Auth0 SPA integration (optional).
// If AUTH0 env vars are not set on the server, the UI still works unauthenticated.
let auth0Client = null;
async function setupAuth(){
  const domain = window.AUTH0_DOMAIN || (await fetch('/api/env').then(r=>r.json()).then(j=>j.AUTH0_DOMAIN).catch(()=>null));
  const clientId = window.AUTH0_CLIENT_ID || (await fetch('/api/env').then(r=>r.json()).then(j=>j.AUTH0_CLIENT_ID).catch(()=>null));
  if(!domain || !clientId || !window.auth0) {
    document.getElementById('btnLogin').style.display='none';
    document.getElementById('btnLogout').style.display='none';
    return;
  }
  auth0Client = await auth0.createAuth0Client({
    domain, clientId, cacheLocation: 'localstorage', useRefreshTokens: true, authorizationParams: { redirect_uri: window.location.origin }
  });
  // handle redirect callback
  if(location.search.includes('code=') && location.search.includes('state=')){
    await auth0Client.handleRedirectCallback(); history.replaceState({}, document.title, '/');
  }
  const isAuth = await auth0Client.isAuthenticated();
  document.getElementById('btnLogin').style.display = isAuth ? 'none' : '';
  document.getElementById('btnLogout').style.display = isAuth ? '' : 'none';
  document.getElementById('btnLogin').onclick = ()=> auth0Client.loginWithRedirect();
  document.getElementById('btnLogout').onclick = ()=> auth0Client.logout({ logoutParams:{ returnTo: window.location.origin }});
  window.getIdToken = async ()=> (await auth0Client.getTokenSilently().catch(()=>null));
}
setupAuth();
