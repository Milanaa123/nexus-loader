const OLD='https://nexus-loader.vercel.app/';
const NEW='https://nexus-loader.onrender.com/';

if (!global.__renderFetchRedirectInstalled && typeof global.fetch === 'function') {
  const nativeFetch = global.fetch.bind(global);
  global.fetch = function redirectedFetch(input, init) {
    let url = null;
    if (typeof input === 'string') url = input;
    else if (input instanceof URL) url = input.toString();
    else if (input && typeof input.url === 'string') url = input.url;

    if (url && url.startsWith(OLD)) {
      const target = NEW + url.slice(OLD.length);
      if (typeof input === 'string' || input instanceof URL) return nativeFetch(target, init);
      return nativeFetch(new Request(target, input), init);
    }
    return nativeFetch(input, init);
  };
  global.__renderFetchRedirectInstalled = true;
  console.log('RENDER FETCH REDIRECT enabled vercel->render');
}
