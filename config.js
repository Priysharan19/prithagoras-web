// The one deployment setting of the public site.
//
// APP_ORIGIN is the address of the Prithagoras web app, for example
// "https://app.prithagoras.example" (https only, no path). While it is empty
// the site behaves exactly as it always has: it reads its catalogue from
// resources.json, shows no sign-in link, and makes no request to any other
// origin. Setting it turns on the sign-in link, the desk's account note, and
// the catalogue from the platform's public catalogue route (which falls back
// to resources.json whenever the platform cannot be reached).
window.APP_ORIGIN = "";
