// Central Ditto connection settings and twin namespace for the GUI.
// Override via .env / .env.local — CRA bakes REACT_APP_* vars in at build time.

export const DITTO_DOMAIN =
  process.env.REACT_APP_DITTO_DOMAIN || "localhost:8080";
export const DITTO_USERNAME =
  process.env.REACT_APP_DITTO_USERNAME || "ditto";
export const DITTO_PASSWORD =
  process.env.REACT_APP_DITTO_PASSWORD || "ditto";
export const DITTO_NAMESPACE =
  process.env.REACT_APP_DITTO_NAMESPACE || "no.sintef.sct.giot";
