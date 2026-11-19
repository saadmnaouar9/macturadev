export const THEME_KEY = "mactura.theme";

/** Pages d'authentification : toujours en thème sombre (fond « espace »). */
export const AUTH_RE = /^\/($|login|register|mot-de-passe-oublie)/;

/** Exécuté avant l'affichage (dans <head>) pour éviter tout flash au chargement. */
export const THEME_INIT_SCRIPT = `(function(){try{var a=${AUTH_RE.toString()}.test(location.pathname);var t=localStorage.getItem("${THEME_KEY}");document.documentElement.dataset.theme=(!a&&t==="light")?"light":"dark"}catch(e){document.documentElement.dataset.theme="dark"}})()`;
